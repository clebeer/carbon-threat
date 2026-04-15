/**
 * Audit log controller.
 *
 * Routes (admin-only):
 *   GET /api/audit?page=1&limit=25   — paginated audit trail
 */

import db from '../db/knex.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/auditController.js');

export async function listAuditLogs(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '25', 10)));
  const offset = (page - 1) * limit;

  try {
    const [logs, countRow] = await Promise.all([
      db('audit_logs').
        select('id', 'action', 'entity_type', 'entity_id', 'user_id', 'ip_address', 'http_status', 'created_at').
        orderBy('created_at', 'desc').
        limit(limit).
        offset(offset),
      db('audit_logs').count('id as n').
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
