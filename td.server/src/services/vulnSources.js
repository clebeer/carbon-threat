/* eslint-disable max-lines */
/**
 * Vulnerability Source Adapters
 *
 * Plugin architecture for multi-source vulnerability intelligence.
 * Each adapter normalises data to a common format for the intelligence engine.
 *
 * Supported sources: OSV, NVD, GHSA
 * To add a new source: implement the VulnSourceAdapter interface.
 */

import https from 'https';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('services/vulnSources.js');

// ── HTTP helper (zero external deps) ──────────────────────────────────────────
function httpGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { 'User-Agent': 'CarbonThreat/1.0', ...(options.headers || {}) },
        timeout: options.timeout || 30000,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch { reject(new Error(`JSON parse error from ${url}: ${raw.slice(0, 200)}`)); }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error(`Timeout fetching ${url}`)); });
    req.end();
  });
}

function httpPost(url, body, options = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'User-Agent': 'CarbonThreat/1.0', ...(options.headers || {}) },
        timeout: options.timeout || 30000,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch { reject(new Error(`JSON parse error from ${url}: ${raw.slice(0, 200)}`)); }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error(`Timeout posting to ${url}`)); });
    req.write(data);
    req.end();
  });
}

// ── Common normalisation ──────────────────────────────────────────────────────

function normaliseSeverity(cvssScore = 0, severityText = '') {
  if (cvssScore >= 9.0) {return 'Critical';}
  if (cvssScore >= 7.0) {return 'High';}
  if (cvssScore >= 4.0) {return 'Medium';}
  if (cvssScore > 0) {return 'Low';}
  const t = severityText.toLowerCase();
  if (t.includes('critical')) {return 'Critical';}
  if (t.includes('high')) {return 'High';}
  if (t.includes('medium') || t.includes('moderate')) {return 'Medium';}
  return 'Low';
}

// ── CWE → STRIDE formal mapping (MITRE-based) ───────────────────────────────
const CWE_STRIDE_MAP = {
  'CWE-79': ['Tampering', 'Information Disclosure'], // XSS
  'CWE-89': ['Tampering'], // SQL Injection
  'CWE-22': ['Tampering', 'Information Disclosure'], // Path Traversal
  'CWE-78': ['Tampering', 'Elevation of Privilege'], // OS Command Injection
  'CWE-352': ['Tampering', 'Spoofing'], // CSRF
  'CWE-287': ['Spoofing'], // Improper Authentication
  'CWE-862': ['Elevation of Privilege'], // Missing Authorization
  'CWE-863': ['Elevation of Privilege'], // Incorrect Authorization
  'CWE-200': ['Information Disclosure'], // Information Exposure
  'CWE-400': ['DoS'], // Uncontrolled Resource Consumption
  'CWE-502': ['Tampering', 'Elevation of Privilege'], // Deserialization
  'CWE-918': ['Information Disclosure', 'Tampering'], // SSRF
  'CWE-611': ['Information Disclosure'], // XXE
  'CWE-306': ['Spoofing', 'Elevation of Privilege'], // Missing Authentication
  'CWE-250': ['Elevation of Privilege'], // Execution with Unnecessary Privileges
  'CWE-778': ['Repudiation'], // Insufficient Logging
  'CWE-327': ['Tampering', 'Information Disclosure'], // Broken Crypto
  'CWE-326': ['Tampering', 'Information Disclosure'], // Inadequate Encryption Strength
  'CWE-295': ['Spoofing'], // Improper Certificate Validation
  'CWE-94': ['Tampering', 'Elevation of Privilege'], // Code Injection
};

const STRIDE_KEYWORDS = [
  { categories: ['Spoofing'], words: ['spoof', 'impersonat', 'authenticat', 'identity', 'bypass auth', 'forged', 'fake'] },
  { categories: ['Tampering'], words: ['tamper', 'inject', 'sql injection', 'xss', 'csrf', 'code injection', 'rce', 'remote code', 'path traversal', 'deserialization'] },
  { categories: ['Repudiation'], words: ['repudiat', 'log', 'audit', 'non-repudiat', 'trace'] },
  { categories: ['Information Disclosure'], words: ['disclosure', 'information leak', 'sensitive data', 'exposure', 'enumerat', 'directory listing', 'ssrf', 'xxe'] },
  { categories: ['DoS'], words: ['denial of service', 'dos', 'ddos', 'resource exhaust', 'memory leak', 'crash', 'flood', 'amplification', 'integer overflow'] },
  { categories: ['Elevation of Privilege'], words: ['privilege', 'escalat', 'sudo', 'root', 'admin bypass', 'acl bypass', 'authorization bypass', 'permission'] },
];

