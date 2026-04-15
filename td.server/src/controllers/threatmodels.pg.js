/**
 * PostgreSQL-backed threat model controller.
 *
 * Provides CRUD for threat models stored in the `threat_models` table
 * (migration 002). Model content is encrypted at rest via AES-256-GCM
 * (security/encryption.js).
 *
 * Routes (all require Bearer auth):
 *   GET    /api/threatmodels                   → list (org-scoped)
 *   POST   /api/threatmodels                   → create
 *   GET    /api/threatmodels/:id               → get one
 *   PUT    /api/threatmodels/:id               → update
 *   DELETE /api/threatmodels/:id               → archive (soft delete)
 */

import db from '../db/knex.js';
import { decryptModel, encryptModel } from '../security/encryption.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/threatmodels.pg.js');

// ── helpers ──────────────────────────────────────────────────────────────────

function notFound(res) {
  return res.status(404).json({ error: 'Threat model not found' });
}

/**
 * Returns a base query scoped to the authenticated user's org (if set)
 * or to models owned by that user when no org is present.
 */
function scopedQuery(req) {
  const userId = req.user?.id;
  const orgId = req.user?.orgId ?? req.provider?.orgId ?? null;

  const q = db('threat_models').where({ is_archived: false });

  if (orgId) {
    return q.where({ org_id: orgId });
  }
  return q.where({ owner_id: userId });
}

// ── list ─────────────────────────────────────────────────────────────────────

export async function listThreatModels(req, res) {
  try {
    const showArchived = req.query.archived === 'true';
    const userId = req.user?.id;
    const orgId = req.user?.orgId ?? req.provider?.orgId ?? null;

    let q = db('threat_models').where({ is_archived: showArchived });
    if (orgId) {
      q = q.where({ org_id: orgId });
    } else {
      q = q.where({ owner_id: userId });
    }

    const models = await q.
      select('id', 'title', 'description', 'version', 'is_archived', 'created_at', 'updated_at', 'owner_id', 'org_id').
      orderBy('updated_at', 'desc');

    return res.json({ models });
  } catch (err) {
    logger.error('listThreatModels failed', err);
    return res.status(500).json({ error: 'Failed to list threat models' });
  }
}

// ── get one ───────────────────────────────────────────────────────────────────

export async function getThreatModel(req, res) {
  try {
    const row = await scopedQuery(req).where({ id: req.params.id }).
first();
    if (!row) {return notFound(res);}

    let content = {};
    if (row.content_encrypted) {
      try {
        content = decryptModel(JSON.parse(row.content_encrypted));
      } catch (e) {
        logger.error(`Failed to decrypt model ${req.params.id}`, e);
        return res.status(500).json({ error: 'Failed to decrypt model content' });
      }
    }

    return res.json({
      summary: {
        id:          row.id,
        title:       row.title,
        description: row.description,
        version:     row.version,
        is_archived: row.is_archived,
        created_at:  row.created_at,
        updated_at:  row.updated_at,
        owner_id:    row.owner_id,
        org_id:      row.org_id,
      },
      content,
    });
  } catch (err) {
    logger.error('getThreatModel failed', err);
    return res.status(500).json({ error: 'Failed to retrieve threat model' });
  }
}

// ── create ────────────────────────────────────────────────────────────────────

export async function createThreatModel(req, res) {
  const { title, description, content = {} } = req.body || {};

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  const userId = req.user?.id;
  // orgId may live in req.provider (set by bearer.config) or req.user — default to null
  const orgId = req.user?.orgId ?? req.provider?.orgId ?? null;

  try {
    const encrypted = encryptModel(content);

    const [model] = await db('threat_models').
      insert({
        title:             title.trim(),
        description:       description || null,
        content_encrypted: JSON.stringify(encrypted),
        owner_id:          userId,
        org_id:            orgId !== undefined ? orgId : null,
        version:           1,
      }).
      returning(['id', 'title', 'description', 'version', 'is_archived', 'created_at', 'updated_at', 'owner_id', 'org_id']);

    logger.info(`Threat model created: ${model.id} by user ${userId}`);
    return res.status(201).json({ model });
  } catch (err) {
    logger.error('createThreatModel failed', err);
    return res.status(500).json({ error: 'Failed to create threat model' });
  }
}

// ── update ────────────────────────────────────────────────────────────────────

export async function updateThreatModel(req, res) {
  const { title, description, content } = req.body || {};

  try {
    const existing = await scopedQuery(req).where({ id: req.params.id }).
first();
    if (!existing) {return notFound(res);}

    const patch = { updated_at: db.fn.now() };
    if (title !== undefined) {patch.title = title.trim();}
    if (description !== undefined) {patch.description = description;}
    if (content !== undefined) {
      patch.content_encrypted = JSON.stringify(encryptModel(content));
      patch.version = existing.version + 1;
    }

    const [model] = await db('threat_models').
      where({ id: req.params.id }).
      update(patch).
      returning(['id', 'title', 'description', 'version', 'is_archived', 'created_at', 'updated_at', 'owner_id', 'org_id']);

    return res.json({ model });
  } catch (err) {
    logger.error('updateThreatModel failed', err);
    return res.status(500).json({ error: 'Failed to update threat model' });
  }
}

