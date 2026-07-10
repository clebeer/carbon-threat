/**
 * Tenant scoping (multi-tenancy) — Carbon Dojo
 *
 * Enforces org-level isolation for the vulnerability-management domain. The design
 * rule (ADR 0001, Decision 3) is DENY-BY-DEFAULT: a principal with no resolvable
 * tenant scope is refused rather than treated as "Global". This closes the pentest
 * findings where authorization fell back to Global (BOLA/IDOR — CD-02/CD-04/f17/f18).
 *
 * `req.user` is set by bearer.config.js from the verified JWT. Both human users and
 * service accounts carry an `orgId` (users.org_id / service_accounts.org_id).
 */

import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('auth/tenantScope.js');

export class TenantScopeError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'TenantScopeError';
    this.status = 403;
    this.code = code;
  }
}

/**
 * Resolves the tenant org id for a principal. Returns null when absent — callers
 * MUST treat null as "deny", never as global access.
 * @param {object|null|undefined} principal
 * @returns {string|null}
 */
export function principalOrgId(principal) {
  if (!principal) {return null;}
  return principal.orgId ?? principal.org_id ?? null;
}

/**
 * Throws unless `principal` may access `resource` (same tenant). Deny-by-default:
 *   - principal without a tenant scope  → deny (no_scope)
 *   - resource without a tenant scope   → deny (resource_no_scope)
 *   - principal.org !== resource.org    → deny (cross_tenant)
 * @param {object} principal
 * @param {object} resource  object exposing orgId / org_id
 * @returns {true}
 */
export function assertTenantAccess(principal, resource) {
  const pOrg = principalOrgId(principal);
  if (!pOrg) {throw new TenantScopeError('Principal has no tenant scope', 'no_scope');}

  const rOrg = resource ? (resource.orgId ?? resource.org_id ?? null) : null;
  if (!rOrg) {throw new TenantScopeError('Resource has no tenant scope', 'resource_no_scope');}

  if (pOrg !== rOrg) {throw new TenantScopeError('Cross-tenant access denied', 'cross_tenant');}
  return true;
}

/**
 * Applies the tenant predicate to a Knex query builder so every read/write is scoped
 * to the principal's org. Throws (rather than returning an unscoped query) when the
 * principal has no scope.
 * @param {import('knex').Knex.QueryBuilder} query
 * @param {object} principal
 * @param {string} [column='org_id']
 * @returns {import('knex').Knex.QueryBuilder}
 */
export function scopeQuery(query, principal, column = 'org_id') {
  const pOrg = principalOrgId(principal);
  if (!pOrg) {throw new TenantScopeError('Principal has no tenant scope', 'no_scope');}
  return query.where(column, pOrg);
}

/**
 * Express middleware — requires an authenticated principal WITH a tenant scope.
 * Sets req.orgId for downstream handlers. 401 when unauthenticated, 403 when scopeless.
 * @type {import('express').RequestHandler}
 */
export const requireTenantScope = (req, res, next) => {
  const principal = req.user;
  if (!principal) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const orgId = principalOrgId(principal);
  if (!orgId) {
    logger.warn(
      `Tenant scope missing for principal ${principal.id ?? '?'} on ${req.method} ${req.path} — denied`,
    );
    return res.status(403).json({ error: 'Forbidden: no tenant scope' });
  }
  req.orgId = orgId;
  return next();
};