function mapToStride(title = '', description = '', cwes = []) {
  const matched = new Set();
  // CWE-based mapping (most reliable)
  for (const cwe of cwes) {
    const cweId = cwe.toUpperCase().startsWith('CWE-') ? cwe.toUpperCase() : `CWE-${cwe}`;
    if (CWE_STRIDE_MAP[cweId]) {
      CWE_STRIDE_MAP[cweId].forEach((c) => matched.add(c));
    }
  }
  // Keyword fallback
  if (matched.size === 0) {
    const text = `${title} ${description}`.toLowerCase();
    for (const { categories, words } of STRIDE_KEYWORDS) {
      if (words.some((w) => text.includes(w))) {
        categories.forEach((c) => matched.add(c));
      }
    }
  }
  return matched.size > 0 ? [...matched] : ['Tampering'];
}

function extractCVEAliases(vuln) {
  // Try to find CVE IDs from aliases or references
  const aliases = vuln.aliases ?? vuln.cveIds ?? [];
  const refs = (vuln.references ?? []).map((r) => r.url || r).filter(Boolean);
  const allStrings = [...aliases, ...refs].join(' ');
  const cveMatches = allStrings.match(/CVE-\d{4}-\d{4,}/gu) ?? [];
  return [...new Set(cveMatches)];
}

// ── Normalised advisory format ────────────────────────────────────────────────
// { source, sourceId, title, description, severity, cvssScore, strideCategories,
//   cwes, affected, references, publishedAt, aliases }

