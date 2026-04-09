import db from '../db/knex.js';
import { decryptModel } from '../security/encryption.js';
import { generateThreats } from '../../engine/rule-engine.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/threats.pg.js');

function scopedModelQuery(req) {
  const userId = req.user?.id;
  const orgId  = req.user?.orgId ?? req.provider?.orgId ?? null;

  const q = db('threat_models').where({ is_archived: false });

  if (orgId) {
    return q.where({ org_id: orgId });
  }
  return q.where({ owner_id: userId });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listThreats(req, res) {
  const { modelId, status, strideCategory } = req.query;

  if (modelId && !UUID_RE.test(modelId)) {
    return res.status(400).json({ error: 'modelId must be a valid UUID' });
  }

  try {
    let q = db('threats');

    if (modelId) {
      const model = await scopedModelQuery(req).where({ id: modelId }).first();
      if (!model) {
        return res.status(404).json({ error: 'Threat model not found' });
      }
      q = q.where({ model_id: modelId });
    } else {
      // No modelId — return all threats scoped to this user/org
      const models = await scopedModelQuery(req).select('id');
      const modelIds = models.map(m => m.id);
      if (modelIds.length === 0) return res.json({ threats: [] });
      q = q.whereIn('model_id', modelIds);
    }

    if (status)         q = q.where({ status });
    if (strideCategory) q = q.where({ stride_category: strideCategory });

    const threats = await q.orderBy('created_at', 'desc');
    return res.json({ threats });
  } catch (err) {
    logger.error('listThreats failed', err);
    return res.status(500).json({ error: 'Failed to list threats' });
  }
}

export async function createThreat(req, res) {
  const {
    model_id, title, description, stride_category, severity, status,
    source, node_ids, edge_ids, mitigation, rule_id, owasp_refs,
  } = req.body || {};

  if (!model_id) return res.status(400).json({ error: 'model_id is required' });
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });

  try {
    const model = await scopedModelQuery(req).where({ id: model_id }).first();
    if (!model) return res.status(404).json({ error: 'Threat model not found' });

    const [threat] = await db('threats')
      .insert({
        model_id,
        title:           title.trim(),
        description:     description || null,
        stride_category: stride_category || 'Tampering',
        severity:        severity || 'Medium',
        status:          status || 'Open',
        source:          source || 'manual',
        node_ids:        node_ids || [],
        edge_ids:        edge_ids || [],
        mitigation:      mitigation || null,
        rule_id:         rule_id || null,
        owasp_refs:      JSON.stringify(owasp_refs || []),
        org_id:          model.org_id || null,
      })
      .returning('*');

    logger.info(`Threat created: ${threat.id} for model ${model_id}`);
    return res.status(201).json({ threat });
  } catch (err) {
    logger.error('createThreat failed', err);
    return res.status(500).json({ error: 'Failed to create threat' });
  }
}

export async function updateThreat(req, res) {
  const { id } = req.params;
  const {
    title, description, stride_category, severity, status,
    mitigation, owasp_refs, node_ids, edge_ids,
  } = req.body || {};

  try {
    const existing = await db('threats').where({ id }).first();
    if (!existing) return res.status(404).json({ error: 'Threat not found' });

    const model = await scopedModelQuery(req).where({ id: existing.model_id }).first();
    if (!model) return res.status(404).json({ error: 'Threat not found' });

    const patch = { updated_at: db.fn.now() };
    if (title !== undefined)           patch.title           = title.trim();
    if (description !== undefined)     patch.description     = description;
    if (stride_category !== undefined) patch.stride_category = stride_category;
    if (severity !== undefined)        patch.severity        = severity;
    if (status !== undefined)          patch.status          = status;
    if (mitigation !== undefined)      patch.mitigation      = mitigation;
    if (owasp_refs !== undefined)      patch.owasp_refs      = JSON.stringify(owasp_refs);
    if (node_ids !== undefined)        patch.node_ids        = node_ids;
    if (edge_ids !== undefined)        patch.edge_ids        = edge_ids;

    const [threat] = await db('threats').where({ id }).update(patch).returning('*');
    return res.json({ threat });
  } catch (err) {
    logger.error('updateThreat failed', err);
    return res.status(500).json({ error: 'Failed to update threat' });
  }
}

export async function deleteThreat(req, res) {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid threat id' });

  try {
    const existing = await db('threats').where({ id }).first();
    if (!existing) return res.status(404).json({ error: 'Threat not found' });

    const model = await scopedModelQuery(req).where({ id: existing.model_id }).first();
    if (!model) return res.status(404).json({ error: 'Threat not found' });

    await db('threats').where({ id }).del();
    logger.info(`Threat deleted: ${id}`);
    return res.json({ message: 'Threat deleted' });
  } catch (err) {
    logger.error('deleteThreat failed', err);
    return res.status(500).json({ error: 'Failed to delete threat' });
  }
}

// ── SARIF export ──────────────────────────────────────────────────────────────

const SARIF_SEVERITY = {
  Critical: 'error',
  High:     'error',
  Medium:   'warning',
  Low:      'note',
};

