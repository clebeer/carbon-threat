/**
 * SMTP configuration controller.
 *
 * Routes (all admin-only):
 *   GET    /api/config/smtp        — return current SMTP config (password redacted)
 *   PUT    /api/config/smtp        — persist SMTP config
 *   POST   /api/config/smtp/test   — send a test email to the logged-in admin
 */

import nodemailer from 'nodemailer';
import db from '../db/knex.js';
import { encryptModel, decryptModel } from '../security/encryption.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/smtp.js');

const CONFIG_KEY = 'smtp_config';

async function loadSmtp() {
  const row = await db('app_config').where({ key: CONFIG_KEY }).first();
  if (!row?.value) return null;
  // Handle encrypted format (new) — fall back to legacy cleartext for migration
  if (row.value?.encryptedData) {
    return decryptModel(row.value);
  }
  return row.value;
}

export async function getSmtpConfig(_req, res) {
  try {
    const cfg = await loadSmtp();
    if (!cfg) return res.json({ smtp: null });
    // Never return the password over the API
    const { password: _pw, ...safe } = cfg;
    return res.json({ smtp: safe });
  } catch (err) {
    logger.error('getSmtpConfig failed', err);
    return res.status(500).json({ error: 'Failed to load SMTP config' });
  }
}

export async function saveSmtpConfig(req, res) {
  const { host, port, user, password, from, secure } = req.body || {};

  if (!host || !port) {
    return res.status(400).json({ error: 'host and port are required' });
  }

  const cfg = {
    host,
    port:     parseInt(port, 10) || 587,
    user:     user     || '',
    password: password || '',
    from:     from     || '',
    secure:   Boolean(secure),
  };

  // If password is blank, keep existing one
  if (!password) {
    const existing = await loadSmtp();
    if (existing?.password) cfg.password = existing.password;
  }

  try {
    const encrypted = JSON.stringify(encryptModel(cfg));
    await db('app_config')
      .insert({ key: CONFIG_KEY, value: encrypted })
      .onConflict('key')
      .merge({ value: encrypted, updated_at: db.fn.now() });
    logger.info('SMTP config updated');
    return res.json({ ok: true });
  } catch (err) {
    logger.error('saveSmtpConfig failed', err);
    return res.status(500).json({ error: 'Failed to save SMTP config' });
  }
}

export async function testSmtpConfig(req, res) {
  try {
    let cfg = req.body;
    
    // Fallback: If no host provided from UI, load entirely from DB
    if (!cfg || !cfg.host) {
      cfg = await loadSmtp();
    } 
    // Fallback pass: If UI sent config but password was empty (due to data redaction on the client view), retrieve the lost password from DB
    else if (!cfg.password) {
      const existing = await loadSmtp();
      if (existing?.password) cfg.password = existing.password;
    }

    if (!cfg?.host) {
      return res.status(400).json({ error: 'SMTP not configured yet' });
    }

    const transport = nodemailer.createTransport({
      host:   cfg.host,
      port:   cfg.port,
      secure: cfg.secure,
      auth:   cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
    });

    const to = req.body?.to || req.user?.email || cfg.from || 'test@example.com';
    const defaultFrom = (cfg.user && cfg.user.includes('@')) ? cfg.user : 'no-reply@' + (cfg.host.replace('smtp.', '') || 'carbonthreat.io');
    
    await transport.sendMail({
      from:    cfg.from || defaultFrom,
      to,
      subject: 'CarbonThreat — SMTP test',
      text:    'This is a test email from CarbonThreat Enterprise. Your outbound mail is working correctly.',
    });

    logger.info(`SMTP test email sent to ${to}`);
    return res.json({ ok: true, sentTo: to });
  } catch (err) {
    logger.warn('SMTP test failed', err);
    return res.status(503).json({ error: err.message || 'SMTP test failed' });
  }
}
