import db from '../db/knex.js';
import axios from 'axios';
import { decryptModel, encryptModel } from '../security/encryption.js';
import { createThirdPartyIssue } from '../integrations/third-party.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/integrationsController.js');

const VALID_PLATFORMS = ['github', 'jira', 'servicenow', 'openai', 'ollama', 'jules'];

// ── Helpers ────────────────────────────────────────────────────────────────

function encryptConfig(configObj) {
  // encryptModel accepts any JSON-serialisable object
  const payload = encryptModel(configObj);
  return JSON.stringify(payload);
}

function decryptConfig(storedStr) {
  const payload = JSON.parse(storedStr);
  return decryptModel(payload);
}

/**
 * Returns a safe (secrets redacted) view of the config for API responses.
 * Replaces credential values with '***' so the frontend can confirm
 * a config exists without exposing the actual tokens.
 */
function redactSecrets(configObj) {
  const SECRET_KEYS = ['token', 'password', 'apiKey', 'api_key', 'clientSecret', 'client_secret'];
  const out = { ...configObj };
  for (const key of SECRET_KEYS) {
    if (out[key]) {out[key] = '***';}
  }
  return out;
}

// ── Controllers ────────────────────────────────────────────────────────────

/**
 * GET /api/integrations
 * Returns all configured integrations for the user's org (secrets redacted).
 */
