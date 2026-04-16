/**
 * ATT&CK Framework Controller
 *
 * HTTP handlers for the integrated MITRE ATT&CK modules:
 *   Analysis, Techniques Browser, Threat Modeling, and Reports.
 *
 * All routes are authenticated (bearer middleware applied upstream).
 * Role requirements are enforced in routes.config.js.
 *
 * Routes
 * ──────
 *  GET  /api/attack/status                    — sync status + object counts
 *  POST /api/attack/sync                      — trigger STIX data sync (admin)
 *
 *  GET  /api/attack/tactics                   — list all 14 enterprise tactics
 *  GET  /api/attack/techniques                — search / filter techniques
 *  GET  /api/attack/techniques/:attackId      — technique detail + sub-techs + mitigations
 *  GET  /api/attack/groups                    — list / search threat groups
 *  GET  /api/attack/mitigations               — list / search mitigations
 *
 *  GET  /api/attack/analysis/:modelId         — coverage analysis for a model
 *
 *  GET  /api/attack/mappings                  — list threat→technique mappings
 *  POST /api/attack/mappings                  — create a mapping
 *  DELETE /api/attack/mappings/:id            — delete a mapping
 *
 *  GET  /api/attack/reports/:modelId          — generate report (JSON)
 *  GET  /api/attack/reports/:modelId/export   — export report (json / markdown)
 */

import db from '../db/knex.js';
import loggerHelper from '../helpers/logger.helper.js';
import {
  syncAttackData,
  getSyncStatus,
  getTactics,
  getTechniques,
  getTechniqueById,
  getGroups,
  getMitigations,
  analyzeModelCoverage,
  listMappings,
  createMapping,
  deleteMapping,
  generateReport,
} from '../services/attackFramework.js';

const logger = loggerHelper.get('controllers/attackController.js');

// ── Sync Status ───────────────────────────────────────────────────────────────

export async function getSyncStatusHandler(req, res) {
  try {
    const status = await getSyncStatus();
    return res.json(status);
  } catch (err) {
    logger.error('getSyncStatus failed', err);
    return res.status(500).json({ error: 'Failed to retrieve sync status' });
  }
}

// ── Trigger Sync ──────────────────────────────────────────────────────────────

export async function triggerSync(req, res) {
  try {
    // Check if a sync is already in-flight (pending or running).
    // Skip rows that have been stuck for > 30 minutes — assume they crashed.
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const inFlight = await db('attack_sync_log')
      .whereIn('status', ['pending', 'running'])
      .where('started_at', '>', staleThreshold)
      .first();
    if (inFlight) {
      return res.status(409).json({
        error: 'A sync is already in progress',
        syncId: inFlight.id,
      });
    }

    // Mark any stale in-flight rows as errored so they don't block future syncs
    await db('attack_sync_log')
      .whereIn('status', ['pending', 'running'])
      .where('started_at', '<=', staleThreshold)
      .update({ status: 'error', error_message: 'Timed out — no response for 30 minutes', finished_at: db.fn.now() });

    const [log] = await db('attack_sync_log')
      .insert({
        domain:       'enterprise-attack',
        status:       'pending',
        triggered_by: req.user?.id ?? null,
        started_at:   db.fn.now(),
      })
      .returning('*');

    // Fire-and-forget — respond immediately with 202
    res.status(202).json({
      message: 'ATT&CK sync started',
      syncId:  log.id,
    });

    syncAttackData(log.id).catch(err =>
      logger.error(`syncAttackData unhandled error for ${log.id}: ${err.message}`)
    );
  } catch (err) {
    logger.error('triggerSync failed', err);
    return res.status(500).json({ error: 'Failed to start sync' });
  }
}

// ── Tactics ───────────────────────────────────────────────────────────────────

export async function listTactics(req, res) {
  try {
    const tactics = await getTactics();
    return res.json({ tactics });
  } catch (err) {
    logger.error('listTactics failed', err);
    return res.status(500).json({ error: 'Failed to list tactics' });
  }
}

// ── Techniques ────────────────────────────────────────────────────────────────

export async function listTechniques(req, res) {
  const {
    tactic,
    search,
    type,
    limit  = '100',
    offset = '0',
  } = req.query;

  try {
    const result = await getTechniques({
      tacticAttackId: tactic,
      search,
      type,
      limit:  Math.min(parseInt(limit,  10) || 100, 500),
      offset: parseInt(offset, 10) || 0,
    });
    return res.json(result);
  } catch (err) {
    logger.error('listTechniques failed', err);
    return res.status(500).json({ error: 'Failed to list techniques' });
  }
}

export async function getTechniqueDetails(req, res) {
  const { attackId } = req.params;
  try {
    const tech = await getTechniqueById(attackId);
    if (!tech) return res.status(404).json({ error: 'Technique not found' });
    return res.json({ technique: tech });
  } catch (err) {
    logger.error('getTechniqueDetails failed', err);
    return res.status(500).json({ error: 'Failed to get technique details' });
  }
}

