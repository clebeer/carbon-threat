/**
 * Roles Controller — HTTP route handlers for the Custom Role Profiles feature.
 *
 * Delegates all logic to roleService; mirrors the controller style of users.js
 * (logger, try/catch, status codes).
 */
import * as roleService from '../services/roleService.js';
import { getPermissionCatalog } from '../auth/permissions.catalog.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/rolesController.js');

/**
 * GET /api/roles
 * List all roles with permission keys and user counts.
 */
export async function listRoles(req, res) {
  try {
    const roles = await roleService.listRoles();
    return res.json({ roles });
  } catch (err) {
    logger.error('listRoles failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/roles/:id
 * Get a single role by ID.
 */
export async function getRole(req, res) {
  try {
    const role = await roleService.getRole(req.params.id);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    return res.json({ role });
  } catch (err) {
    logger.error('getRole failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/roles
 * Create a new custom role.
 */
export async function createRole(req, res) {
  try {
    const role = await roleService.createRole(req.body);
    logger.info(`Role created: ${role.name} by user ${req.user?.id}`);
    return res.status(201).json({ role });
  } catch (err) {
    if (err.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ error: err.message });
    }
    logger.error('createRole failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PUT /api/roles/:id
 * Update a custom role.
 */
export async function updateRole(req, res) {
  try {
    const role = await roleService.updateRole(req.params.id, req.body);
    return res.json({ role });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === 'SYSTEM_ROLE_IMMUTABLE') {
      return res.status(409).json({ error: err.message });
    }
    if (err.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ error: err.message });
    }
    logger.error('updateRole failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /api/roles/:id
 * Delete a custom role.
 */
export async function deleteRole(req, res) {
  try {
    await roleService.deleteRole(req.params.id);
    return res.json({ message: 'Role deleted' });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === 'SYSTEM_ROLE_IMMUTABLE' || err.code === 'ROLE_IN_USE') {
      return res.status(409).json({ error: err.message });
    }
    logger.error('deleteRole failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/permissions
 * Return the full permission catalog for the UI matrix editor.
 */
export async function listPermissionCatalog(req, res) {
  try {
    const permissions = getPermissionCatalog();
    return res.json({ permissions });
  } catch (err) {
    logger.error('listPermissionCatalog failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}