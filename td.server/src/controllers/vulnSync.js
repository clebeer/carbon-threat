/**
 * Vulnerability Feed Sync Controller
 *
 * Fetches recent high/critical advisories from the OSV API
 * (https://osv.dev — free, no auth required) and maps each advisory
 * to one or more STRIDE categories based on CWE / keyword analysis.
 *
 * Routes (admin only):
 *   GET  /api/admin/vuln-feeds/status  → last run + advisory counts
 *   POST /api/admin/vuln-feeds/sync    → trigger a fresh sync
 */

import https from 'https';
import db from '../db/knex.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/vulnSync.js');

// ── OSV ecosystems to query ───────────────────────────────────────────────────
// Common web/cloud stacks — keeps the fetch set focused and fast.
const OSV_ECOSYSTEMS = [
  'npm', 'PyPI', 'Go', 'Maven', 'NuGet',
  'RubyGems', 'Docker', 'Linux', 'Kubernetes',
];

// Number of recent advisories to fetch per ecosystem
const FETCH_LIMIT = 20;

// ── Keyword → STRIDE mapping ──────────────────────────────────────────────────
// Used to derive STRIDE categories from advisory title/description.
const STRIDE_KEYWORDS = [
  { categories: ['Spoofing'],              words: ['spoof', 'impersonat', 'authenticat', 'identity', 'bypass auth', 'forged', 'fake'] },
  { categories: ['Tampering'],             words: ['tamper', 'inject', 'sql injection', 'xss', 'csrf', 'code injection', 'rce', 'remote code', 'path traversal', 'deserialization'] },
  { categories: ['Repudiation'],           words: ['repudiat', 'log', 'audit', 'non-repudiat', 'trace'] },
  { categories: ['Information Disclosure'],words: ['disclosure', 'information leak', 'sensitive data', 'exposure', 'enumerat', 'directory listing', 'ssrf', 'xxe'] },
  { categories: ['DoS'],                   words: ['denial of service', 'dos', 'ddos', 'resource exhaust', 'memory leak', 'crash', 'flood', 'amplification', 'integer overflow'] },
  { categories: ['Elevation of Privilege'],words: ['privilege', 'escalat', 'sudo', 'root', 'admin bypass', 'acl bypass', 'authorization bypass', 'permission'] },
];

function mapToStride(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase();
  const matched = new Set();
  for (const { categories, words } of STRIDE_KEYWORDS) {
    if (words.some(w => text.includes(w))) {
      categories.forEach(c => matched.add(c));
    }
  }
  // Default to Tampering if nothing matches (most common for unclassified vulns)
  return matched.size > 0 ? [...matched] : ['Tampering'];
}

function normaliseSeverity(cvssScore, severityText = '') {
  if (cvssScore >= 9.0) return 'Critical';
  if (cvssScore >= 7.0) return 'High';
  if (cvssScore >= 4.0) return 'Medium';
  if (cvssScore > 0)    return 'Low';
  // Fallback to text field
  const t = severityText.toLowerCase();
  if (t.includes('critical')) return 'Critical';
  if (t.includes('high'))     return 'High';
  if (t.includes('medium') || t.includes('moderate')) return 'Medium';
  return 'Low';
}

// ── HTTP helper (no extra deps — uses built-in https) ─────────────────────────
function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const req = https.request(
      { hostname: parsed.hostname, path: parsed.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'User-Agent': 'CarbonThreat/1.0' } },
      (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch { reject(new Error(`JSON parse error: ${raw.slice(0, 120)}`)); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('OSV request timeout')); });
    req.write(data);
    req.end();
  });
}

// ── Fetch one ecosystem from OSV ──────────────────────────────────────────────
async function fetchOsvEcosystem(ecosystem) {
  try {
    const result = await postJson('https://api.osv.dev/v1/query', {
      package: { ecosystem },
      // pageToken omitted → first page only
    });
    return (result.vulns ?? []).slice(0, FETCH_LIMIT);
  } catch (err) {
    logger.warn(`OSV fetch failed for ${ecosystem}: ${err.message}`);
    return [];
  }
}

