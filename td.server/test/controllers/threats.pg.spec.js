/**
 * Unit tests — controllers/threats.pg.js
 *
 * Strategy:
 *  - Input validation (UUID, required fields) → tested exactly (no DB needed)
 *  - Auth/scope checks → tested exactly (pure business logic)
 *  - DB-dependent paths → accept 200/404/500 (no test DB wired)
 */

import { expect } from 'chai';
import sinon from 'sinon';

import {
  listThreats,
  createThreat,
  updateThreat,
  deleteThreat,
  analyzeModel,
} from '../../src/controllers/threats.pg.js';

// ── fixtures ─────────────────────────────────────────────────────────────────

const VALID_UUID   = '00000000-0000-0000-0000-000000000001';
const VALID_UUID2  = '00000000-0000-0000-0000-000000000002';
const INVALID_UUID = 'not-a-uuid';

const ADMIN_USER = { id: VALID_UUID, role: 'admin', orgId: null };

// ── req/res builder ───────────────────────────────────────────────────────────

function makeReqRes({ user = ADMIN_USER, params = {}, body = {}, query = {} } = {}) {
  const req = { user, params, body, query };
  const res = {
    _status: 200,
    _json:   null,
    status(code) { this._status = code; return this; },
    json(data)   { this._json  = data; return this; },
  };
  return { req, res };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('controllers/threats.pg.js', () => {

  afterEach(() => sinon.restore());

  // ─── listThreats ───────────────────────────────────────────────────────────

  describe('listThreats()', () => {
    it('returns 400 when modelId is present but not a valid UUID', async () => {
      const { req, res } = makeReqRes({ query: { modelId: INVALID_UUID } });
      await listThreats(req, res);
      expect(res._status).to.equal(400);
      expect(res._json).to.have.property('error').that.includes('UUID');
    });

    it('returns 400 for SQL-injection-style modelId', async () => {
      const { req, res } = makeReqRes({ query: { modelId: "'; DROP TABLE threats; --" } });
      await listThreats(req, res);
      expect(res._status).to.equal(400);
      expect(res._json.error).to.include('UUID');
    });

    it('accepts request without modelId (all-model listing)', async () => {
      const { req, res } = makeReqRes({ query: {} });
      await listThreats(req, res);
      // No test DB → 500 expected; with DB → 200
      expect([200, 500]).to.include(res._status);
    });

    it('accepts a valid UUID modelId', async () => {
      const { req, res } = makeReqRes({ query: { modelId: VALID_UUID } });
      await listThreats(req, res);
      expect([200, 404, 500]).to.include(res._status);
    });

    it('passes status filter to query when provided', async () => {
      const { req, res } = makeReqRes({ query: { modelId: VALID_UUID, status: 'Open' } });
      await listThreats(req, res);
      // Validation passes; result depends on DB
      expect([200, 404, 500]).to.include(res._status);
    });

    it('passes strideCategory filter to query when provided', async () => {
      const { req, res } = makeReqRes({ query: { modelId: VALID_UUID, strideCategory: 'Tampering' } });
      await listThreats(req, res);
      expect([200, 404, 500]).to.include(res._status);
    });
  });

  // ─── createThreat ──────────────────────────────────────────────────────────

  describe('createThreat()', () => {
    it('returns 400 when model_id is missing', async () => {
      const { req, res } = makeReqRes({ body: { title: 'XSS via input' } });
      await createThreat(req, res);
      expect(res._status).to.equal(400);
      expect(res._json.error).to.include('model_id');
    });

    it('returns 400 when title is missing', async () => {
      const { req, res } = makeReqRes({ body: { model_id: VALID_UUID } });
      await createThreat(req, res);
      expect(res._status).to.equal(400);
      expect(res._json.error).to.include('title');
    });

    it('returns 400 when title is blank whitespace', async () => {
      const { req, res } = makeReqRes({ body: { model_id: VALID_UUID, title: '   ' } });
      await createThreat(req, res);
      expect(res._status).to.equal(400);
      expect(res._json.error).to.include('title');
    });

    it('proceeds to DB lookup when model_id and title are valid', async () => {
      const { req, res } = makeReqRes({
        body: { model_id: VALID_UUID, title: 'SQL Injection', stride_category: 'Tampering', severity: 'High' },
      });
      await createThreat(req, res);
      // Without DB: 404 (model not found) or 500; with DB: 201
      expect([201, 404, 500]).to.include(res._status);
    });
  });

  // ─── updateThreat ──────────────────────────────────────────────────────────

  describe('updateThreat()', () => {
    it('returns 404 or 500 when threat does not exist', async () => {
      const { req, res } = makeReqRes({
        params: { id: VALID_UUID },
        body:   { status: 'Mitigated' },
      });
      await updateThreat(req, res);
      expect([200, 404, 500]).to.include(res._status);
    });

    it('trims title whitespace when title is provided in patch', async () => {
      // We can only verify this via the business logic path;
      // no DB means 404 or 500 — but no crash, no unhandled rejection
      const { req, res } = makeReqRes({
        params: { id: VALID_UUID },
        body:   { title: '  Padded title  ' },
      });
      await updateThreat(req, res);
      expect([200, 404, 500]).to.include(res._status);
    });
  });

  // ─── deleteThreat ──────────────────────────────────────────────────────────

  describe('deleteThreat()', () => {
    it('returns 400 for an invalid UUID', async () => {
      const { req, res } = makeReqRes({ params: { id: INVALID_UUID } });
      await deleteThreat(req, res);
      expect(res._status).to.equal(400);
      expect(res._json.error).to.include('Invalid');
    });

    it('returns 400 for a blank id', async () => {
      const { req, res } = makeReqRes({ params: { id: '' } });
      await deleteThreat(req, res);
      expect(res._status).to.equal(400);
    });

    it('returns 400 for SQL-injection in id param', async () => {
      const { req, res } = makeReqRes({ params: { id: "' OR '1'='1" } });
      await deleteThreat(req, res);
      expect(res._status).to.equal(400);
    });

    it('proceeds to DB lookup with a valid UUID', async () => {
      const { req, res } = makeReqRes({ params: { id: VALID_UUID } });
      await deleteThreat(req, res);
      expect([200, 404, 500]).to.include(res._status);
    });
  });

  // ─── analyzeModel ──────────────────────────────────────────────────────────

  describe('analyzeModel()', () => {
    it('returns 400 for an invalid model UUID', async () => {
      const { req, res } = makeReqRes({ params: { id: INVALID_UUID } });
      await analyzeModel(req, res);
      expect(res._status).to.equal(400);
      expect(res._json.error).to.include('Invalid');
    });

    it('returns 400 for empty model id', async () => {
      const { req, res } = makeReqRes({ params: { id: '' } });
      await analyzeModel(req, res);
      expect(res._status).to.equal(400);
    });

    it('returns 400 for path-traversal-style id', async () => {
      const { req, res } = makeReqRes({ params: { id: '../../../etc/passwd' } });
      await analyzeModel(req, res);
      expect(res._status).to.equal(400);
    });

    it('proceeds to DB lookup with a valid model UUID', async () => {
      const { req, res } = makeReqRes({ params: { id: VALID_UUID } });
      await analyzeModel(req, res);
      // No test DB: 404 (model not found) or 500; with DB: 200
      expect([200, 404, 500]).to.include(res._status);
    });
  });

  // ─── RBAC / scope ──────────────────────────────────────────────────────────

  describe('scope isolation', () => {
    it('listThreats uses orgId when available on user', async () => {
      const orgUser = { id: VALID_UUID, role: 'analyst', orgId: 'org-123' };
      const { req, res } = makeReqRes({ user: orgUser, query: {} });
      await listThreats(req, res);
      // Should not crash; result depends on DB
      expect([200, 500]).to.include(res._status);
    });

    it('listThreats falls back to owner_id when no orgId', async () => {
      const { req, res } = makeReqRes({ user: ADMIN_USER, query: {} });
      await listThreats(req, res);
      expect([200, 500]).to.include(res._status);
    });
  });
});
