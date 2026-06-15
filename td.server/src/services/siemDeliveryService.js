/**
 * SIEM Delivery Service
 *
 * Pushes audit log entries to configured SIEM integrations in a fire-and-forget
 * manner (setImmediate). Failures are logged but never propagate to the caller.
 *
 * Supported platforms:
 *   splunk   — Splunk HTTP Event Collector (HEC)
 *   sentinel — Microsoft Sentinel Log Analytics Workspace API
 *   elastic  — Elasticsearch / Elastic Cloud Bulk API
 *   webhook  — Generic HTTP POST (any SIEM with an HTTP ingestor)
 */

import crypto from 'crypto';
import { decryptModel } from '../security/encryption.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('services/siemDeliveryService.js');

const SIEM_PLATFORMS = ['splunk', 'sentinel', 'elastic', 'webhook'];

// ── Config loading ─────────────────────────────────────────────────────────

function decryptConfig(storedStr) {
  const payload = JSON.parse(storedStr);
  return decryptModel(payload);
}

async function getEnabledSiemConfigs(knex) {
  try {
    const rows = await knex('integration_configs').
      whereIn('platform', SIEM_PLATFORMS).
      where('is_enabled', true);

    return rows.map((row) => {
      try {
        return { platform: row.platform, config: decryptConfig(row.config_encrypted) };
      } catch {
        logger.warn(`siemDeliveryService: could not decrypt config for platform=${row.platform}`);
        return null;
      }
    }).filter(Boolean);
  } catch (err) {
    logger.warn('siemDeliveryService: failed to load SIEM configs', err.message);
    return [];
  }
}

// ── ECS formatter (reused for Elastic) ────────────────────────────────────

function toEcsEvent(entry) {
  return {
    '@timestamp':                 entry.created_at ? new Date(entry.created_at).toISOString() : new Date().toISOString(),
    'event.dataset':              'carbonthreat.audit',
    'event.action':               entry.action ?? '',
    'event.category':             ['iam'],
    'event.outcome':              entry.http_status && entry.http_status < 400 ? 'success' : 'failure',
    'user.id':                    entry.user_id ?? null,
    'source.ip':                  entry.ip_address ?? null,
    'carbonthreat.entity.type':   entry.entity_type ?? null,
    'carbonthreat.entity.id':     entry.entity_id ?? null,
    'http.response.status_code':  entry.http_status ?? null,
  };
}

// ── Splunk HEC ────────────────────────────────────────────────────────────

async function sendToSplunk(config, entry) {
  const url = `${config.serverUrl.replace(/\/$/, '')}/services/collector`;
  const body = JSON.stringify({
    time:       entry.created_at ? new Date(entry.created_at).getTime() / 1000 : Date.now() / 1000,
    sourcetype: 'carbonthreat:audit',
    index:      config.index || 'main',
    event:      entry,
  });

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Authorization': `Splunk ${config.token}`, 'Content-Type': 'application/json' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Splunk HEC responded ${res.status}: ${text.slice(0, 200)}`);
  }
}

// ── Microsoft Sentinel (Log Analytics Workspace API) ──────────────────────

async function sendToSentinel(config, entry) {
  const date = new Date().toUTCString();
  const bodyStr = JSON.stringify([entry]);
  const bodyLen = Buffer.byteLength(bodyStr);
  const logType = config.logType || 'CarbonThreatAudit';

  const stringToSign = `POST\n${bodyLen}\napplication/json\nx-ms-date:${date}\n/api/logs`;
  const sig = crypto.
    createHmac('sha256', Buffer.from(config.sharedKey, 'base64')).
    update(stringToSign, 'utf8').
    digest('base64');

  const url = `https://${config.workspaceId}.ods.opinsights.azure.com/api/logs?api-version=2016-04-01`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Authorization':         `SharedKey ${config.workspaceId}:${sig}`,
      'Content-Type':          'application/json',
      'Log-Type':              logType,
      'x-ms-date':             date,
      'time-generated-field':  'created_at',
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sentinel API responded ${res.status}: ${text.slice(0, 200)}`);
  }
}

// ── Elastic ───────────────────────────────────────────────────────────────

async function sendToElastic(config, entry) {
  const indexName = config.indexName || 'carbonthreat-audit';
  const url = `${config.serverUrl.replace(/\/$/, '')}/${indexName}/_doc`;
  const body = JSON.stringify(toEcsEvent(entry));

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Authorization': `ApiKey ${config.apiKey}`, 'Content-Type': 'application/json' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Elastic API responded ${res.status}: ${text.slice(0, 200)}`);
  }
}

// ── Generic Webhook ───────────────────────────────────────────────────────

async function sendToWebhook(config, entry) {
  const bodyStr = JSON.stringify({ event: entry, timestamp: new Date().toISOString() });
  const headers = { 'Content-Type': 'application/json' };

  if (config.secret) {
    const sig = crypto.createHmac('sha256', config.secret).update(bodyStr).
digest('hex');
    headers['X-CarbonThreat-Signature'] = `sha256=${sig}`;
  }

  if (config.headers) {
    try {
      Object.assign(headers, JSON.parse(config.headers));
    } catch {
      logger.warn('siemDeliveryService: webhook headers is not valid JSON; ignoring');
    }
  }

  const res = await fetch(config.url, { method: 'POST', headers, body: bodyStr });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Webhook responded ${res.status}: ${text.slice(0, 200)}`);
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────

async function sendToSiem(platform, config, entry) {
  switch (platform) {
    case 'splunk': return sendToSplunk(config, entry);
    case 'sentinel': return sendToSentinel(config, entry);
    case 'elastic': return sendToElastic(config, entry);
    case 'webhook': return sendToWebhook(config, entry);
    default:
      throw new Error(`Unknown SIEM platform: ${platform}`);
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Fire-and-forget delivery to all enabled SIEM integrations.
 * Never throws — failures are logged at WARN level only.
 *
 * @param {object} auditEntry  — row from audit_logs
 * @param {object} knex        — Knex instance
 */
export async function deliverToSiems(auditEntry, knex) {
  const configs = await getEnabledSiemConfigs(knex);
  if (configs.length === 0) {return;}

  for (const { platform, config } of configs) {
    setImmediate(() => {
      sendToSiem(platform, config, auditEntry).catch((err) => {
        logger.warn(`SIEM push failed [${platform}]: ${err.message}`);
      });
    });
  }
}