// ── Upsert a single advisory ──────────────────────────────────────────────────
async function upsertAdvisory(trx, vuln) {
  const sourceId = vuln.id ?? '';
  if (!sourceId) return false;

  const title = vuln.summary ?? vuln.id ?? 'Unknown Advisory';
  const description = vuln.details ?? '';

  // Extract CVSS score from severity array
  let cvssScore = null;
  const severityEntry = (vuln.severity ?? []).find(s => s.type === 'CVSS_V3' || s.type === 'CVSS_V2');
  if (severityEntry?.score) {
    // CVSS vector string → base score is not inline; use database_specific if available
    const dbSpecific = vuln.database_specific ?? {};
    cvssScore = parseFloat(dbSpecific.cvss ?? dbSpecific.cvss_score ?? 0) || null;
  }

  const severityText = vuln.database_specific?.severity ?? '';
  const severity = normaliseSeverity(cvssScore ?? 0, severityText);
  const strideCategories = mapToStride(title, description);

  const affected = (vuln.affected ?? []).map(a => ({
    ecosystem: a.package?.ecosystem,
    name: a.package?.name,
    versions: a.ranges?.[0]?.events?.map(e => e.fixed ?? e.introduced)?.filter(Boolean) ?? [],
  }));

  const references = (vuln.references ?? []).map(r => r.url).filter(Boolean);

  const publishedAt = vuln.published ? new Date(vuln.published) : null;

  const existing = await trx('vulnerability_advisories')
    .where({ source_id: sourceId, source: 'osv' })
    .first();

  if (existing) {
    await trx('vulnerability_advisories')
      .where({ id: existing.id })
      .update({ title, description, severity, stride_categories: strideCategories, affected: JSON.stringify(affected), references: JSON.stringify(references), cvss_score: cvssScore, synced_at: trx.fn.now() });
    return 'updated';
  }

  await trx('vulnerability_advisories').insert({
    source_id:        sourceId,
    source:           'osv',
    title,
    description,
    severity,
    stride_categories: strideCategories,
    affected:          JSON.stringify(affected),
    references:        JSON.stringify(references),
    cvss_score:        cvssScore,
    published_at:      publishedAt,
  });
  return 'inserted';
}

// ── Controllers ───────────────────────────────────────────────────────────────

export async function getVulnFeedStatus(req, res) {
  try {
    const [lastRun] = await db('vuln_feed_runs')
      .orderBy('started_at', 'desc')
      .limit(1)
      .select('status', 'fetched', 'inserted', 'updated', 'error_message', 'started_at', 'finished_at');

    const counts = await db('vulnerability_advisories')
      .select('severity')
      .count('id as n')
      .groupBy('severity');

    const total = await db('vulnerability_advisories').count('id as n').first();

    return res.json({
      lastRun: lastRun ?? null,
      totalAdvisories: parseInt(total?.n ?? 0, 10),
      bySeverity: Object.fromEntries(counts.map(r => [r.severity, parseInt(r.n, 10)])),
    });
  } catch (err) {
    logger.error('getVulnFeedStatus failed', err);
    return res.status(500).json({ error: 'Failed to fetch status' });
  }
}

export async function syncVulnFeeds(req, res) {
  const [run] = await db('vuln_feed_runs')
    .insert({ status: 'running', started_at: db.fn.now() })
    .returning('id');

  const runId = run.id;

  // Respond immediately — the actual sync runs asynchronously so the request
  // doesn't time out while waiting for multiple external API calls.
  res.json({ message: 'Sync started', runId });

  let fetched = 0, inserted = 0, updated = 0;
  try {
    for (const ecosystem of OSV_ECOSYSTEMS) {
      const vulns = await fetchOsvEcosystem(ecosystem);
      fetched += vulns.length;

      await db.transaction(async (trx) => {
        for (const vuln of vulns) {
          const result = await upsertAdvisory(trx, vuln);
          if (result === 'inserted') inserted++;
          else if (result === 'updated') updated++;
        }
      });

      logger.info(`vuln-sync: ${ecosystem} — ${vulns.length} fetched`);
    }

    await db('vuln_feed_runs').where({ id: runId }).update({
      status: 'success', fetched, inserted, updated, finished_at: db.fn.now(),
    });

    logger.info(`vuln-sync complete — fetched=${fetched} inserted=${inserted} updated=${updated}`);
  } catch (err) {
    logger.error('vuln-sync failed', err);
    await db('vuln_feed_runs').where({ id: runId }).update({
      status: 'error', fetched, inserted, updated,
      error_message: err.message, finished_at: db.fn.now(),
    });
  }
}
