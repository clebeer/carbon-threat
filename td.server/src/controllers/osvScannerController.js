/**
 * OSV Scanner Controller
 *
 * HTTP handlers for the integrated vulnerability scanner.
 *
 * All routes require authentication (bearer middleware applied upstream).
 * Role requirements are enforced by the route definitions in routes.config.js.
 *
 * Routes
 * ──────
 *  GET    /api/scanner/scans                — list scan history (all roles)
 *  POST   /api/scanner/scans                — start a new scan   (analyst+)
 *  GET    /api/scanner/scans/:id            — get scan status    (all roles)
 *  GET    /api/scanner/scans/:id/findings   — get findings       (all roles)
 *  DELETE /api/scanner/scans/:id            — delete scan        (analyst+)
 *  GET    /api/scanner/scans/:id/export     — export findings    (all roles)
 *  GET    /api/scanner/policy               — get scanner policy (all roles)
 *  PUT    /api/scanner/policy               — update policy      (admin only)
 */

import db from '../db/knex.js';
import loggerHelper from '../helpers/logger.helper.js';
import {
  detectLockfileType,
  parseLockfile,
  runContainerScan,
  runGitScan,
  runScan,
} from '../services/osvScanner.js';

const logger = loggerHelper.get('controllers/osvScannerController.js');

// Maximum content size accepted for lockfile / SBOM upload (50 MB in characters)
const MAX_CONTENT_LENGTH = 50 * 1024 * 1024;

// ── List scans ────────────────────────────────────────────────────────────────

export async function listScans(req, res) {
  try {
    const scans = await db('osv_scan_runs').
      leftJoin('users', 'osv_scan_runs.created_by', 'users.id').
      select(
        'osv_scan_runs.*',
        'users.email        as created_by_email',
        'users.display_name as created_by_name'
      ).
      orderBy('osv_scan_runs.created_at', 'desc').
      limit(100);

    return res.json({ scans });
  } catch (err) {
    logger.error('listScans failed', err);
    return res.status(500).json({ error: 'Failed to list scans' });
  }
}

// ── Create + start a scan ─────────────────────────────────────────────────────

