/**
 * Unit tests — services/auditExportService.js
 *
 * Uses an in-memory knex (sqlite3) so no real Postgres is needed.
 */

import { describe, it, before, after } from 'mocha';
import { strict as assert } from 'assert';
import knex from 'knex';
import { exportAuditLogs, MAX_EXPORT_ROWS } from '../../src/services/auditExportService.js';

// ── In-memory SQLite test DB ───────────────────────────────────────────────

let db;

const SAMPLE_ROWS = [
  { id: 1, action: 'USER_CREATE', entity_type: 'USER', entity_id: 'u-1', user_id: 'admin-uuid', ip_address: '127.0.0.1', http_status: 201, created_at: new Date('2025-01-15T10:00:00Z') },
  { id: 2, action: 'ROLE_DELETE', entity_type: 'ROLE', entity_id: 'r-1', user_id: 'admin-uuid', ip_address: '127.0.0.1', http_status: 200, created_at: new Date('2025-01-16T11:00:00Z') },
];

// Try the available in-memory SQLite drivers. Neither better-sqlite3 nor sqlite3
// is a declared dependency, so on a default install knex() throws synchronously.
// Returning null lets the suite skip instead of crashing the whole mocha run.
function makeSqliteKnex() {
  for (const client of ['better-sqlite3', 'sqlite3']) {
    try {
      return knex({ client, connection: ':memory:', useNullAsDefault: true });
    } catch {
      // driver not installed — try the next one
    }
  }
  return null;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('auditExportService', function () {
  before(async function () {
    db = makeSqliteKnex();
    if (!db) {
      // No in-memory SQLite driver installed — skip rather than poison the run.
      this.skip();
      return;
    }
    await db.schema.createTable('audit_logs', (t) => {
      t.increments('id');
      t.string('action', 100).notNullable();
      t.string('entity_type', 100);
      t.string('entity_id', 255);
      t.string('user_id', 255);
      t.string('ip_address', 45);
      t.integer('http_status');
      t.datetime('created_at').defaultTo(db.fn.now());
    });
    await db('audit_logs').insert(SAMPLE_ROWS);
  });

  after(async () => {
    if (db) { await db.destroy(); }
  });

  it('exportAuditLogs — csv has correct header and row count', async () => {
    const { contentType, filename, body } = await exportAuditLogs({}, 'csv', db);
    assert.equal(contentType, 'text/csv');
    assert.match(filename, /^audit-.*\.csv$/);
    const lines = body.trim().split('\n');
    assert.equal(lines[0], 'id,action,entity_type,entity_id,user_id,ip_address,http_status,created_at');
    assert.equal(lines.length, SAMPLE_ROWS.length + 1); // header + rows
  });

  it('exportAuditLogs — json envelope has count and logs array', async () => {
    const { contentType, body } = await exportAuditLogs({}, 'json', db);
    assert.equal(contentType, 'application/json');
    const parsed = JSON.parse(body);
    assert.equal(parsed.count, SAMPLE_ROWS.length);
    assert.ok(Array.isArray(parsed.logs));
    assert.ok('exported_at' in parsed);
  });

  it('exportAuditLogs — cef lines start with "CEF:0|CarbonThreat"', async () => {
    const { contentType, body } = await exportAuditLogs({}, 'cef', db);
    assert.equal(contentType, 'text/plain');
    body.split('\n').forEach(line => {
      if (line.trim()) assert.ok(line.startsWith('CEF:0|CarbonThreat|Enterprise|1.0|'));
    });
  });

  it('exportAuditLogs — leef lines start with "LEEF:2.0|CarbonThreat"', async () => {
    const { contentType, body } = await exportAuditLogs({}, 'leef', db);
    assert.equal(contentType, 'text/plain');
    body.split('\n').forEach(line => {
      if (line.trim()) assert.ok(line.startsWith('LEEF:2.0|CarbonThreat|Enterprise|1.0|'));
    });
  });

  it('exportAuditLogs — ecs lines are valid JSON with @timestamp', async () => {
    const { contentType, body } = await exportAuditLogs({}, 'ecs', db);
    assert.equal(contentType, 'application/x-ndjson');
    body.split('\n').forEach(line => {
      if (line.trim()) {
        const obj = JSON.parse(line);
        assert.ok('@timestamp' in obj);
        assert.ok('event.action' in obj);
      }
    });
  });

  it('exportAuditLogs — filters by action', async () => {
    const { body } = await exportAuditLogs({ action: 'USER_CREATE' }, 'json', db);
    const parsed = JSON.parse(body);
    assert.equal(parsed.count, 1);
    assert.equal(parsed.logs[0].action, 'USER_CREATE');
  });

  it('exportAuditLogs — unknown format throws with status 400', async () => {
    try {
      await exportAuditLogs({}, 'xml', db);
      assert.fail('should have thrown');
    } catch (err) {
      assert.equal(err.status, 400);
    }
  });

  it('MAX_EXPORT_ROWS constant is defined and positive', () => {
    assert.ok(typeof MAX_EXPORT_ROWS === 'number');
    assert.ok(MAX_EXPORT_ROWS > 0);
  });
});
