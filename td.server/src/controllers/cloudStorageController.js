import axios from 'axios';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import db from '../db/knex.js';
import { decryptModel, encryptModel } from '../security/encryption.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/cloudStorageController.js');

const PROVIDERS = {
  google_drive: {
    authUrl:     'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl:    'https://oauth2.googleapis.com/token',
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    secretEnv:   'GOOGLE_CLIENT_SECRET',
    scopes:      ['https://www.googleapis.com/auth/drive.file'],
  },
  onedrive: {
    authUrl:     'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl:    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientIdEnv: 'MICROSOFT_CLIENT_ID',
    secretEnv:   'MICROSOFT_CLIENT_SECRET',
    scopes:      ['Files.ReadWrite', 'offline_access'],
  },
};

function getCallbackUrl() {
  return process.env.CLOUD_STORAGE_CALLBACK_URL || 'http://localhost:3000/api/cloud-storage/callback';
}

// ── OAuth state helpers (F6 — HMAC-signed state to prevent forgery) ─────────

function getStateSecret() {
  // Reuse the JWT signing key; any 32-byte secret from env is acceptable.
  const secret = process.env.ENCRYPTION_JWT_SIGNING_KEY || process.env.ENCRYPTION_KEY;
  if (!secret) {throw new Error('No signing secret available for OAuth state');}
  return secret;
}

function buildState(userId, provider) {
  const payload = JSON.stringify({ userId, provider, nonce: randomBytes(8).toString('hex') });
  const sig = createHmac('sha256', getStateSecret()).update(payload).
digest('hex');
  return Buffer.from(JSON.stringify({ payload, sig })).toString('base64url');
}

function parseState(state) {
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Malformed state parameter');
  }
  const { payload, sig } = parsed;
  if (typeof payload !== 'string' || typeof sig !== 'string') {
    throw new Error('Malformed state parameter');
  }
  const expected = createHmac('sha256', getStateSecret()).update(payload).
digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid state signature');
  }
  return JSON.parse(payload);
}

// ── HTML escaping helper (F2) ────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str).replace(/[<>&"']/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;' }[c]
  ));
}

function encryptToken(token) {
  return JSON.stringify(encryptModel({ token }));
}

function decryptToken(enc) {
  try {
    return decryptModel(JSON.parse(enc)).token;
  } catch {
    return null;
  }
}

async function getStoredToken(userId, provider) {
  return db('cloud_storage_tokens').where({ user_id: userId, provider }).
first();
}

async function refreshAccessToken(row, providerConfig) {
  const refreshToken = decryptToken(row.refresh_token_enc);
  if (!refreshToken) {return null;}

  const params = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
    client_id:     process.env[providerConfig.clientIdEnv] || '',
    client_secret: process.env[providerConfig.secretEnv] || '',
  });

  const { data } = await axios.post(providerConfig.tokenUrl, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;

  await db('cloud_storage_tokens').where({ id: row.id }).
update({
    access_token_enc: encryptToken(data.access_token),
    expires_at:       expiresAt,
    updated_at:       db.fn.now(),
  });

  return data.access_token;
}

async function getValidAccessToken(userId, provider) {
  const row = await getStoredToken(userId, provider);
  if (!row) {return null;}

  const isExpired = row.expires_at && new Date(row.expires_at) <= new Date(Date.now() + 60_000);
  if (isExpired && row.refresh_token_enc) {
    return refreshAccessToken(row, PROVIDERS[provider]);
  }

  return decryptToken(row.access_token_enc);
}

export async function getAuthUrl(req, res) {
  const { provider } = req.params;
  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) {
    return res.status(400).json({ error: 'Unsupported provider' });
  }

  const clientId = process.env[providerConfig.clientIdEnv];
  if (!clientId) {
    return res.status(500).json({ error: `${providerConfig.clientIdEnv} not configured` });
  }

  const state = buildState(req.user.id, provider);
  const callbackUrl = getCallbackUrl();

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  callbackUrl,
    response_type: 'code',
    scope:         providerConfig.scopes.join(' '),
    state,
    access_type:   'offline',
    prompt:        'consent',
  });

  const authUrl = `${providerConfig.authUrl}?${params.toString()}`;
  return res.json({ authUrl, provider });
}