// ── import (Threat Dragon v1 / v2 JSON) ───────────────────────────────────────

/**
 * Maps a Threat Dragon mxGraph cell shape string to a CarbonThreat node type.
 */
function tdShapeToNodeType(shape) {
  if (!shape) {return 'process';}
  const s = shape.toLowerCase();
  if (s.includes('actor') || s.includes('person')) {return 'actor';}
  if (s.includes('store') || s.includes('database')) {return 'datastore';}
  if (s.includes('boundary')) {return 'boundary';}
  return 'process';
}

/**
 * Converts a Threat Dragon v1/v2 JSON object into our ReactFlow content format.
 * Iterates over all diagrams and collects nodes + edges.
 */
function convertTdJson(json) {
  const nodes = [];
  const edges = [];
  const diagrams = json?.detail?.diagrams ?? [];

  diagrams.forEach((diagram) => {
    const cells = diagram.cells ?? [];
    cells.forEach((cell) => {
      // Edges have source + target
      if (cell.source && cell.target) {
        edges.push({
          id:     cell.id ?? `e-${Math.random().toString(36).
slice(2)}`,
          source: cell.source,
          target: cell.target,
          data:   { label: cell.attrs?.text?.value ?? cell.value ?? '' },
        });
      } else if (cell.id) {
        // Skip trust-boundary decorators that have no meaningful position
        const isBoundary = (cell.shape ?? '').toLowerCase().includes('boundary');
        nodes.push({
          id:       cell.id,
          type:     isBoundary ? 'boundary' : tdShapeToNodeType(cell.shape),
          position: { x: cell.position?.x ?? 0, y: cell.position?.y ?? 0 },
          data:     { label: cell.attrs?.text?.value ?? cell.value ?? 'Node' },
        });
      }
    });
  });

  return { nodes, edges };
}

export async function importThreatModel(req, res) {
  const { json } = req.body || {};

  if (!json || typeof json !== 'object') {
    return res.status(400).json({ error: 'json field with a Threat Dragon model object is required' });
  }

  const title = json.summary?.title;
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Model title is missing from the import file' });
  }

  const userId = req.user?.id;
  const orgId = req.user?.orgId ?? req.provider?.orgId ?? null;

  try {
    const content = convertTdJson(json);
    const encrypted = encryptModel(content);

    const [model] = await db('threat_models').
      insert({
        title:             String(title).trim(),
        description:       json.summary?.description || null,
        content_encrypted: JSON.stringify(encrypted),
        owner_id:          userId,
        org_id:            orgId !== undefined ? orgId : null,
        version:           1,
      }).
      returning(['id', 'title', 'description', 'version', 'is_archived', 'created_at', 'updated_at', 'owner_id', 'org_id']);

    logger.info(`Threat model imported (TD JSON): ${model.id} by user ${userId} — ${content.nodes.length} nodes, ${content.edges.length} edges`);
    return res.status(201).json({
      model,
      imported: { nodes: content.nodes.length, edges: content.edges.length },
    });
  } catch (err) {
    logger.error('importThreatModel failed', err);
    return res.status(500).json({ error: 'Failed to import threat model' });
  }
}

// ── archive (soft delete) ─────────────────────────────────────────────────────

export async function archiveThreatModel(req, res) {
  try {
    const existing = await scopedQuery(req).where({ id: req.params.id }).
first();
    if (!existing) {return notFound(res);}

    await db('threat_models').
      where({ id: req.params.id }).
      update({ is_archived: true, updated_at: db.fn.now() });

    logger.info(`Threat model archived: ${req.params.id}`);
    return res.json({ message: 'Threat model archived' });
  } catch (err) {
    logger.error('archiveThreatModel failed', err);
    return res.status(500).json({ error: 'Failed to archive threat model' });
  }
}

// ── restore (undo archive) ────────────────────────────────────────────────────

export async function restoreThreatModel(req, res) {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.orgId ?? req.provider?.orgId ?? null;

    let q = db('threat_models').where({ id: req.params.id, is_archived: true });
    if (orgId) {
      q = q.where({ org_id: orgId });
    } else {
      q = q.where({ owner_id: userId });
    }

    const existing = await q.first();
    if (!existing) {return notFound(res);}

    await db('threat_models').
      where({ id: req.params.id }).
      update({ is_archived: false, updated_at: db.fn.now() });

    logger.info(`Threat model restored: ${req.params.id}`);
    return res.json({ message: 'Threat model restored' });
  } catch (err) {
    logger.error('restoreThreatModel failed', err);
    return res.status(500).json({ error: 'Failed to restore threat model' });
  }
}
