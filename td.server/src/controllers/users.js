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

  if (req.body.password && (isAdmin || isSelf)) {
    if (req.body.password.length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters' });
    }
    updates.password_hash = await bcrypt.hash(req.body.password, 12);
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