export async function oauthCallback(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    // F2 — escape the error param before embedding in HTML
    return res.status(400).send(`<html><body><p>Auth error: ${escapeHtml(error)}</p></body></html>`);
  }

  if (!code || !state) {
    return res.status(400).send('<html><body><p>Missing code or state</p></body></html>');
  }

  let provider, userId;
  try {
    // F6 — verify HMAC signature before trusting state contents
    ({ userId, provider } = parseState(state));
  } catch {
    return res.status(400).send('<html><body><p>Invalid state</p></body></html>');
  }

  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) {
    return res.status(400).send('<html><body><p>Unknown provider</p></body></html>');
  }

  try {
    const callbackUrl = getCallbackUrl();
    const params = new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  callbackUrl,
      client_id:     process.env[providerConfig.clientIdEnv] || '',
      client_secret: process.env[providerConfig.secretEnv] || '',
    });

    const { data } = await axios.post(providerConfig.tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null;

    await db('cloud_storage_tokens').
      insert({
        user_id:           userId,
        provider,
        access_token_enc:  encryptToken(data.access_token),
        refresh_token_enc: data.refresh_token ? encryptToken(data.refresh_token) : null,
        expires_at:        expiresAt,
        scope:             data.scope || null,
      }).
      onConflict(['user_id', 'provider']).
      merge(['access_token_enc', 'refresh_token_enc', 'expires_at', 'scope', 'updated_at']);

    logger.info(`Cloud storage connected: user ${userId} provider ${provider}`);

    // F3 — use JSON.stringify to safely embed provider inside a script literal,
    // preventing injection even if provider somehow contains quote characters.
    return res.send(
      `<html><body><script>window.opener?.postMessage({type:'CLOUD_AUTH_SUCCESS',provider:${JSON.stringify(String(provider))}},'*');window.close();</script></body></html>`
    );
  } catch (err) {
    logger.error('oauthCallback failed', err);
    return res.status(500).send('<html><body><p>Token exchange failed</p></body></html>');
  }
}

export async function listFiles(req, res) {
  const { provider } = req.params;
  const { folderId } = req.query;

  if (!PROVIDERS[provider]) {return res.status(400).json({ error: 'Unsupported provider' });}

  try {
    const accessToken = await getValidAccessToken(req.user.id, provider);
    if (!accessToken) {return res.status(401).json({ error: 'Not connected to provider' });}

    let files = [];

    if (provider === 'google_drive') {
      const q = folderId
        ? `'${folderId}' in parents and trashed=false`
        : "mimeType='application/json' and trashed=false";
      const { data } = await axios.get('https://www.googleapis.com/drive/v3/files', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params:  { q, fields: 'files(id,name,mimeType,modifiedTime)', pageSize: 100 },
      });
      files = (data.files || []).map((f) => ({
        id:           f.id,
        name:         f.name,
        mimeType:     f.mimeType,
        modifiedTime: f.modifiedTime,
      }));
    } else {
      const url = folderId
        ? `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`
        : 'https://graph.microsoft.com/v1.0/me/drive/root/children';
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params:  { $top: 100 },
      });
      files = (data.value || []).map((f) => ({
        id:           f.id,
        name:         f.name,
        mimeType:     f.file?.mimeType || 'application/octet-stream',
        modifiedTime: f.lastModifiedDateTime,
      }));
    }

    return res.json({ files });
  } catch (err) {
    logger.error('listFiles failed', err);
    return res.status(500).json({ error: 'Failed to list files' });
  }
}

export async function importFile(req, res) {
  const { provider } = req.params;
  const { fileId, title } = req.body || {};

  if (!PROVIDERS[provider]) {return res.status(400).json({ error: 'Unsupported provider' });}
  if (!fileId) {return res.status(400).json({ error: 'fileId is required' });}
  if (!title || !title.trim()) {return res.status(400).json({ error: 'title is required' });}

  const userId = req.user?.id;
  const orgId = req.user?.orgId ?? req.provider?.orgId ?? null;

  try {
    const accessToken = await getValidAccessToken(userId, provider);
    if (!accessToken) {return res.status(401).json({ error: 'Not connected to provider' });}

    let content;
    if (provider === 'google_drive') {
      const { data } = await axios.get(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params:  { alt: 'media' },
        responseType: 'text',
      });
      content = typeof data === 'string' ? JSON.parse(data) : data;
    } else {
      const { data } = await axios.get(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'text',
      });
      content = typeof data === 'string' ? JSON.parse(data) : data;
    }

    const encrypted = encryptModel(content);
    const [model] = await db('threat_models').
      insert({
        title:             title.trim(),
        description:       `Imported from ${provider}`,
        content_encrypted: JSON.stringify(encrypted),
        owner_id:          userId,
        org_id:            orgId || null,
        version:           1,
      }).
      returning(['id', 'title', 'description', 'version', 'is_archived', 'created_at', 'updated_at', 'owner_id', 'org_id']);

    logger.info(`Model imported from ${provider} file ${fileId} by user ${userId}`);
    return res.status(201).json({ model });
  } catch (err) {
    logger.error('importFile failed', err);
    return res.status(500).json({ error: 'Failed to import file' });
  }
}