// ── Groups ────────────────────────────────────────────────────────────────────

export async function listGroups(req, res) {
  const { search, limit = '100', offset = '0' } = req.query;
  try {
    const result = await getGroups({
      search,
      limit:  Math.min(parseInt(limit,  10) || 100, 500),
      offset: parseInt(offset, 10) || 0,
    });
    return res.json(result);
  } catch (err) {
    logger.error('listGroups failed', err);
    return res.status(500).json({ error: 'Failed to list groups' });
  }
}

// ── Mitigations ───────────────────────────────────────────────────────────────

export async function listMitigationsHandler(req, res) {
  const { search, limit = '100', offset = '0' } = req.query;
  try {
    const result = await getMitigations({
      search,
      limit:  Math.min(parseInt(limit,  10) || 100, 200),
      offset: parseInt(offset, 10) || 0,
    });
    return res.json(result);
  } catch (err) {
    logger.error('listMitigations failed', err);
    return res.status(500).json({ error: 'Failed to list mitigations' });
  }
}

// ── Analysis ──────────────────────────────────────────────────────────────────

export async function analyzeModel(req, res) {
  const { modelId } = req.params;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(modelId)) {
    return res.status(400).json({ error: 'modelId must be a valid UUID' });
  }

  try {
    const result = await analyzeModelCoverage(modelId);
    return res.json(result);
  } catch (err) {
    logger.error('analyzeModel failed', err);
    return res.status(500).json({ error: 'Failed to analyze model coverage' });
  }
}

// ── Mappings ──────────────────────────────────────────────────────────────────

export async function listMappingsHandler(req, res) {
  const { modelId, threatId } = req.query;
  try {
    const mappings = await listMappings({ modelId, threatId });
    return res.json({ mappings });
  } catch (err) {
    logger.error('listMappings failed', err);
    return res.status(500).json({ error: 'Failed to list mappings' });
  }
}

export async function createMappingHandler(req, res) {
  const { threat_id, technique_id, model_id, confidence, notes } = req.body;

  if (!technique_id) {
    return res.status(400).json({ error: 'technique_id is required' });
  }
  if (!model_id && !threat_id) {
    return res.status(400).json({ error: 'model_id or threat_id is required' });
  }

  const VALID_CONFIDENCE = ['high', 'medium', 'low'];
  if (confidence && !VALID_CONFIDENCE.includes(confidence)) {
    return res.status(400).json({ error: "confidence must be 'high', 'medium', or 'low'" });
  }

  try {
    const mapping = await createMapping({
      threatId:    threat_id ?? null,
      techniqueId: technique_id,
      modelId:     model_id ?? null,
      confidence:  confidence ?? 'medium',
      notes:       notes ?? null,
      userId:      req.user?.id ?? null,
    });
    return res.status(201).json({ mapping });
  } catch (err) {
    logger.error('createMapping failed', err);
    if (err.message?.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to create mapping' });
  }
}

export async function deleteMappingHandler(req, res) {
  try {
    const deleted = await deleteMapping(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Mapping not found' });
    return res.json({ message: 'Mapping deleted' });
  } catch (err) {
    logger.error('deleteMapping failed', err);
    return res.status(500).json({ error: 'Failed to delete mapping' });
  }
}

// ── Reports ───────────────────────────────────────────────────────────────────

export async function getReportHandler(req, res) {
  const { modelId } = req.params;
  try {
    const report = await generateReport(modelId, 'json');
    return res.json(report);
  } catch (err) {
    logger.error('getReport failed', err);
    if (err.message === 'Threat model not found') {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to generate report' });
  }
}

export async function exportReportHandler(req, res) {
  const { modelId } = req.params;
  const format = (req.query.format ?? 'markdown').toLowerCase();

  if (!['json', 'markdown'].includes(format)) {
    return res.status(400).json({ error: "format must be 'json' or 'markdown'" });
  }

  try {
    const model = await db('threat_models').where({ id: modelId }).first();
    if (!model) return res.status(404).json({ error: 'Threat model not found' });

    const safeName = (model.title ?? modelId).replace(/[^a-z0-9_-]/gi, '_').toLowerCase();

    if (format === 'json') {
      const report = await generateReport(modelId, 'json');
      res.setHeader('Content-Disposition', `attachment; filename="attack-report-${safeName}.json"`);
      return res.json(report);
    }

    // Markdown
    const markdown = await generateReport(modelId, 'markdown');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attack-report-${safeName}.md"`);
    return res.send(markdown);
  } catch (err) {
    logger.error('exportReport failed', err);
    return res.status(500).json({ error: 'Failed to export report' });
  }
}
