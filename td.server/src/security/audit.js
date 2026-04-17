import db from '../db/knex.js';

/**
 * Field names whose values must never be persisted in audit_logs.
 * Matching is case-insensitive and substring-based: any key that *contains*
 * one of these tokens in its name will have its value replaced with '[REDACTED]'.
 */
const SENSITIVE_FIELD_TOKENS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',      // covers refreshToken, apiToken, accessToken, idToken, webhookSecret via fallthrough below
  'apikey',
  'api_key',
  'clientsecret',
  'client_secret',
  'privatekey',
  'private_key',
  'credential',
  'authorization',
  'cookie',
  'otp',
  'totp',
];

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;

function isSensitiveKey(key) {
  if (!key || typeof key !== 'string') {return false;}
  const lower = key.toLowerCase();
  return SENSITIVE_FIELD_TOKENS.some((t) => lower.includes(t));
}

/**
 * Deep-clone-and-redact. Returns a new value with any sensitive field replaced.
 * Handles cycles via a WeakSet and bounds depth to avoid pathological inputs.
 */
function redact(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) {return value;}
  if (depth > MAX_DEPTH) {return '[TRUNCATED]';}

  if (Array.isArray(value)) {
    if (seen.has(value)) {return '[CIRCULAR]';}
    seen.add(value);
    return value.map((v) => redact(v, depth + 1, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {return '[CIRCULAR]';}
    seen.add(value);
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = isSensitiveKey(k) ? REDACTED : redact(v, depth + 1, seen);
    }
    return out;
  }

  // primitive
  return value;
}

export function redactSensitive(obj) {
  return redact(obj);
}

export async function logAudit(action, userId, resourceId, details, ipAddress) {
  try {
    await db('audit_logs').insert({
      action,
      user_id:    userId === 'anonymous' ? null : userId,
      entity_id:  resourceId === 'N/A' ? null : resourceId,
      diff:       JSON.stringify(redactSensitive(details)),
      ip_address: ipAddress,
    });
  } catch (err) {
    console.error('Failed to write audit log', err);
  }
}

export const auditMiddleware = (actionProvider) => async (req, res, next) => {
    // Fire and forget logging
    const action = typeof actionProvider === 'function' ? actionProvider(req) : actionProvider;
    const userId = req.user ? req.user.id : 'anonymous';
    const resourceId = req.params.id || 'N/A';

    const originalSend = res.send;
    res.send = function (data) {
      logAudit(action, userId, resourceId, { body: req.body, statusCode: res.statusCode }, req.ip);
      originalSend.call(this, data);
    };
    next();
  };
