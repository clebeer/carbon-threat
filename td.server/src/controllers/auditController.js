/**
 * Audit log controller.
 *
 * Routes (admin-only):
 *   GET /api/audit?page=1&limit=25&action=&entity_type=&user_id=&from=&to=
 *   GET /api/audit/export?format=csv|json|cef|leef|ecs  (+ same filter params)
 */

import db from '../db/knex.js';
import { exportAuditLogs } from '../services/auditExportService.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/auditController.js');

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Applies optional filter query params to a Knex query builder.
 * Returns the augmented query; does NOT validate from/to ordering here.
 */
function applyFilters(query, { action, entity_type, user_id, from, to }) {
  let q = query;
  if (action) {q = q.where('action', action);}
  if (entity_type) {q = q.where('entity_type', entity_type);}
  if (user_id) {q = q.where('user_id', user_id);}
  if (from) {q = q.where('created_at', '>=', new Date(from));}
  if (to) {q = q.where('created_at', '<=', new Date(to));}
  return q;
}

function extractFilters(query) {
  return {
    action:      query.action || '',
    entity_type: query.entity_type || '',
    user_id:     query.user_id || '',
    from:        query.from || '',
    to:          query.to || '',
  };
}

// ── Handlers ───────────────────────────────────────────────────────────────

export async function listAuditLogs(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '25', 10)));
  const offset = (page - 1) * limit;
  const filters = extractFilters(req.query);

  // Validate date range
  if (filters.from && filters.to && new Date(filters.from) > new Date(filters.to)) {
    return res.status(400).json({ error: '`from` must be before `to`' });
  }

  try {
    const baseQuery = () => applyFilters(db('audit_logs'), filters);

    const [logs, countRow] = await Promise.all([
      baseQuery().
        select('id', 'action', 'entity_type', 'entity_id', 'user_id', 'ip_address', 'http_status', 'created_at').
        orderBy('created_at', 'desc').
        limit(limit).
        offset(offset),
      baseQuery().count('id as n').
first(),
    ]);

    return res.json({
      logs,
      total: parseInt(countRow.n, 10),
      page,
      limit,
    });
  } catch (err) {
    logger.error('listAuditLogs failed', err);
    return res.status(500).json({ error: 'Failed to load audit logs' });
  }
}

export async function exportAuditLogsHandler(req, res) {
  const { format = 'csv' } = req.query;
  const validFormats = ['csv', 'json', 'cef', 'leef', 'ecs'];

  if (!validFormats.includes(format)) {
    return res.status(400).json({ error: `format must be one of: ${validFormats.join(', ')}` });
  }

  const filters = extractFilters(req.query);

  if (filters.from && filters.to && new Date(filters.from) > new Date(filters.to)) {
    return res.status(400).json({ error: '`from` must be before `to`' });
  }

  try {
    const { contentType, filename, body } = await exportAuditLogs(filters, format, db);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(body);
  } catch (err) {
    if (err.status === 400) {return res.status(400).json({ error: err.message });}
    logger.error('exportAuditLogsHandler failed', err);
    return res.status(500).json({ error: 'Failed to export audit logs' });
  }
}
