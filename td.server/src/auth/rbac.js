import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('auth/rbac.js');

/**
 * Express middleware factory that enforces role-based access control.
 *
 * Usage:
 *   router.delete('/api/users/:id', requireRole('admin'), handler);
 *   router.post('/api/threatmodel', requireRole('admin', 'analyst'), handler);
 *
 * Role hierarchy (most → least privileged):
 *   admin   — full access
 *   analyst — create / edit threat models
 *   viewer  — read-only access to threat models
 *   api_key — machine-to-machine integrations (scoped per key)
 *
 * req.user is set by bearer.config.js middleware from the verified JWT payload.
 *
 * @param {...string} roles - One or more roles that are permitted.
 * @returns {import('express').RequestHandler}
 */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    logger.warn(`RBAC: unauthenticated request to ${req.method} ${req.path}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!roles.includes(req.user.role)) {
    logger.warn(
      `RBAC: user ${req.user.id} (role=${req.user.role}) denied access to ` +
      `${req.method} ${req.path} — requires one of [${roles.join(', ')}]`
    );
    return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
  }

  return next();
};
