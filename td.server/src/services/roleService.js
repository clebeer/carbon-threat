/**
 * Role Service — Business logic for custom role management.
 *
 * Handles CRUD for roles and their permission grants, plus resolving
 * the effective permission set for a given user.
 */
import db from '../db/knex.js';
import { allPermissionKeys } from '../auth/permissions.catalog.js';
import { invalidateCache } from '../auth/permissions.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('services/roleService.js');

// ── Typed / coded errors ──────────────────────────────────────────────────────

class RoleError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = 'RoleError';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generate a URL-safe slug from a role name.
 * e.g. "Security Reviewer" → "security-reviewer"
 * Appends a short random suffix if needed for uniqueness.
 */
async function generateSlug(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Check if slug already exists
  const existing = await db('roles').where({ slug: base }).first();
  if (!existing) return base;

  // Append random suffix
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${suffix}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * List all roles with user counts.
 * @returns {Promise<Array>} roles with permission_keys and user_count
 */
export async function listRoles() {
  const roles = await db('roles')
    .select([
      'roles.id', 'roles.slug', 'roles.name', 'roles.description',
      'roles.is_system', 'roles.is_active', 'roles.created_at', 'roles.updated_at',
      db.raw('COUNT(DISTINCT users.id)::int as user_count'),
    ])
    .leftJoin('users', 'users.role', 'roles.slug')
    .groupBy('roles.id')
    .orderBy('roles.is_system', 'desc')
    .orderBy('roles.name', 'asc');

  // Attach permission_keys to each role
  for (const role of roles) {
    role.permission_keys = await db('role_permissions')
      .where({ role_id: role.id })
      .pluck('permission_key');
  }

  return roles;
}

/**
 * Get a single role by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getRole(id) {
  const role = await db('roles')
    .where({ id })
    .first();

  if (!role) return null;

  role.permission_keys = await db('role_permissions')
    .where({ role_id: id })
    .pluck('permission_key');

  return role;
}

/**
 * Create a new custom role.
 * @param {{ name: string, description?: string, permission_keys: string[] }} data
 * @returns {Promise<Object>} created role
 */
export async function createRole(data) {
  if (!data.name || !data.name.trim()) {
    throw new RoleError('name is required', 'VALIDATION_ERROR');
  }

  const validKeys = new Set(allPermissionKeys());
  const invalidKeys = (data.permission_keys || []).filter((k) => !validKeys.has(k));
  if (invalidKeys.length > 0) {
    throw new RoleError(`Invalid permission keys: ${invalidKeys.join(', ')}`, 'VALIDATION_ERROR');
  }

  const slug = await generateSlug(data.name);

  return await db.transaction(async (trx) => {
    const [role] = await trx('roles')
      .insert({
        slug,
        name: data.name.trim(),
        description: data.description || null,
        is_system: false,
        is_active: true,
      })
      .returning(['id', 'slug', 'name', 'description', 'is_system', 'is_active', 'created_at', 'updated_at']);

    if (data.permission_keys && data.permission_keys.length > 0) {
      const perms = data.permission_keys.map((key) => ({
        role_id: role.id,
        permission_key: key,
      }));
      await trx('role_permissions').insert(perms);
    }

    role.permission_keys = data.permission_keys || [];

    logger.info(`Custom role created: ${role.name} (${role.slug})`);
    return role;
  });
}

/**
 * Update a custom role's metadata and/or permission grants.
 * Rejects system roles.
 *
 * @param {string} id
 * @param {{ name?: string, description?: string, permission_keys?: string[], is_active?: boolean }} data
 * @returns {Promise<Object>} updated role
 */
export async function updateRole(id, data) {
  const role = await db('roles').where({ id }).first();
  if (!role) {
    throw new RoleError('Role not found', 'NOT_FOUND');
  }
  if (role.is_system) {
    throw new RoleError('System roles cannot be modified', 'SYSTEM_ROLE_IMMUTABLE');
  }

  // Validate permission keys if provided
  if (data.permission_keys) {
    const validKeys = new Set(allPermissionKeys());
    const invalidKeys = data.permission_keys.filter((k) => !validKeys.has(k));
    if (invalidKeys.length > 0) {
      throw new RoleError(`Invalid permission keys: ${invalidKeys.join(', ')}`, 'VALIDATION_ERROR');
    }
  }

  return await db.transaction(async (trx) => {
    const updates = {};
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.description !== undefined) updates.description = data.description;
    if (data.is_active !== undefined) updates.is_active = data.is_active;
    updates.updated_at = trx.fn.now();

    if (Object.keys(updates).length > 1) { // more than just updated_at
      await trx('roles').where({ id }).update(updates);
    }

    // Replace permission keys if provided
    if (data.permission_keys) {
      await trx('role_permissions').where({ role_id: id }).del();
      if (data.permission_keys.length > 0) {
        const perms = data.permission_keys.map((key) => ({
          role_id: id,
          permission_key: key,
        }));
        await trx('role_permissions').insert(perms);
      }
    }

    // Invalidate cache for this role's slug
    invalidateCache(role.slug);

    // Fetch updated role
    const updated = await trx('roles').where({ id }).first();
    updated.permission_keys = await trx('role_permissions')
      .where({ role_id: id })
      .pluck('permission_key');

    logger.info(`Role updated: ${updated.name} (${updated.slug})`);
    return updated;
  });
}

/**
 * Delete a custom role.
 * Rejects system roles and roles still in use by any user.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteRole(id) {
  const role = await db('roles').where({ id }).first();
  if (!role) {
    throw new RoleError('Role not found', 'NOT_FOUND');
  }
  if (role.is_system) {
    throw new RoleError('System roles cannot be deleted', 'SYSTEM_ROLE_IMMUTABLE');
  }

  // Check if any user references this role slug
  const { count } = await db('users')
    .where({ role: role.slug, is_active: true })
    .count('id as count')
    .first();

  if (parseInt(count, 10) > 0) {
    throw new RoleError(
      `Cannot delete role "${role.name}" — ${count} active user(s) are assigned. Reassign them first.`,
      'ROLE_IN_USE'
    );
  }

  await db('roles').where({ id }).del();
  invalidateCache(role.slug);
  logger.info(`Role deleted: ${role.name} (${role.slug})`);
}

/**
 * Get the effective permission keys for a user.
 * Admin gets all keys; other roles get keys from DB.
 *
 * @param {{ role: string }} user
 * @returns {Promise<string[]>}
 */
export async function getEffectivePermissions(user) {
  if (!user || !user.role) return [];

  // Admin gets every permission
  if (user.role === 'admin') {
    return allPermissionKeys();
  }

  // Non-admin: load from DB via roles/role_permissions
  const rows = await db('role_permissions')
    .select('role_permissions.permission_key')
    .join('roles', 'roles.id', 'role_permissions.role_id')
    .where('roles.slug', user.role)
    .andWhere('roles.is_active', true)
    .pluck('permission_key');

  return rows;
}