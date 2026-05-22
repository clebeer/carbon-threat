/**
 * Audit Export Service
 *
 * Converts filtered audit_logs rows into industry-standard SIEM formats:
 *   csv   — RFC 4180, Excel-compatible
 *   json  — structured JSON envelope
 *   cef   — ArcSight Common Event Format (works with Splunk, generic SIEMs)
 *   leef  — IBM QRadar Log Event Extended Format
 *   ecs   — Elastic Common Schema (NDJSON, one object per line)
 */

export const MAX_EXPORT_ROWS = 50_000;

// ── Query ─────────────────────────────────────────────────────────────────

/**
 * Fetch the filtered log rows from the DB (no pagination, capped at MAX_EXPORT_ROWS).
 */
async function fetchLogs(filters, knex) {
  let q = knex('audit_logs')
    .select('id', 'action', 'entity_type', 'entity_id', 'user_id', 'ip_address', 'http_status', 'created_at')
    .orderBy('created_at', 'desc')
    .limit(MAX_EXPORT_ROWS);

  if (filters.action)      q = q.where('action', filters.action);
  if (filters.entity_type) q = q.where('entity_type', filters.entity_type);
  if (filters.user_id)     q = q.where('user_id', filters.user_id);
  if (filters.from)        q = q.where('created_at', '>=', new Date(filters.from));
  if (filters.to)          q = q.where('created_at', '<=', new Date(filters.to));

  return q;
}

// ── Formatters ────────────────────────────────────────────────────────────

function toDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows) {
  const header = 'id,action,entity_type,entity_id,user_id,ip_address,http_status,created_at';
  const lines = rows.map(r =>
    [r.id, r.action, r.entity_type, r.entity_id, r.user_id, r.ip_address, r.http_status, r.created_at]
      .map(csvEscape)
      .join(',')
  );
  return [header, ...lines].join('\n');
}

function toJson(rows) {
  return JSON.stringify({
    exported_at:  new Date().toISOString(),
    count:        rows.length,
    truncated:    rows.length >= MAX_EXPORT_ROWS,
    logs:         rows,
  }, null, 2);
}

/**
 * CEF:0|Vendor|Product|Version|SignatureID|Name|Severity|Extensions
 * rt = receipt time (epoch ms), suser = source user, src = source IP
 */
function toCef(rows) {
  return rows.map(r => {
    const rt      = r.created_at ? new Date(r.created_at).getTime() : '';
    const suser   = r.user_id    ?? '';
    const src     = r.ip_address ?? '';
    const cs1     = r.entity_id  ?? '';
    const cs2     = r.entity_type ?? '';
    const outcome = r.http_status ?? '';
    return `CEF:0|CarbonThreat|Enterprise|1.0|${r.action}|${cs2} ${r.action}|5|rt=${rt} suser=${suser} src=${src} cs1=${cs1} cs1Label=EntityId cs2=${cs2} cs2Label=EntityType outcome=${outcome}`;
  }).join('\n');
}

/**
 * LEEF:2.0|Vendor|Product|Version|EventID|Attributes (tab-delimited)
 */
function toLeef(rows) {
  return rows.map(r => {
    const devTime = r.created_at ? new Date(r.created_at).toISOString() : '';
    const parts = [
      `devTime=${devTime}`,
      `cat=${r.entity_type ?? ''}`,
      `usrName=${r.user_id ?? ''}`,
      `src=${r.ip_address ?? ''}`,
      `resource=${r.entity_id ?? ''}`,
      `devStatus=${r.http_status ?? ''}`,
    ].join('\t');
    return `LEEF:2.0|CarbonThreat|Enterprise|1.0|${r.action}|${parts}`;
  }).join('\n');
}

/**
 * Elastic Common Schema — one JSON object per line (NDJSON).
 */
function toEcs(rows) {
  return rows.map(r => JSON.stringify({
    '@timestamp':                     r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    'event.dataset':                  'carbonthreat.audit',
    'event.action':                   r.action ?? '',
    'event.category':                 ['iam'],
    'event.outcome':                  r.http_status && r.http_status < 400 ? 'success' : 'failure',
    'user.id':                        r.user_id ?? null,
    'source.ip':                      r.ip_address ?? null,
    'carbonthreat.entity.type':       r.entity_type ?? null,
    'carbonthreat.entity.id':         r.entity_id ?? null,
    'http.response.status_code':      r.http_status ?? null,
  })).join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * @param {object} filters  — { action, entity_type, user_id, from, to }
 * @param {string} format   — 'csv' | 'json' | 'cef' | 'leef' | 'ecs'
 * @param {object} knex     — Knex instance
 * @returns {{ contentType: string, filename: string, body: string }}
 */
export async function exportAuditLogs(filters, format, knex) {
  const supported = ['csv', 'json', 'cef', 'leef', 'ecs'];
  if (!supported.includes(format)) {
    const err = new Error(`Unsupported format: ${format}`);
    err.status = 400;
    throw err;
  }

  const rows = await fetchLogs(filters, knex);
  const date = toDateStr();

  switch (format) {
    case 'csv':
      return { contentType: 'text/csv',              filename: `audit-${date}.csv`,   body: toCsv(rows)  };
    case 'json':
      return { contentType: 'application/json',      filename: `audit-${date}.json`,  body: toJson(rows) };
    case 'cef':
      return { contentType: 'text/plain',            filename: `audit-${date}.cef`,   body: toCef(rows)  };
    case 'leef':
      return { contentType: 'text/plain',            filename: `audit-${date}.leef`,  body: toLeef(rows) };
    case 'ecs':
      return { contentType: 'application/x-ndjson', filename: `audit-${date}.ndjson`, body: toEcs(rows)  };
  }
}
