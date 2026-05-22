/**
 * Roles Controller
 *
 * HTTP handlers for the custom role profiles feature.
 *
 * Routes (all behind bearer middleware + requirePermission('roles:manage')):
 *   GET    /api/roles            — list all roles with grants + user counts
 *   GET    /api/roles/:id        — get a single role
 *   POST   /api/roles            — create a custom role
 *   PUT    /api/roles/:id        — update a custom role
 *   DELETE /api/roles/:id        — delete a custom role
 *   GET    /api/permissions      — list the permission catalog for the UI matrix
 */

import loggerHelper from '../helpers/logger.helper.js';
import { groupedCatalog } from '../auth/permissions.catalog.js';
import {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  RoleNotFoundError,
  SystemRoleError,
  RoleInUseError,
  SlugConflictError,
} from '../services/roleService.js';

const logger = loggerHelper.get('controllers/rolesController.js');

// ── GET /api/roles ─────────────────────────────────────────────────────────────

export async function listRolesHandler(req, res) {
  try {
    const roles = await listRoles();
    return res.json({ roles });
  } catch (err) {
    logger.error('listRoles failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── GET /api/roles/:id ─────────────────────────────────────────────────────────

export async function getRoleHandler(req, res) {
  try {
    const role = await getRole(req.params.id);
    return res.json({ role });
  } catch (err) {
    if (err instanceof RoleNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    logger.error('getRole failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── POST /api/roles ────────────────────────────────────────────────────────────

export async function createRoleHandler(req, res) {
  const { name, description, permission_keys } = req.body || {};

  if (!name?.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const role = await createRole({ name, description, permission_keys });
    return res.status(201).json({ role });
  } catch (err) {
    if (err instanceof SlugConflictError) {
      return res.status(409).json({ error: err.message });
    }
    if (err.message?.startsWith('Unknown permission keys')) {
      return res.status(400).json({ error: err.message });
    }
    logger.error('createRole failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── PUT /api/roles/:id ─────────────────────────────────────────────────────────

export async function updateRoleHandler(req, res) {
  const { name, description, permission_keys } = req.body || {};

  try {
    const role = await updateRole(req.params.id, { name, description, permission_keys });
    return res.json({ role });
  } catch (err) {
    if (err instanceof RoleNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof SystemRoleError) {
      return res.status(409).json({ error: err.message });
    }
    if (err.message?.startsWith('Unknown permission keys')) {
      return res.status(400).json({ error: err.message });
    }
    logger.error('updateRole failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── DELETE /api/roles/:id ──────────────────────────────────────────────────────

export async function deleteRoleHandler(req, res) {
  try {
    await deleteRole(req.params.id);
    return res.json({ message: 'Role deleted' });
  } catch (err) {
    if (err instanceof RoleNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof SystemRoleError) {
      return res.status(409).json({ error: err.message });
    }
    if (err instanceof RoleInUseError) {
      return res.status(409).json({ error: err.message });
    }
    logger.error('deleteRole failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── GET /api/permissions ───────────────────────────────────────────────────────

export function listPermissionCatalogHandler(req, res) {
  return res.json({ permissions: groupedCatalog() });
}