/**
 * GET /api/threatmodels/:id/sarif
 *
 * Returns a SARIF 2.1.0 document for all threats in the given model.
 * The SARIF format is consumable by GitHub Advanced Security, GitLab SAST,
 * and most CI/CD security dashboards.
 */
export async function exportSarif(req, res) {
  const modelId = req.params.id;
  if (!UUID_RE.test(modelId)) return res.status(400).json({ error: 'Invalid model id' });

  try {
    const model = await scopedModelQuery(req).where({ id: modelId }).first();
    if (!model) return res.status(404).json({ error: 'Threat model not found' });

    const threats = await db('threats').where({ model_id: modelId }).orderBy('created_at');

    const results = threats.map(t => {
      const owaspRefs = Array.isArray(t.owasp_refs) ? t.owasp_refs
        : (typeof t.owasp_refs === 'string' ? JSON.parse(t.owasp_refs || '[]') : []);

      const result = {
        ruleId:  t.rule_id ?? `CT-${t.id.slice(0, 8).toUpperCase()}`,
        level:   SARIF_SEVERITY[t.severity] ?? 'warning',
        message: { text: `[${t.stride_category}] ${t.title}` },
        properties: {
          severity:       t.severity,
          stride:         t.stride_category,
          status:         t.status,
          source:         t.source,
          threat_model:   model.title,
          model_id:       modelId,
        },
      };

      if (t.description) {
        result.message.text += `\n\n${t.description}`;
      }
      if (t.mitigation) {
        result.properties.mitigation = t.mitigation;
      }
      if (owaspRefs.length > 0) {
        result.relatedLocations = owaspRefs.map((r, i) => ({
          id: i,
          message: { text: `${r.type}: ${r.title ?? r.ref}` },
          physicalLocation: { artifactLocation: { uri: r.url ?? `https://owasp.org` } },
        }));
      }

      return result;
    });

    const sarif = {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [{
        tool: {
          driver: {
            name:            'CarbonThreat',
            version:         '1.0.0',
            informationUri:  'https://github.com/OWASP/threat-dragon',
            rules: threats.map(t => ({
              id:   t.rule_id ?? `CT-${t.id.slice(0, 8).toUpperCase()}`,
              name: t.title,
              shortDescription: { text: t.title },
              fullDescription:  { text: t.description ?? t.title },
              defaultConfiguration: { level: SARIF_SEVERITY[t.severity] ?? 'warning' },
              properties: { tags: ['security', 'threat-modeling', t.stride_category.toLowerCase().replace(/ /g, '-')] },
            })),
          },
        },
        results,
        properties: {
          threatModel:  model.title,
          modelVersion: model.version,
          exportedAt:   new Date().toISOString(),
        },
      }],
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="carbonthreat-${model.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.sarif.json"`);
    return res.json(sarif);
  } catch (err) {
    logger.error('exportSarif failed', err);
    return res.status(500).json({ error: 'Failed to generate SARIF export' });
  }
}

export async function analyzeModel(req, res) {
  const modelId = req.params.id;
  if (!UUID_RE.test(modelId)) return res.status(400).json({ error: 'Invalid model id' });

  try {
    const row = await scopedModelQuery(req).where({ id: modelId }).first();
    if (!row) return res.status(404).json({ error: 'Threat model not found' });

    let content = {};
    if (row.content_encrypted) {
      try {
        content = decryptModel(JSON.parse(row.content_encrypted));
      } catch (e) {
        logger.error(`Failed to decrypt model ${modelId}`, e);
        return res.status(500).json({ error: 'Failed to decrypt model content' });
      }
    }

    const nodes = content.nodes || [];
    const edges = content.edges || [];
    const candidates = generateThreats(nodes, edges);

    const inserted = [];
    for (const candidate of candidates) {
      const existing = candidate.rule_id
        ? await db('threats').where({ model_id: modelId, rule_id: candidate.rule_id }).first()
        : null;

      if (existing) {
        inserted.push(existing);
        continue;
      }

      const [threat] = await db('threats')
        .insert({
          model_id:        modelId,
          org_id:          row.org_id || null,
          title:           candidate.title,
          description:     candidate.description,
          stride_category: candidate.stride_category,
          severity:        candidate.severity,
          status:          'Open',
          source:          'rule',
          rule_id:         candidate.rule_id || null,
          node_ids:        candidate.node_ids || [],
          edge_ids:        candidate.edge_ids || [],
          mitigation:      candidate.mitigation || null,
          owasp_refs:      JSON.stringify(candidate.owasp_refs || []),
        })
        .returning('*');

      inserted.push(threat);
    }

    logger.info(`analyzeModel: ${inserted.length} threats for model ${modelId}`);
    return res.json({
      threats: inserted,
      count:   inserted.length,
      message: `Analysis complete. ${inserted.length} threat(s) generated.`,
    });
  } catch (err) {
    logger.error('analyzeModel failed', err);
    return res.status(500).json({ error: 'Failed to analyze model' });
  }
}
