/**
 * Permission-based authorization middleware.
 *
 * Resolves a role's permission set from the DB via an in-memory cache
 * with ~60 s TTL.  Admin role bypasses all checks.
 *
 * Coexists with the legacy requireRole() from rbac.js.
 */
import loggerHelper from '../helpers/logger.helper.js';
import db from '../db/knex.js';

const logger = loggerHelper.get('auth/permissions.js');

// ── In-memory cache ───────────────────────────────────────────────────────────
// Map<slug, { set: Set<key>, expires: number }>

const CACHE_TTL_MS = 60_000; // 60 seconds
const permissionCache = new Map();

/**
 * Reset the entire cache (for testing).
 * @private
 */
export function __resetCache() {
  permissionCache.clear();
}

/**
 * Invalidate cache for a specific role slug, or the entire cache if no arg.
 * Called after any role/permission mutation.
 *
 * @param {string} [slug] — role slug to invalidate; omit to clear all.
 */
export function invalidateCache(slug) {
  if (slug) {
    permissionCache.delete(slug);
  } else {
    permissionCache.clear();
  }
}

/**
 * Resolve the set of permission keys for a given role slug.
 * Uses the in-memory cache with TTL; falls back to DB.
 *
 * @param {string} slug
 * @returns {Promise<Set<string>>}
 */
async function resolvePermissions(slug) {
  const cached = permissionCache.get(slug);
  if (cached && cached.expires > Date.now()) {
    return cached.set;
  }

  // Load from DB: join role_permissions + roles by slug
  const rows = await db('role_permissions')
    .select('role_permissions.permission_key')
    .join('roles', 'roles.id', 'role_permissions.role_id')
    .where('roles.slug', slug)
    .andWhere('roles.is_active', true);

  const set = new Set(rows.map((r) => r.permission_key));
  permissionCache.set(slug, { set, expires: Date.now() + CACHE_TTL_MS });
  return set;
}

/**
 * Express middleware factory that enforces fine-grained permission-based access.
 *
 * Usage:
 *   router.get('/api/roles', requirePermission('roles:manage'), handler);
 *   router.post('/api/threatmodels', requirePermission('threatmodel:create'), handler);
 *
 * Behaviour:
 *   - 401 if no req.user
 *   - Admin bypass: if req.user.role === 'admin' → next()
 *   - Otherwise resolve the role's permission set from cache/DB
 *   - 403 if none of the provided keys match
 *
 * @param {...string} keys — one or more permission keys (OR semantics)
 * @returns {import('express').RequestHandler}
 */
export const requirePermission = (...keys) => async (req, res, next) => {
  if (!req.user) {
    logger.warn(`Permission: unauthenticated request to ${req.method} ${req.path}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Admin bypass — full access
  if (req.user.role === 'admin') {
    return next();
  }

  try {
    const permSet = await resolvePermissions(req.user.role);

    // Check if any of the required keys are present (OR)
    const hasPermission = keys.some((key) => permSet.has(key));

    if (!hasPermission) {
      logger.warn(
        `Permission: user ${req.user.id} (role=${req.user.role}) denied access to ` +
        `${req.method} ${req.path} — requires one of [${keys.join(', ')}]`
      );
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }

    return next();
  } catch (err) {
    logger.error('Permission resolution error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};