export async function exportModel(req, res) {
  const { provider } = req.params;
  const { modelId, folderId } = req.body || {};

  if (!PROVIDERS[provider]) {return res.status(400).json({ error: 'Unsupported provider' });}
  if (!modelId) {return res.status(400).json({ error: 'modelId is required' });}

  const userId = req.user?.id;
  const orgId = req.user?.orgId ?? req.provider?.orgId ?? null;

  try {
    const accessToken = await getValidAccessToken(userId, provider);
    if (!accessToken) {return res.status(401).json({ error: 'Not connected to provider' });}

    const q = db('threat_models').where({ is_archived: false, id: modelId });
    const row = orgId
      ? await q.where({ org_id: orgId }).first()
      : await q.where({ owner_id: userId }).first();

    if (!row) {return res.status(404).json({ error: 'Threat model not found' });}

    let content = {};
    if (row.content_encrypted) {
      content = decryptModel(JSON.parse(row.content_encrypted));
    }

    const fileName = `${row.title.replace(/[^a-z0-9_-]/gi, '_')}.json`;
    const fileBody = JSON.stringify({ title: row.title, description: row.description, content }, null, 2);

    let fileId, fileUrl;

    if (provider === 'google_drive') {
      const metadata = { name: fileName, mimeType: 'application/json' };
      if (folderId) {metadata.parents = [folderId];}

      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('metadata', JSON.stringify(metadata), { contentType: 'application/json' });
      form.append('file', Buffer.from(fileBody), { contentType: 'application/json', filename: fileName });

      const { data } = await axios.post(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
        form,
        { headers: { Authorization: `Bearer ${accessToken}`, ...form.getHeaders() } }
      );
      fileId = data.id;
      fileUrl = data.webViewLink;
    } else {
      const uploadUrl = folderId
        ? `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${fileName}:/content`
        : `https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`;

      const { data } = await axios.put(uploadUrl, fileBody, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
      fileId = data.id;
      fileUrl = data.webUrl;
    }

    logger.info(`Model ${modelId} exported to ${provider} as ${fileName}`);
    return res.json({ fileId, fileName, url: fileUrl });
  } catch (err) {
    logger.error('exportModel failed', err);
    return res.status(500).json({ error: 'Failed to export model' });
  }
}

export async function disconnect(req, res) {
  const { provider } = req.params;
  if (!PROVIDERS[provider]) {return res.status(400).json({ error: 'Unsupported provider' });}

  try {
    await db('cloud_storage_tokens').where({ user_id: req.user.id, provider }).
del();
    logger.info(`Cloud storage disconnected: user ${req.user.id} provider ${provider}`);
    return res.json({ message: 'Disconnected' });
  } catch (err) {
    logger.error('disconnect failed', err);
    return res.status(500).json({ error: 'Failed to disconnect' });
  }
}

export async function getStatus(req, res) {
  const { provider } = req.params;
  if (!PROVIDERS[provider]) {return res.status(400).json({ error: 'Unsupported provider' });}

  try {
    const row = await getStoredToken(req.user.id, provider);
    if (!row) {return res.json({ connected: false });}

    const isExpired = row.expires_at && new Date(row.expires_at) <= new Date();
    const hasRefresh = Boolean(row.refresh_token_enc);

    if (isExpired && !hasRefresh) {
      return res.json({ connected: false });
    }

    return res.json({ connected: true });
  } catch (err) {
    logger.error('getStatus failed', err);
    return res.status(500).json({ error: 'Failed to check status' });
  }
}
