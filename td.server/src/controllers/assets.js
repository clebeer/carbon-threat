/**
 * Asset registry controller.
 *
 * Assets are extracted from the nodes in all active threat models.
 * GET /api/assets  — returns a deduplicated list of all assets across models.
 */

import db from '../db/knex.js';
import loggerHelper from '../helpers/logger.helper.js';
import { decryptModel } from '../security/encryption.js';

const logger = loggerHelper.get('controllers/assets.js');

/**
 * Map ReactFlow node kinds to human-readable asset types.
 */
const KIND_LABEL = {
  db:      'Database',
  server:  'Server',
  fw:      'Firewall',
  user:    'External Actor',
  api:     'API / Service',
  cloud:   'Cloud Service',
  browser: 'Client / Browser',
  process: 'Process',
  store:   'Data Store',
};

const CONF_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };

function classifyConfidentiality(label = '') {
  const l = label.toLowerCase();
  if (l.includes('password') || l.includes('key') || l.includes('secret') ||
      l.includes('credential') || l.includes('pii') || l.includes('payment')) {
    return 'Critical';
  }
  if (l.includes('auth') || l.includes('token') || l.includes('session') ||
      l.includes('user') || l.includes('account')) {
    return 'High';
  }
  if (l.includes('api') || l.includes('service') || l.includes('server') ||
      l.includes('cloud')) {
    return 'Medium';
  }
  return 'Low';
}

export async function listAssets(req, res) {
  try {
    const orgId = req.user?.org_id ?? null;

    const models = await db('threat_models').
      where({ is_archived: false }).
      modify((q) => { if (orgId) {q.where('org_id', orgId);} }).
      select('id', 'title', 'content_encrypted');

    // Deduplicate by node label — same label across models merges into one asset
    const assetMap = new Map();

    for (const model of models) {
      let content;
      try {
        const payload = JSON.parse(model.content_encrypted);
        content = decryptModel(payload);
      } catch {
        // Skip models that can't be decrypted (e.g. different encryption key)
        continue;
      }

      const nodes = content?.nodes ?? content?.detail?.diagrams?.flatMap((d) => d.cells ?? []) ?? [];

      for (const node of nodes) {
        const label = node?.data?.label || node?.attrs?.label?.text || node?.label || 'Unnamed';
        const kind = node?.data?.kind || node?.type || 'unknown';
        const key = `${label}::${kind}`;

        if (!assetMap.has(key)) {
          assetMap.set(key, {
            id:               `ast-${Buffer.from(key).toString('base64').
slice(0, 8)}`,
            name:             label,
            type:             KIND_LABEL[kind] ?? 'Component',
            confidentiality:  classifyConfidentiality(label),
            source:           model.title || 'Unknown model',
          });
        } else {
          // If seen in multiple models, escalate confidentiality rank to highest
          const existing = assetMap.get(key);
          const existingRank = CONF_RANK[existing.confidentiality] ?? 0;
          const newRank = CONF_RANK[classifyConfidentiality(label)] ?? 0;
          if (newRank > existingRank) {
            existing.confidentiality = classifyConfidentiality(label);
          }
        }
      }
    }

    return res.json({ assets: Array.from(assetMap.values()) });
  } catch (err) {
    logger.error('listAssets failed', err);
    return res.status(500).json({ error: 'Failed to load assets' });
  }
}
