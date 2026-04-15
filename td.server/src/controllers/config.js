import bcrypt from 'bcrypt';
import { Client } from 'pg';
import Knex from 'knex';
import db from '../db/knex.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/config.js');

/**
 * POST /api/config/test-db
 *
 * Validates external PostgreSQL credentials supplied by the Setup Wizard
 * before the user commits to them. Returns 200 on success or 400/503 on
 * failure with a human-readable error message.
 */
export async function testDbConnection(req, res) {
  // Only available before the system is configured (setup wizard phase)
  try {
    const existing = await db('app_config').where({ key: 'auth_type' }).
first();
    if (existing) {
      return res.status(403).json({ error: 'System is already configured.' });
    }
  } catch { /* table may not exist yet on a fresh install — that is fine */ }

  const { host, port, user, password, name } = req.body || {};

  if (!host || !user || !password || !name) {
    return res.status(400).json({ error: 'host, user, password and name are required' });
  }

  const client = new Client({
    host,
    port:     parseInt(port, 10) || 5432,
    user,
    password,
    database: name,
    connectionTimeoutMillis: 5000,
    ssl:      false,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return res.json({ ok: true });
  } catch (err) {
    try { await client.end(); } catch { /* ignore */ }
    logger.warn(`DB test connection failed: ${err.message}`);
    return res.status(503).json({ error: err.message || 'Connection failed' });
  }
}

/**
 * POST /api/config/setup
 *
 * Day-0 initialisation endpoint.  Accepts:
 *   {
 *     db:       { type, host, port, user, password, name }
 *     authType: 'local' | 'saml'
 *     admin?:   { email, displayName, password }   // only when authType === 'local'
 *     saml?:    { entryPoint, issuer, cert }         // only when authType === 'saml'
 *   }
 *
 * This endpoint is unauthenticated by design — it runs before any users exist.
 */
export async function submitEnterpriseSetup(req, res) {
  const { db: dbCfg, authType, admin, saml } = req.body || {};

  if (!authType) {
    return res.status(400).json({ error: 'authType is required' });
  }

  // If using an external database, wire up a separate Knex instance so we can
  // run migrations against the target host.  The default `db` instance points at
  // the server's own DATABASE_URL / DB_* vars.
  let targetDb = db;
  if (dbCfg && dbCfg.type === 'external') {
    targetDb = Knex({
      client: 'postgresql',
      connection: {
        host:     dbCfg.host,
        port:     parseInt(dbCfg.port, 10) || 5432,
        user:     dbCfg.user,
        password: dbCfg.password,
        database: dbCfg.name,
      },
      pool: { min: 1, max: 3 },
    });
  }

  try {
    // 1. Ensure app_config table exists (migration 001 creates it, but this is
    //    a safe guard for the first-run path before migrations have run).
    await targetDb.raw(`
      CREATE TABLE IF NOT EXISTS app_config (
        key          VARCHAR(255) PRIMARY KEY,
        value        JSONB,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 2. Guard: reject if the system has already been configured.
    //    This prevents an unauthenticated attacker from overwriting the SAML
    //    config after initial setup (F1 — SAML config takeover).
    const existingAuthType = await targetDb('app_config').where({ key: 'auth_type' }).
first();
    if (existingAuthType) {
      return res.status(403).json({
        error: 'System is already configured. Use the admin settings panel to change configuration.',
      });
    }

    // 3. Persist auth type and optional SAML config.
    const configs = [{ key: 'auth_type', value: JSON.stringify(authType) },];

    if (authType === 'saml' && saml) {
      configs.push({ key: 'saml_config', value: JSON.stringify({
        entryPoint: saml.entryPoint,
        issuer:     saml.issuer,
        cert:       saml.cert,
      })});
    }

    if (dbCfg) {
      // Store DB config without the password.
      configs.push({ key: 'db_config', value: JSON.stringify({
        type: dbCfg.type,
        host: dbCfg.host || 'localhost',
        port: dbCfg.port || '5432',
        name: dbCfg.name || 'carbonthreat',
        user: dbCfg.user || '',
      })});
    }

    for (const conf of configs) {
      await targetDb.raw(
        `INSERT INTO app_config (key, value)
         VALUES (?, ?)
         ON CONFLICT (key) DO UPDATE SET value = ?, updated_at = NOW()`,
        [conf.key, conf.value, conf.value]
      );
    }

    // 4. Create root admin (local auth only, and only when no users exist yet).
    if (authType === 'local' && admin && admin.email && admin.password) {
      // Ensure users table exists before querying it.
      const usersExist = await targetDb.schema.hasTable('users');
      if (!usersExist) {
        return res.status(500).json({
          error: 'Users table does not exist. Run database migrations first.',
        });
      }

      const count = await targetDb('users').count('id as n').
first();
      if (parseInt(count.n, 10) === 0) {
        if (admin.password.length < 12) {
          return res.status(400).json({ error: 'Admin password must be at least 12 characters' });
        }

        const password_hash = await bcrypt.hash(admin.password, 12);
        await targetDb('users').insert({
          email:        admin.email.toLowerCase().trim(),
          password_hash,
          display_name: admin.displayName || 'System Administrator',
          role:         'admin',
          is_active:    true,
        });

        logger.info(`Root admin created: ${admin.email}`);
      } else {
        logger.warn('Setup called but users already exist — admin creation skipped.');
      }
    }

    logger.info(`Enterprise setup completed (authType=${authType})`);
    return res.status(200).json({ success: true, message: 'Setup completed successfully.' });

  } catch (err) {
    logger.error('Enterprise setup failed', err);
    return res.status(500).json({ error: 'Setup failed', details: err.message });
  } finally {
    // Only destroy the temp connection; leave the default `db` pool alone.
    if (targetDb !== db) {
      await targetDb.destroy().catch(() => {});
    }
  }
}

/**
 * GET /api/config
 * Returns the current public-safe configuration (no secrets).
 */
export async function config(_req, res) {
  try {
    const rows = await db('app_config').
      whereIn('key', ['auth_type', 'db_config']).
      select('key', 'value');

    const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    // Only consider the system configured when auth_type has been saved by the wizard
    if (!cfg.auth_type) {
      return res.json({ status: 'unconfigured' });
    }
    return res.json({ status: 'configured', ...cfg });
  } catch {
    // Table may not exist yet on fresh installs.
    return res.json({ status: 'unconfigured' });
  }
}
