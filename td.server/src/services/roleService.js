/**
 * Role Service
 *
 * CRUD for custom role profiles + grant management.
 * Delegates permission caching/invalidation to auth/permissions.js.
 *
 * Business rules enforced here:
 *  - System roles (is_system=true) cannot be edited or deleted
 *  - A role with active users cannot be deleted (require reassignment first)
 *  - Slug is auto-generated from name and must be unique
 */
/* eslint-disable max-classes-per-file */

import db from '../db/knex.js';
import loggerHelper from '../helpers/logger.helper.js';
import { invalidateCache, getEffectivePermissions } from '../auth/permissions.js';
import { allPermissionKeys } from '../auth/permissions.catalog.js';

const logger = loggerHelper.get('services/roleService.js');

// ── Typed errors ──────────────────────────────────────────────────────────────

/* eslint-disable max-classes-per-file */

export class RoleNotFoundError extends Error {
  constructor(id) {
    super(`Role not found: ${id}`);
    this.code = 'ROLE_NOT_FOUND';
  }
}

export class SystemRoleError extends Error {
  constructor(action) {
    super(`Cannot ${action} a system role`);
    this.code = 'SYSTEM_ROLE';
  }
}

export class RoleInUseError extends Error {
  constructor(slug, count) {
    super(`Role "${slug}" is assigned to ${count} user(s). Reassign them before deleting.`);
    this.code = 'ROLE_IN_USE';
  }
}

export class SlugConflictError extends Error {
  constructor(slug) {
    super(`A role with slug "${slug}" already exists`);
    this.code = 'SLUG_CONFLICT';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generates a URL-safe slug from a display name.
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  return name.
    toLowerCase().
    trim().
    replace(/[^a-z0-9]+/g, '-').
    replace(/^-+/, '').
    replace(/-+$/, '').
    slice(0, 50);
}

/**
 * Ensures a slug is unique by appending a numeric suffix if needed.
 * @param {string} base
 * @returns {Promise<string>}
 */
async function uniqueSlug(base) {
  let candidate = base;
  let suffix = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await db('roles').where({ slug: candidate }).
first();
    if (!existing) {return candidate;}
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

// ── Service methods ───────────────────────────────────────────────────────────

/**
 * List all active roles with their permission_keys and user_count.
 * @returns {Promise<Array>}
 */
export async function listRoles() {
  const roles = await db('roles').
    where({ is_active: true }).
    orderBy([{ column: 'is_system', order: 'desc' }, { column: 'name', order: 'asc' }]).
    select('*');

  const grants = await db('role_permissions').
    whereIn('role_id', roles.map((r) => r.id)).
    select('role_id', 'permission_key');

  // Group permission keys by role_id
  const keysByRole = {};
  for (const g of grants) {
    if (!keysByRole[g.role_id]) {keysByRole[g.role_id] = [];}
    keysByRole[g.role_id].push(g.permission_key);
  }

  // User counts
  const counts = await db('users').
    whereIn('role', roles.map((r) => r.slug)).
    groupBy('role').
    count('id as user_count').
    select('role');
  const countBySlug = Object.fromEntries(counts.map((c) => [c.role, parseInt(c.user_count, 10)]));

  return roles.map((r) => ({
    ...r,
    permission_keys: keysByRole[r.id] ?? [],
    user_count:      countBySlug[r.slug] ?? 0,
  }));
}

/**
 * Get a single role with permission_keys and user_count.
 * @param {string} id  UUID
 * @returns {Promise<Object>}
 */
export async function getRole(id) {
  const role = await db('roles').where({ id }).
first();
  if (!role) {throw new RoleNotFoundError(id);}

  const grants = await db('role_permissions').
    where({ role_id: id }).
    pluck('permission_key');

  const [countRow] = await db('users').
    where({ role: role.slug }).
    count('id as user_count');

  return {
    ...role,
    permission_keys: grants,
    user_count: parseInt(countRow?.user_count ?? '0', 10),
  };
}

/**
 * Create a new custom role.
 * @param {{ name: string, description?: string, permission_keys?: string[] }} data
 * @returns {Promise<Object>}
 */
export async function createRole({ name, description = '', permission_keys = [] }) {
  if (!name?.trim()) {
    throw new Error('name is required');
  }

  // Validate keys against the catalog
  const validKeys = new Set(allPermissionKeys());
  const invalid = permission_keys.filter((k) => !validKeys.has(k));
  if (invalid.length > 0) {
    throw new Error(`Unknown permission keys: ${invalid.join(', ')}`);
  }

  const base = slugify(name);
  const slug = await uniqueSlug(base);

  return db.transaction(async (trx) => {
    const [role] = await trx('roles').
      insert({ slug, name: name.trim(), description, is_system: false }).
      returning('*');

    if (permission_keys.length > 0) {
      await trx('role_permissions').insert(
        permission_keys.map((permission_key) => ({ role_id: role.id, permission_key }))
      );
    }

    invalidateCache(slug);
    logger.info(`Role created: ${slug} (${role.id})`);
    return { ...role, permission_keys };
  });
}

/**
 * Update an existing custom role.
 * @param {string} id
 * @param {{ name?: string, description?: string, permission_keys?: string[] }} data
 * @returns {Promise<Object>}
 */
export async function updateRole(id, { name, description, permission_keys }) {
  const role = await db('roles').where({ id }).
first();
  if (!role) {throw new RoleNotFoundError(id);}
  if (role.is_system) {throw new SystemRoleError('update');}

  // Validate keys
  if (permission_keys !== undefined) {
    const validKeys = new Set(allPermissionKeys());
    const invalid = permission_keys.filter((k) => !validKeys.has(k));
    if (invalid.length > 0) {
      throw new Error(`Unknown permission keys: ${invalid.join(', ')}`);
    }
  }

  return db.transaction(async (trx) => {
    const updates = {};
    if (name !== undefined) {updates.name = name.trim();}
    if (description !== undefined) {updates.description = description;}
    if (Object.keys(updates).length > 0) {updates.updated_at = db.fn.now();}

    let updated = role;
    if (Object.keys(updates).length > 0) {
      [updated] = await trx('roles').where({ id }).
update(updates).
returning('*');
    }

    if (permission_keys !== undefined) {
      await trx('role_permissions').where({ role_id: id }).
delete();
      if (permission_keys.length > 0) {
        await trx('role_permissions').insert(
          permission_keys.map((permission_key) => ({ role_id: id, permission_key }))
        );
      }
    }

    invalidateCache(role.slug);
    const finalKeys = permission_keys ?? await trx('role_permissions').where({ role_id: id }).
pluck('permission_key');
    logger.info(`Role updated: ${role.slug} (${id})`);
    return { ...updated, permission_keys: finalKeys };
  });
}

/**
 * Delete a custom role.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteRole(id) {
  const role = await db('roles').where({ id }).
first();
  if (!role) {throw new RoleNotFoundError(id);}
  if (role.is_system) {throw new SystemRoleError('delete');}

  // Check for users assigned to this role
  const [{ user_count }] = await db('users').where({ role: role.slug }).
count('id as user_count');
  const count = parseInt(user_count, 10);
  if (count > 0) {throw new RoleInUseError(role.slug, count);}

  await db('roles').where({ id }).
delete();
  invalidateCache(role.slug);
  logger.info(`Role deleted: ${role.slug} (${id})`);
}

/**
 * Returns effective permissions for a user (admin → all keys; others → DB grants).
 * @param {{ role: string }} user
 * @returns {Promise<string[]>}
 */
export { getEffectivePermissions };