export async function listConfigs(req, res) {
  try {
    const rows = await db('integration_configs').
      where({ org_id: req.user.org_id ?? null }).
      select('id', 'platform', 'is_enabled', 'updated_at');

    // Decrypt each row so the frontend knows which fields are set
    const configs = rows.map((row) => {
      try {
        const plain = decryptConfig(row.config_encrypted ?? '{}');
        return { ...row, config: redactSecrets(plain) };
      } catch {
        return { ...row, config: {} };
      }
    });

    return res.json({ configs });
  } catch (err) {
    logger.error('listConfigs failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/integrations/:platform
 * Returns the config for a single platform (secrets redacted).
 */
export async function getConfig(req, res) {
  const { platform } = req.params;

  if (!VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: `Unknown platform: ${platform}` });
  }

  try {
    const row = await db('integration_configs').
      where({ platform, org_id: req.user.org_id ?? null }).
      first();

    if (!row) {return res.status(404).json({ error: 'Integration not configured' });}

    const plain = decryptConfig(row.config_encrypted);
    return res.json({ platform, is_enabled: row.is_enabled, config: redactSecrets(plain) });
  } catch (err) {
    logger.error('getConfig failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PUT /api/integrations/:platform
 * Creates or updates the encrypted config for a platform. Admin only.
 * Body: the platform-specific credentials object (see integration docs).
 */
export async function upsertConfig(req, res) {
  const { platform } = req.params;
  const { is_enabled = true, ...configFields } = req.body || {};

  if (!VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: `Unknown platform: ${platform}` });
  }

  if (Object.keys(configFields).length === 0) {
    return res.status(400).json({ error: 'Config body cannot be empty' });
  }

  try {
    const config_encrypted = encryptConfig(configFields);
    const now = db.fn.now();

    const existing = await db('integration_configs').
      where({ platform, org_id: req.user.org_id ?? null }).
      first();

    if (existing) {
      await db('integration_configs').
        where({ id: existing.id }).
        update({ config_encrypted, is_enabled, updated_at: now });
    } else {
      await db('integration_configs').insert({
        platform,
        org_id: req.user.org_id ?? null,
        config_encrypted,
        is_enabled,
      });
    }

    logger.info(`Integration config saved: platform=${platform} by user=${req.user.id}`);
    return res.json({ message: `Integration "${platform}" saved successfully`, is_enabled });
  } catch (err) {
    logger.error('upsertConfig failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /api/integrations/:platform
 * Removes the integration config entirely. Admin only.
 */
export async function deleteConfig(req, res) {
  const { platform } = req.params;

  try {
    const deleted = await db('integration_configs').
      where({ platform, org_id: req.user.org_id ?? null }).
      delete();

    if (!deleted) {return res.status(404).json({ error: 'Integration not found' });}

    logger.info(`Integration config deleted: platform=${platform} by user=${req.user.id}`);
    return res.json({ message: `Integration "${platform}" removed` });
  } catch (err) {
    logger.error('deleteConfig failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/integrations/:platform/export
 * Exports a threat (issue) to the target platform.
 * Body: { title: string, description: string }
 * Requires integration to be enabled and configured.
 */
export async function exportIssue(req, res) {
  const { platform } = req.params;
  const { title, description } = req.body || {};

  if (!VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: `Unknown platform: ${platform}` });
  }
  if (!title) {return res.status(400).json({ error: 'title is required' });}
  if (!description) {return res.status(400).json({ error: 'description is required' });}

  try {
    const row = await db('integration_configs').
      where({ platform, org_id: req.user.org_id ?? null, is_enabled: true }).
      first();

    if (!row) {
      return res.status(409).json({ error: `Integration "${platform}" is not enabled or configured` });
    }

    const config = decryptConfig(row.config_encrypted);
    const result = await createThirdPartyIssue(platform, { title, description }, config);

    if (!result.success) {
      logger.warn(`Export to ${platform} failed: ${result.error}`);
      return res.status(502).json({ error: result.error ?? 'Export failed' });
    }

    logger.info(`Issue exported to ${platform} by user=${req.user.id}: "${title}"`);
    return res.json({ message: `Issue created on ${platform}` });
  } catch (err) {
    logger.error('exportIssue failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Jules-specific endpoints ───────────────────────────────────────────────

/**
 * POST /api/integrations/jules/test
 * Tests the Jules API key by calling GET /v1alpha/sources.
 * Admin only. Body: { apiKey: string }
 */
export async function testJulesConnection(req, res) {
  try {
    const { apiKey } = req.body || {};
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const response = await axios.get('https://jules.googleapis.com/v1alpha/sources', {
      headers: { 'X-Goog-Api-Key': apiKey },
      timeout: 10_000,
    });

    const sourceCount = response.data.sources?.length ?? 0;
    logger.info(`Jules connection test succeeded: ${sourceCount} sources found by user=${req.user.id}`);
    return res.json({ success: true, sourceCount });
  } catch (err) {
    const status = err.response?.status;
    let msg;
    if (status === 401 || status === 403) {
      msg = 'Invalid or unauthorized API key';
    } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      msg = 'Connection timed out — check network connectivity';
    } else {
      msg = err.response?.data?.error?.message ?? err.message ?? 'Connection test failed';
    }
    logger.warn(`Jules connection test failed: ${msg} (HTTP ${status ?? 'N/A'})`);
    return res.json({ success: false, error: msg });
  }
}

/**
 * GET /api/jules/status
 * Returns whether Jules integration is configured, enabled, and reachable.
 * Available to all authenticated users (needed for menu visibility).
 */
export async function getJulesStatus(req, res) {
  try {
    const row = await db('integration_configs')
      .where({ platform: 'jules', org_id: req.user.org_id ?? null })
      .first();

    const configured = !!row;
    const enabled = row?.is_enabled ?? false;

    // Optionally test connectivity if configured and enabled
    let connected = false;
    if (configured && enabled) {
      try {
        const config = decryptConfig(row.config_encrypted);
        const apiKey = config.apiKey || config.api_key;
        if (apiKey) {
          await axios.get('https://jules.googleapis.com/v1alpha/sources', {
            headers: { 'X-Goog-Api-Key': apiKey },
            timeout: 5_000,
          });
          connected = true;
        }
      } catch {
        connected = false;
      }
    }

    return res.json({ configured, enabled, connected });
  } catch (err) {
    logger.error('getJulesStatus failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
