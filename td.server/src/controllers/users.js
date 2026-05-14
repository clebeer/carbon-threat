import bcrypt from 'bcrypt';
import db from '../db/knex.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/users.js');

const ALLOWED_ROLES = ['admin', 'analyst', 'viewer', 'api_key'];
const SAFE_COLUMNS = ['id', 'org_id', 'email', 'display_name', 'role', 'is_active', 'last_login_at', 'created_at'];

/**
 * GET /api/users
 * Lists all users. Admin only.
 */
export async function listUsers(req, res) {
  try {
    const users = await db('users').select(SAFE_COLUMNS).
orderBy('created_at', 'desc');
    return res.json({ users });
  } catch (err) {
    logger.error('listUsers failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/users/:id
 * Gets a single user. Admin or self.
 */
export async function getUser(req, res) {
  const { id } = req.params;

  if (req.user.role !== 'admin' && req.user.id !== id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const user = await db('users').select(SAFE_COLUMNS).
where({ id }).
first();
    if (!user) {return res.status(404).json({ error: 'User not found' });}
    return res.json({ user });
  } catch (err) {
    logger.error('getUser failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/users
 * Creates a new user. Admin only.
 */
export async function createUser(req, res) {
  const { email, password, display_name, role = 'analyst', org_id } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(', ')}` });
  }

  if (password.length < 12) {
    return res.status(400).json({ error: 'Password must be at least 12 characters' });
  }

  try {
    const existing = await db('users').where({ email: email.toLowerCase().trim() }).
first();
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const [user] = await db('users').
      insert({
        email: email.toLowerCase().trim(),
        password_hash,
        display_name: display_name || null,
        role,
        org_id: org_id || null,
      }).
      returning(SAFE_COLUMNS);

    logger.info(`User created: ${user.email} (role=${user.role}) by admin ${req.user.id}`);
    return res.status(201).json({ user });
  } catch (err) {
    logger.error('createUser failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PUT /api/users/:id
 * Updates a user. Admin can update any field; users can only update their own display_name.
 */
export async function updateUser(req, res) {
  const { id } = req.params;
  const isAdmin = req.user.role === 'admin';
  const isSelf = req.user.id === id;

  if (!isAdmin && !isSelf) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const allowedFields = isAdmin
    ? ['email', 'display_name', 'role', 'is_active', 'org_id']
    : ['display_name'];

  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {updates[field] = req.body[field];}
  }

  // SECURITY FIX: Password changes require a dedicated endpoint with current password verification.
  // See PUT /api/users/:id/password (changePassword) below.
  // Reject any password field sent to the generic update endpoint to prevent mass assignment.
  if (req.body.password || req.body.password_hash) {
    return res.status(400).json({ error: 'Use PUT /api/users/:id/password to change passwords' });
  }

  if (updates.role && !ALLOWED_ROLES.includes(updates.role)) {
    return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(', ')}` });
  }

  if (updates.email) {
    updates.email = updates.email.toLowerCase().trim();
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  updates.updated_at = db.fn.now();

  try {
    const [user] = await db('users').where({ id }).
update(updates).
returning(SAFE_COLUMNS);
    if (!user) {return res.status(404).json({ error: 'User not found' });}

    logger.info(`User updated: ${user.email} by ${req.user.id}`);
    return res.json({ user });
  } catch (err) {
    logger.error('updateUser failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PUT /api/users/:id/password
 * Changes a user's password. Requires current password verification for self-service.
 * Admins can reset any user's password without the current password.
 */
export async function changePassword(req, res) {
  const { id } = req.params;
  const { current_password, new_password } = req.body || {};
  const isAdmin = req.user.role === 'admin';
  const isSelf = req.user.id === id;

  if (!isAdmin && !isSelf) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!new_password || new_password.length < 12) {
    return res.status(400).json({ error: 'New password must be at least 12 characters' });
  }

  try {
    const user = await db('users').where({ id }).
first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Self-service requires current password verification
    if (isSelf && !isAdmin) {
      if (!current_password) {
        return res.status(400).json({ error: 'Current password is required' });
      }
      const valid = await bcrypt.compare(current_password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    const password_hash = await bcrypt.hash(new_password, 12);
    await db('users').where({ id }).
update({
      password_hash,
      updated_at: db.fn.now(),
    });

    logger.info(`Password changed for user ${id} by ${req.user.id}${isAdmin && !isSelf ? ' (admin reset)' : ''}`);
    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    logger.error('changePassword failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /api/users/:id
 * Soft-deletes (deactivates) a user. Admin only.
 * Hard deletes are not permitted to preserve audit log referential integrity.
 */
export async function deleteUser(req, res) {
  const { id } = req.params;

  if (req.user.id === id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account' });
  }

  try {
    const [user] = await db('users').
      where({ id }).
      update({ is_active: false, updated_at: db.fn.now() }).
      returning(['id', 'email']);

    if (!user) {return res.status(404).json({ error: 'User not found' });}

    logger.info(`User deactivated: ${user.email} by admin ${req.user.id}`);
    return res.json({ message: 'User deactivated', user });
  } catch (err) {
    logger.error('deleteUser failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
