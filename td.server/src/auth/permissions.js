/**
 * Permission-based enforcement middleware
 *
 * Provides requirePermission(...keys) — a drop-in replacement for requireRole()
 * that resolves permission grants from the DB with an in-memory cache.
 *
 * Design:
 *  - admin role has a full bypass (no DB query needed)
 *  - Cache: Map<slug, { set: Set<string>, expires: number }> with 60s TTL
 *  - Explicit invalidation via invalidateCache(slug?) for immediate effect on grant edits
 *  - requireRole() in rbac.js remains available for backward compatibility
 */

import db from '../db/knex.js';
import loggerHelper from '../helpers/logger.helper.js';
import { allPermissionKeys } from './permissions.catalog.js';

const logger = loggerHelper.get('auth/permissions.js');

const CACHE_TTL_MS = 60_000; // 60 seconds

/** @type {Map<string, { set: Set<string>, expires: number }>} */
const cache = new Map();

/**
 * Resolves the permission Set for the given role slug.
 * Results are cached for CACHE_TTL_MS.
 *
 * @param {string} slug
 * @returns {Promise<Set<string>>}
 */
async function resolvePermissions(slug) {
  const now = Date.now();
  const cached = cache.get(slug);
  if (cached && cached.expires > now) {
    return cached.set;
  }

  const rows = await db('role_permissions').
    join('roles', 'roles.id', 'role_permissions.role_id').
    where('roles.slug', slug).
    select('role_permissions.permission_key');

  const set = new Set(rows.map((r) => r.permission_key));
  cache.set(slug, { set, expires: now + CACHE_TTL_MS });
  return set;
}

/**
 * Invalidates the permission cache for a specific role slug, or clears the
 * entire cache when called without arguments.  Call this whenever grants change.
 *
 * @param {string} [slug]
 */
export function invalidateCache(slug) {
  if (slug) {
    cache.delete(slug);
  } else {
    cache.clear();
  }
}

/**
 * Express middleware factory.
 * Passes if the authenticated user's role has at least one of the given keys.
 *
 * - 401 when there is no authenticated user (req.user absent)
 * - 403 when the role lacks all requested permissions
 * - admin role has a full bypass (no DB look-up performed)
 *
 * Usage:
 *   router.get('/api/roles', requirePermission('roles:manage'), handler);
 *   router.post('/api/users', requirePermission('users:manage'), handler);
 *
 * @param {...string} keys  One or more permission keys (logical OR)
 * @returns {import('express').RequestHandler}
 */
export const requirePermission = (...keys) => async (req, res, next) => {
  if (!req.user) {
    logger.warn(`PERM: unauthenticated request to ${req.method} ${req.path}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // admin always passes
  if (req.user.role === 'admin') {
    return next();
  }

  try {
    const perms = await resolvePermissions(req.user.role);
    const allowed = keys.some((k) => perms.has(k));

    if (!allowed) {
      logger.warn(
        `PERM: user ${req.user.id} (role=${req.user.role}) denied ` +
        `${req.method} ${req.path} — requires one of [${keys.join(', ')}]`
      );
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }

    return next();
  } catch (err) {
    logger.error('requirePermission: DB error resolving permissions', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Returns the effective permission keys for a user object.
 * admin → all catalog keys; others → DB-resolved grants.
 *
 * @param {{ role: string }} user
 * @returns {Promise<string[]>}
 */
export async function getEffectivePermissions(user) {
  if (user.role === 'admin') {
    return allPermissionKeys();
  }
  try {
    const perms = await resolvePermissions(user.role);
    return [...perms];
  } catch (err) {
    logger.error('getEffectivePermissions: DB error', err);
    return [];
  }
}