// ═══════════════════════════════════════════════════════════════════════════════
// ADAPTER: OSV (https://osv.dev)
// ═══════════════════════════════════════════════════════════════════════════════
export const osvAdapter = {
  name: 'osv',

  async fetch(config) {
    const ecosystems = config.ecosystems ?? ['npm', 'PyPI', 'Go', 'Maven'];
    const limit = config.fetchLimit ?? 20;
    const allVulns = [];

    await Promise.all(ecosystems.map(async (ecosystem) => {
      try {
        const result = await httpPost('https://api.osv.dev/v1/query', { package: { ecosystem } });
        const vulns = (result.vulns ?? []).slice(0, limit);
        allVulns.push(...vulns);
        logger.info(`osvAdapter: ${ecosystem} → ${vulns.length} advisories`);
      } catch (err) {
        logger.warn(`osvAdapter: ${ecosystem} failed: ${err.message}`);
      }
    }));
    return allVulns;
  },

  normalise(vuln) {
    const sourceId = vuln.id ?? '';
    const title = vuln.summary ?? vuln.id ?? 'Unknown OSV Advisory';
    const description = vuln.details ?? '';
    const aliases = extractCVEAliases(vuln);

    let cvssScore = 0;
    const severityEntry = (vuln.severity ?? []).find((s) => s.type === 'CVSS_V3' || s.type === 'CVSS_V2');
    if (severityEntry?.score) {
      const dbSpecific = vuln.database_specific ?? {};
      cvssScore = parseFloat(dbSpecific.cvss ?? dbSpecific.cvss_score ?? 0) || 0;
    }
    const severityText = vuln.database_specific?.severity ?? '';
    const severity = normaliseSeverity(cvssScore, severityText);

    const cwes = (vuln.database_specific?.cwes ?? []).map(String);
    const strideCategories = mapToStride(title, description, cwes);

    const affected = (vuln.affected ?? []).map((a) => ({
      ecosystem: a.package?.ecosystem,
      name: a.package?.name,
      versions: a.ranges?.[0]?.events?.map((e) => e.fixed ?? e.introduced)?.filter(Boolean) ?? [],
    }));

    const references = (vuln.references ?? []).map((r) => r.url).filter(Boolean);

    return {
      source: 'osv',
      sourceId,
      title,
      description,
      severity,
      cvssScore: cvssScore || null,
      strideCategories,
      cwes,
      affected: JSON.stringify(affected),
      references: JSON.stringify(references),
      publishedAt: vuln.published ? new Date(vuln.published) : null,
      aliases,
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADAPTER: NVD / CVE (https://nvd.nist.gov)
// ═══════════════════════════════════════════════════════════════════════════════
export const nvdAdapter = {
  name: 'nvd',

  async fetch(config) {
    const resultsPerPage = config.resultsPerPage ?? 100;
    try {
      const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=${resultsPerPage}`;
      const data = await httpGet(url, { timeout: 60000 });
      return data.vulnerabilities ?? [];
    } catch (err) {
      logger.warn(`nvdAdapter: fetch failed: ${err.message}`);
      return [];
    }
  },

  normalise(vuln) {
    const cve = vuln.cve ?? {};
    const sourceId = cve.id ?? '';
    const title = (cve.descriptions ?? []).find((d) => d.lang === 'en')?.value ?? cve.id ?? 'Unknown CVE';
    const description = title;

    // CVSS from metrics
    let cvssScore = 0;
    const metrics = cve.metrics ?? {};
    const cvssData = metrics.cvssMetricV31?.[0] ?? metrics.cvssMetricV30?.[0] ?? metrics.cvssMetricV2?.[0] ?? {};
    if (cvssData.cvssData) {
      cvssScore = parseFloat(cvssData.cvssData.baseScore) || 0;
    }
    const severity = normaliseSeverity(cvssScore, cvssData.cvssData?.baseSeverity ?? '');

    // CWE
    const cwes = (cve.weaknesses ?? []).flatMap((w) => w.description?.filter((d) => d.lang === 'en').map((d) => d.value) ?? []
    ).filter(Boolean);

    const strideCategories = mapToStride(title, description, cwes);

    const references = (cve.references ?? []).map((r) => r.url).filter(Boolean);
    const publishedAt = cve.published ? new Date(cve.published) : null;

    return {
      source: 'nvd',
      sourceId,
      title: sourceId,
      description,
      severity,
      cvssScore: cvssScore || null,
      strideCategories,
      cwes,
      affected: JSON.stringify([]),
      references: JSON.stringify(references),
      publishedAt,
      aliases: [sourceId],
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADAPTER: GitHub Security Advisory (GHSA)
// ═══════════════════════════════════════════════════════════════════════════════
export const ghsaAdapter = {
  name: 'ghsa',

  async fetch(config) {
    const type = config.type ?? 'reviewed';
    try {
      const url = `https://api.github.com/advisories?type=${type}&per_page=100`;
      const data = await httpGet(url, { timeout: 30000 });
      return Array.isArray(data) ? data : [];
    } catch (err) {
      logger.warn(`ghsaAdapter: fetch failed: ${err.message}`);
      return [];
    }
  },

  normalise(vuln) {
    const sourceId = vuln.ghsa_id ?? vuln.id ?? '';
    const title = vuln.summary ?? vuln.ghsa_id ?? 'Unknown GHSA';
    const description = vuln.description ?? vuln.summary ?? '';
    const cvssScore = parseFloat(vuln.cvss?.score) || 0;
    const severity = normaliseSeverity(cvssScore, vuln.severity ?? vuln.cvss?.severity_string ?? '');
    const cwes = vuln.cwes?.map((c) => c.cwe_id).filter(Boolean) ?? [];
    const strideCategories = mapToStride(title, description, cwes);

    const affected = (vuln.vulnerabilities ?? []).map((v) => ({
      ecosystem: v.package?.ecosystem,
      name: v.package?.name,
      versions: [v.vulnerable_version_range].filter(Boolean),
      patched: v.patched_versions ?? null,
    }));

    const references = vuln.references?.map((r) => r.url).filter(Boolean) ?? [];
    const aliases = vuln.cve_id ? [vuln.cve_id] : [];
    const publishedAt = vuln.published_at ? new Date(vuln.published_at) : null;

    return {
      source: 'ghsa',
      sourceId,
      title,
      description,
      severity,
      cvssScore: cvssScore || null,
      strideCategories,
      cwes,
      affected: JSON.stringify(affected),
      references: JSON.stringify(references),
      publishedAt,
      aliases,
    };
  },
};

// ── Adapter registry ──────────────────────────────────────────────────────────
const ADAPTERS = {
  osv: osvAdapter,
  nvd: nvdAdapter,
  ghsa: ghsaAdapter,
};

export function getAdapter(name) {
  return ADAPTERS[name] ?? null;
}

export function listAdapters() {
  return Object.keys(ADAPTERS);
}

export default { osvAdapter, nvdAdapter, ghsaAdapter, getAdapter, listAdapters };