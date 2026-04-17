import bcrypt from 'bcrypt';
import db from '../db/knex.js';
import jwtHelper from '../helpers/jwt.helper.js';
import loggerHelper from '../helpers/logger.helper.js';
import tokenRepo from '../repositories/token.js';

const logger = loggerHelper.get('controllers/auth.enterprise.js');

/**
 * POST /api/auth/local/login
 * Authenticates a user with email + password and returns a JWT pair.
 * Compatible with the existing bearer.config.js middleware — the access token
 * can be used in Authorization: Bearer <token> headers for all protected routes.
 */
export async function localLogin(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const user = await db('users').
      where({ email: email.toLowerCase().trim(), is_active: true }).
      first();

    // Constant-time-ish: always run bcrypt even when no user found to prevent timing attacks
    const dummyHash = '$2b$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXXX';
    const valid = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, dummyHash).then(() => false);

    if (!user || !valid) {
      logger.warn(`Failed login attempt for email: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = await jwtHelper.createAsync(
      'local',
      { type: 'local', orgId: user.org_id || null },
      { id: user.id, email: user.email, role: user.role, orgId: user.org_id || null }
    );

    // Update last_login_at without blocking the response
    db('users').where({ id: user.id }).
update({ last_login_at: db.fn.now() }).
catch(
      (err) => logger.error('Failed to update last_login_at', err)
    );

    // Register the refresh token so /api/token/refresh can validate it
    await tokenRepo.add(refreshToken);

    logger.info(`Successful login: ${user.email} (role=${user.role})`);
    return res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    logger.error('Error during local login', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/auth/local/register
 * Creates the first admin account when no users exist yet (bootstrap only).
 * Once any user exists this endpoint returns 403 — use the admin UI thereafter.
 */
export async function bootstrapAdmin(req, res) {
  try {
    const count = await db('users').count('id as n').
first();
    if (parseInt(count.n, 10) > 0) {
      return res.status(403).json({ error: 'Bootstrap is only allowed when no users exist' });
    }

    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    if (password.length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const [user] = await db('users').
      insert({ email: email.toLowerCase().trim(), password_hash, role: 'admin' }).
      returning(['id', 'email', 'role']);

    logger.info(`Bootstrap admin created: ${user.email}`);
    return res.status(201).json({ message: 'Admin account created', user });
  } catch (err) {
    logger.error('Error during admin bootstrap', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