export async function createScan(req, res) {
  const {
    name,
    scan_type,
    source_filename,
    content,
    packages: manualPackages,
    ecosystem,
    // git scan
    repo_url,
    // container scan
    image_name,
  } = req.body;

  if (!name?.trim()) {return res.status(400).json({ error: 'name is required' });}
  if (!scan_type) {return res.status(400).json({ error: 'scan_type is required' });}

  // Guard oversized uploads early
  if (content && content.length > MAX_CONTENT_LENGTH) {
    return res.status(413).json({ error: 'File content exceeds the 50 MB limit' });
  }

  try {
    // Fetch policy for ignored vuln IDs
    const policy = await db('osv_scanner_policy').first();
    const ignoredVulnIds = Array.isArray(policy?.ignored_vuln_ids)
      ? policy.ignored_vuln_ids
      : (JSON.parse(policy?.ignored_vuln_ids ?? '[]'));

    let parsedPackages = [];
    let lockfileType = null;
    // For async-only scan types (git / container), we defer package extraction
    // to the background worker and leave parsedPackages empty.
    let asyncScanType = null;

    // ── Branch by scan type ────────────────────────────────────────────────
    if (scan_type === 'manual') {
      if (!Array.isArray(manualPackages) || manualPackages.length === 0) {
        return res.status(400).json({ error: 'packages array is required for manual scan' });
      }
      parsedPackages = manualPackages.
        map((p) => ({
          name:      (p.name ?? '').trim(),
          version:   (p.version ?? '').trim(),
          ecosystem: (p.ecosystem ?? ecosystem ?? 'npm').trim(),
        })).
        filter((p) => p.name && p.version);

      if (parsedPackages.length === 0) {
        return res.status(400).json({ error: 'No valid packages provided (name and version are required)' });
      }

    } else if (scan_type === 'lockfile' || scan_type === 'sbom') {
      if (!content) {return res.status(400).json({ error: 'content is required for lockfile / sbom scan' });}

      lockfileType = detectLockfileType(source_filename ?? '', content);
      if (!lockfileType) {
        return res.status(400).json({
          error:    'Unrecognised lockfile format',
          supported: [
            'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
            'requirements.txt', 'Pipfile.lock',
            'go.sum', 'Cargo.lock', 'Gemfile.lock',
            'packages.lock.json', 'composer.lock',
            '*.spdx.json', 'cyclonedx*.json',
          ],
        });
      }

      parsedPackages = parseLockfile(lockfileType, content);
      if (parsedPackages.length === 0) {
        return res.status(400).json({
          error: `No packages could be extracted from the provided ${lockfileType} content. Verify the file is valid and not empty.`,
        });
      }

    } else if (scan_type === 'git') {
      if (!repo_url?.trim()) {
        return res.status(400).json({ error: 'repo_url is required for git scan' });
      }
      try { new URL(repo_url); } catch {
        return res.status(400).json({ error: 'repo_url must be a valid URL' });
      }
      asyncScanType = 'git';

    } else if (scan_type === 'container') {
      if (!image_name?.trim()) {
        return res.status(400).json({ error: 'image_name is required for container scan' });
      }
      if (!(/^[a-zA-Z0-9._\-/:@]+$/).test(image_name.trim())) {
        return res.status(400).json({ error: 'image_name contains invalid characters' });
      }
      asyncScanType = 'container';

    } else {
      return res.status(400).json({
        error: "scan_type must be 'lockfile', 'sbom', 'manual', 'git', or 'container'",
      });
    }

    // ── Persist the run record ─────────────────────────────────────────────
    const [run] = await db('osv_scan_runs').
      insert({
        name:             name.trim(),
        scan_type,
        status:           'pending',
        // For git/container scans store the URL/image name in source_filename
        source_filename:  asyncScanType === 'git' ? repo_url.trim()
                        : asyncScanType === 'container' ? image_name.trim()
                        : (source_filename ?? null),
        lockfile_type:    lockfileType,
        packages_scanned: 0,
        vulns_found:      0,
        created_by:       req.user?.id ?? null,
        created_at:       db.fn.now(),
      }).
      returning('*');

    // Respond immediately (202 Accepted) — the actual scan is asynchronous.
    // For git/container scans packagesDetected is unknown until the async worker finishes.
    res.status(202).json({
      scan: run,
      packagesDetected: asyncScanType ? null : parsedPackages.length,
    });

    // Kick off the appropriate async scan
    if (asyncScanType === 'git') {
      runGitScan(run.id, repo_url.trim(), ignoredVulnIds).catch((err) => logger.error(`runGitScan unhandled error for ${run.id}: ${err.message}`)
      );
    } else if (asyncScanType === 'container') {
      runContainerScan(run.id, image_name.trim(), ignoredVulnIds).catch((err) => logger.error(`runContainerScan unhandled error for ${run.id}: ${err.message}`)
      );
    } else {
      runScan(run.id, parsedPackages, ignoredVulnIds).catch((err) => logger.error(`runScan unhandled error for ${run.id}: ${err.message}`)
      );
    }

  } catch (err) {
    logger.error('createScan failed', err);
    return res.status(500).json({ error: 'Failed to start scan' });
  }
}

// ── Get scan status ────────────────────────────────────────────────────────────

export async function getScan(req, res) {
  try {
    const scan = await db('osv_scan_runs').where({ id: req.params.id }).
first();
    if (!scan) {return res.status(404).json({ error: 'Scan not found' });}
    return res.json({ scan });
  } catch (err) {
    logger.error('getScan failed', err);
    return res.status(500).json({ error: 'Failed to get scan' });
  }
}

