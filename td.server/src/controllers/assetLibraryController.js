/* eslint-disable max-lines, max-lines-per-function, complexity, no-await-in-loop, require-unicode-regexp, no-mixed-operators, no-continue, prefer-named-capture-group, no-useless-escape, max-depth, no-empty-function, sort-imports, no-bitwise, no-promise-executor-return, require-await, no-console, no-inner-declarations, no-invalid-this, radix, no-new, no-nested-ternary, no-unused-vars, no-eq-null, no-control-regex */
/**
 * Asset Library controller.
 *
 * POST /api/assets/import  — parse JSON/CSV, batch create assets, return report
 * GET  /api/assets/library — list imported assets from the library
 * DELETE /api/assets/library/:id — delete a library asset
 */
import db from '../db/knex.js';

import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/assetLibraryController.js');

/**
 * Valid asset kinds from the stencil.
 */
const VALID_KINDS = new Set([
  'server', 'db', 'fw', 'user', 'api', 'cloud', 'browser', 'process', 'store',
  'loadbalancer', 'cdn', 'dns', 'email', 'queue', 'cache', 'registry',
  'identity', 'monitoring', 'ci', 'vcs', 'artifact', 'vault', 'waf',
  'ids', 'siem', 'vpn', 'proxy', 'gateway', 'mesh', 'container', 'k8s',
  'lambda', 's3', 'ec2', 'rds', 'oci', 'alibaba', 'trust-boundary',
  'dataflow', 'mobile', 'iot', 'scada',
]);

/**
 * Parse CSV text into array of objects using the first row as headers.
 */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {return [];}

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().
replace(/['"]/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (values[idx] || '').trim().replace(/^"|"$/g, '');
    });
    rows.push(obj);
  }
  return rows;
}

/**
 * Parse JSON text — accepts an array or an object with an `assets` key.
 */
function parseJSON(text) {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) {return parsed;}
  if (parsed.assets && Array.isArray(parsed.assets)) {return parsed.assets;}
  throw new Error('JSON must be an array of assets or an object with an "assets" key');
}

/**
 * Normalize a kind value to match the stencil.
 */
function normalizeKind(raw) {
  if (!raw) {return 'server';}
  const lower = raw.toLowerCase().trim();
  if (VALID_KINDS.has(lower)) {return lower;}
  // Fuzzy matches
  if (lower.includes('database') || lower.includes('db')) {return 'db';}
  if (lower.includes('firewall') || lower.includes('fw')) {return 'fw';}
  if (lower.includes('server') || lower.includes('host')) {return 'server';}
  if (lower.includes('api') || lower.includes('service')) {return 'api';}
  if (lower.includes('cloud')) {return 'cloud';}
  if (lower.includes('user') || lower.includes('actor')) {return 'user';}
  if (lower.includes('browser') || lower.includes('client')) {return 'browser';}
  if (lower.includes('process') || lower.includes('app')) {return 'process';}
  if (lower.includes('store') || lower.includes('storage')) {return 'store';}
  return 'server';
}

/**
 * POST /api/assets/import
 *
 * Body: { data: string (JSON or CSV text), format: 'json' | 'csv' }
 * Returns: { report: { total, created, warnings } }
 */
export async function importAssets(req, res) {
  try {
    const { data, format } = req.body;

    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'Request body must include a non-empty "data" string' });
    }

    let rawAssets;
    try {
      rawAssets = format === 'csv' ? parseCSV(data) : parseJSON(data);
    } catch (err) {
      return res.status(400).json({ error: `Parse error: ${err.message}` });
    }

    if (!Array.isArray(rawAssets) || rawAssets.length === 0) {
      return res.status(400).json({ error: 'No assets found in the imported data' });
    }

    const userId = req.user?.id ?? req.user?.sub;
    const orgId = req.user?.org_id ?? null;

    const warnings = [];
    const assets = [];

    for (let i = 0; i < rawAssets.length; i++) {
      const raw = rawAssets[i];
      const name = (raw.name || raw.Name || raw.label || raw.Label || '').trim();
      if (!name) {
        warnings.push(`Row ${i + 1}: missing name, skipped`);
        continue;
      }

      const kind = normalizeKind(raw.kind || raw.type || raw.Type || raw.Kind || '');
      const description = raw.description || raw.Description || raw.desc || '';
      const properties = raw.properties || raw.Properties || raw.metadata || {};

      assets.push({
        org_id: orgId,
        name,
        kind,
        description: typeof description === 'string' ? description : JSON.stringify(description),
        properties: typeof properties === 'object' ? JSON.stringify(properties) : '{}',
        created_by: userId,
      });
    }

    let created = 0;
    if (assets.length > 0) {
      const inserted = await db('asset_library').insert(assets).
returning('*');
      created = inserted.length;
    }

    logger.info(`Asset import: ${created} created, ${warnings.length} warnings`);

    return res.status(201).json({
      report: {
        total: rawAssets.length,
        created,
        warnings,
      },
      assets: created > 0 ? await db('asset_library').
        where('org_id', orgId).
        orderBy('created_at', 'desc').
        limit(created) : [],
    });
  } catch (err) {
    logger.error('importAssets failed', err);
    return res.status(500).json({ error: 'Failed to import assets' });
  }
}

/**
 * GET /api/assets/library
 *
 * List all assets in the library for the current org.
 */
export async function listLibraryAssets(req, res) {
  try {
    const orgId = req.user?.org_id ?? null;

    const query = db('asset_library').orderBy('created_at', 'desc');
    if (orgId) {query.where('org_id', orgId);}

    const assets = await query;
    return res.json({ assets });
  } catch (err) {
    logger.error('listLibraryAssets failed', err);
    return res.status(500).json({ error: 'Failed to list library assets' });
  }
}

/**
 * DELETE /api/assets/library/:id
 *
 * Remove an asset from the library.
 */
export async function deleteLibraryAsset(req, res) {
  try {
    const { id } = req.params;
    const orgId = req.user?.org_id ?? null;

    const query = db('asset_library').where('id', id);
    if (orgId) {query.where('org_id', orgId);}

    const deleted = await query.delete();
    if (deleted === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    logger.error('deleteLibraryAsset failed', err);
    return res.status(500).json({ error: 'Failed to delete asset' });
  }
}