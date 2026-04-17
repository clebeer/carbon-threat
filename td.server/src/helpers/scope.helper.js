/**
 * Shared request-scoping helpers.
 *
 * Canonical answer to "what org / user does this request belong to?"
 * — JWTs emitted in different auth flows place the claim in different
 * places (req.user.orgId, req.user.org_id, req.provider.orgId), so every
 * controller must consult the same resolver to stay consistent.
 */

import db from '../db/knex.js';

/**
 * Resolve the effective org id for the current request, or null if the
 * user is not attached to any org (personal workspace).
 */
export function getOrgId(req) {
  return (
    req.user?.orgId ??
    req.user?.org_id ??
    req.provider?.orgId ??
    req.provider?.org_id ??
    null
  );
}

export function getUserId(req) {
  return req.user?.id ?? null;
}

/**
 * Base threat_models query scoped to the requester's org (if any) or to
 * models owned by the requester. Applies `is_archived = false` by default.
 */
export function scopedThreatModels(req, { includeArchived = false } = {}) {
  const orgId = getOrgId(req);
  const userId = getUserId(req);

  const q = db('threat_models');
  if (!includeArchived) {
    q.where({ is_archived: false });
  }
  if (orgId) {
    return q.where({ org_id: orgId });
  }
  return q.where({ owner_id: userId });
}

/**
 * Ensure the current user has read/write access to the given threat model id.
 * Returns the row if permitted, or null otherwise — the caller should 404.
 */
export async function assertThreatModelAccess(req, modelId, { includeArchived = false } = {}) {
  if (!modelId) {return null;}
  const row = await scopedThreatModels(req, { includeArchived }).
    where({ id: modelId }).
    first();
  return row ?? null;
}