// ── Get findings for a scan ────────────────────────────────────────────────────

export async function getScanFindings(req, res) {
  try {
    const scan = await db('osv_scan_runs').where({ id: req.params.id }).
first();
    if (!scan) {return res.status(404).json({ error: 'Scan not found' });}

    const findings = await db('osv_scan_findings').
      where({ scan_id: req.params.id }).
      orderByRaw(`
        CASE severity
          WHEN 'Critical' THEN 1
          WHEN 'High'     THEN 2
          WHEN 'Medium'   THEN 3
          WHEN 'Low'      THEN 4
          ELSE 5
        END
      `).
      orderBy('package_name');

    const bySeverity = findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    }, {});

    return res.json({ scan, findings, bySeverity });
  } catch (err) {
    logger.error('getScanFindings failed', err);
    return res.status(500).json({ error: 'Failed to get findings' });
  }
}

// ── Delete a scan (cascade-deletes findings) ──────────────────────────────────

export async function deleteScan(req, res) {
  try {
    const deleted = await db('osv_scan_runs').where({ id: req.params.id }).
delete();
    if (!deleted) {return res.status(404).json({ error: 'Scan not found' });}
    return res.json({ message: 'Scan deleted' });
  } catch (err) {
    logger.error('deleteScan failed', err);
    return res.status(500).json({ error: 'Failed to delete scan' });
  }
}

// ── Export scan findings ───────────────────────────────────────────────────────

export async function exportScan(req, res) {
  const format = (req.query.format ?? 'json').toLowerCase();
  if (!['json', 'csv', 'markdown'].includes(format)) {
    return res.status(400).json({ error: "format must be 'json', 'csv', or 'markdown'" });
  }

  try {
    const scan = await db('osv_scan_runs').where({ id: req.params.id }).
first();
    if (!scan) {return res.status(404).json({ error: 'Scan not found' });}

    const findings = await db('osv_scan_findings').
      where({ scan_id: req.params.id }).
      orderByRaw(`
        CASE severity
          WHEN 'Critical' THEN 1 WHEN 'High' THEN 2
          WHEN 'Medium'   THEN 3 WHEN 'Low'  THEN 4 ELSE 5
        END
      `).
      orderBy('package_name');

    const safeName = (scan.name ?? scan.id).replace(/[^a-z0-9_-]/gi, '_').toLowerCase();

    // ── JSON ──────────────────────────────────────────────────────────────
    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="scan-${safeName}.json"`);
      return res.json({ scan, findings });
    }

    // ── CSV ───────────────────────────────────────────────────────────────
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="scan-${safeName}.csv"`);
      const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const header = 'Package,Version,Ecosystem,Vuln ID,Title,Severity,CVSS,Fixed Version,Ignored';
      const rows = findings.map((f) => [
        csvEscape(f.package_name),
        csvEscape(f.package_version ?? ''),
        csvEscape(f.ecosystem ?? ''),
        csvEscape(f.vuln_id),
        csvEscape(f.title ?? ''),
        csvEscape(f.severity ?? ''),
        f.cvss_score ?? '',
        csvEscape(f.fixed_version ?? ''),
        f.is_ignored ? 'yes' : 'no',
      ].join(','));
      return res.send([header, ...rows].join('\n'));
    }

    // ── Markdown ──────────────────────────────────────────────────────────
    if (format === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="scan-${safeName}.md"`);

      const bySeverity = findings.reduce((acc, f) => {
        acc[f.severity] = (acc[f.severity] ?? 0) + 1;
        return acc;
      }, {});

      const lines = [
        `# Vulnerability Scan Report`,
        ``,
        `| Field | Value |`,
        `|-------|-------|`,
        `| **Scan Name** | ${scan.name} |`,
        `| **Type** | ${scan.scan_type} |`,
        `| **Lockfile** | ${scan.lockfile_type ?? 'n/a'} |`,
        `| **Status** | ${scan.status} |`,
        `| **Packages Scanned** | ${scan.packages_scanned} |`,
        `| **Vulnerabilities Found** | ${scan.vulns_found} |`,
        `| **Date** | ${new Date(scan.created_at).toUTCString()} |`,
        ``,
        `## Severity Summary`,
        ``,
        `| Severity | Count |`,
        `|----------|-------|`,
        ...['Critical', 'High', 'Medium', 'Low'].
          filter((s) => (bySeverity[s] ?? 0) > 0).
          map((s) => `| ${s} | ${bySeverity[s]} |`),
        ``,
        `## Findings`,
        ``,
        `| Package | Version | Ecosystem | Vuln ID | Title | Severity | CVSS | Fixed In |`,
        `|---------|---------|-----------|---------|-------|----------|------|----------|`,
        ...findings.map((f) => `| \`${f.package_name}\` | ${f.package_version ?? ''} | ${f.ecosystem ?? ''} | [${f.vuln_id}](https://osv.dev/vulnerability/${f.vuln_id}) | ${(f.title ?? '').replace(/\\/gu, '\\\\').replace(/\|/gu, '\\|')} | **${f.severity ?? ''}** | ${f.cvss_score ?? ''} | ${f.fixed_version ?? 'n/a'} |`
        ),
      ];
      return res.send(lines.join('\n'));
    }

  } catch (err) {
    logger.error('exportScan failed', err);
    return res.status(500).json({ error: 'Failed to export scan' });
  }
}

