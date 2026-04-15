import db from '../db/knex.js';

export async function logAudit(action, userId, resourceId, details, ipAddress) {
  try {
    await db('audit_logs').insert({
      action,
      user_id:    userId === 'anonymous' ? null : userId,
      entity_id:  resourceId === 'N/A' ? null : resourceId,
      diff:       JSON.stringify(details),
      ip_address: ipAddress,
    });
  } catch (err) {
    console.error('Failed to write audit log', err);
  }
}

export const auditMiddleware = (actionProvider) => async (req, res, next) => {
    // Fire and forget logging
    const action = typeof actionProvider === 'function' ? actionProvider(req) : actionProvider;
    const userId = req.user ? req.user.id : 'anonymous';
    const resourceId = req.params.id || 'N/A';
    
    const originalSend = res.send;
    res.send = function (data) {
      logAudit(action, userId, resourceId, { body: req.body, statusCode: res.statusCode }, req.ip);
      originalSend.call(this, data);
    };
    next();
  };