// ── Get scanner policy ─────────────────────────────────────────────────────────

export async function getPolicy(req, res) {
  try {
    const row = await db('osv_scanner_policy').first();
    const policy = row ?? { ignored_vuln_ids: [], severity_threshold: 'Low', auto_enrich_threats: false };
    // Ensure ignored_vuln_ids is always a JS array (Knex may return JSONB as string or array)
    if (typeof policy.ignored_vuln_ids === 'string') {
      policy.ignored_vuln_ids = JSON.parse(policy.ignored_vuln_ids);
    }
    return res.json({ policy });
  } catch (err) {
    logger.error('getPolicy failed', err);
    return res.status(500).json({ error: 'Failed to get scanner policy' });
  }
}

// ── Update scanner policy (admin only) ────────────────────────────────────────

export async function updatePolicy(req, res) {
  const { ignored_vuln_ids, severity_threshold, auto_enrich_threats } = req.body;

  const VALID_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
  if (severity_threshold !== undefined && !VALID_SEVERITIES.includes(severity_threshold)) {
    return res.status(400).json({ error: 'severity_threshold must be Critical, High, Medium, or Low' });
  }
  if (ignored_vuln_ids !== undefined && !Array.isArray(ignored_vuln_ids)) {
    return res.status(400).json({ error: 'ignored_vuln_ids must be an array of strings' });
  }

  try {
    const existing = await db('osv_scanner_policy').first();
    const patch = {
      updated_at: db.fn.now(),
      ...(ignored_vuln_ids !== undefined && { ignored_vuln_ids:    JSON.stringify(ignored_vuln_ids) }),
      ...(severity_threshold !== undefined && { severity_threshold }),
      ...(auto_enrich_threats !== undefined && { auto_enrich_threats }),
    };

    if (existing) {
      await db('osv_scanner_policy').where({ id: existing.id }).
update(patch);
    } else {
      await db('osv_scanner_policy').insert(patch);
    }

    const updated = await db('osv_scanner_policy').first();
    if (typeof updated.ignored_vuln_ids === 'string') {
      updated.ignored_vuln_ids = JSON.parse(updated.ignored_vuln_ids);
    }
    return res.json({ policy: updated });
  } catch (err) {
    logger.error('updatePolicy failed', err);
    return res.status(500).json({ error: 'Failed to update scanner policy' });
  }
}
