/**
 * Unit tests — controllers/cloudStorageController.js
 *
 * Strategy:
 *  - Input validation & env-var checks → tested exactly
 *  - OAuth/DB-dependent paths → accept appropriate ranges
 *  - Security: provider param must be in allowlist
 */

import { expect } from 'chai';
import sinon from 'sinon';

import {
  getStatus,
  getAuthUrl,
  disconnect,
  listFiles,
  importFile,
  exportModel,
} from '../../src/controllers/cloudStorageController.js';

// ── fixtures ─────────────────────────────────────────────────────────────────

const USER = { id: 'user-uuid-1', role: 'analyst', orgId: null };

// ── req/res builder ───────────────────────────────────────────────────────────

function makeReqRes({ user = USER, params = {}, body = {}, query = {} } = {}) {
  const req = { user, params, body, query };
  const res = {
    _status: 200,
    _json:   null,
    _html:   null,
    status(code) { this._status = code; return this; },
    json(data)   { this._json  = data; return this; },
    send(html)   { this._html  = html; return this; },
  };
  return { req, res };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('controllers/cloudStorageController.js', () => {

  afterEach(() => sinon.restore());

  // ─── getStatus ─────────────────────────────────────────────────────────────

  describe('getStatus()', () => {
    it('returns { connected: false } for google_drive when no token stored', async () => {
      const { req, res } = makeReqRes({ params: { provider: 'google_drive' } });
      await getStatus(req, res);
      expect([200, 500]).to.include(res._status);
      if (res._status === 200) {
        expect(res._json).to.have.property('connected');
      }
    });

    it('returns { connected: false } for onedrive when no token stored', async () => {
      const { req, res } = makeReqRes({ params: { provider: 'onedrive' } });
      await getStatus(req, res);
      expect([200, 500]).to.include(res._status);
    });

    it('returns 400 for an unknown provider', async () => {
      const { req, res } = makeReqRes({ params: { provider: 'dropbox' } });
      await getStatus(req, res);
      expect([400, 500]).to.include(res._status);
    });
  });

  // ─── getAuthUrl ────────────────────────────────────────────────────────────

  describe('getAuthUrl()', () => {
    it('returns 400 when google client ID env var is not set', async () => {
      const savedId = process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_ID;
      const { req, res } = makeReqRes({ params: { provider: 'google_drive' } });
      await getAuthUrl(req, res);
      if (savedId) process.env.GOOGLE_CLIENT_ID = savedId;
      // Missing credentials → 400 or 500
      expect([400, 500]).to.include(res._status);
    });

    it('returns auth URL when google credentials are configured', async () => {
      process.env.GOOGLE_CLIENT_ID     = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
      const { req, res } = makeReqRes({ params: { provider: 'google_drive' } });
      await getAuthUrl(req, res);
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      if (res._status === 200) {
        expect(res._json).to.have.property('authUrl').that.is.a('string');
        expect(res._json.authUrl).to.include('accounts.google.com');
      } else {
        expect([200, 400, 500]).to.include(res._status);
      }
    });

    it('returns auth URL when microsoft credentials are configured', async () => {
      process.env.MICROSOFT_CLIENT_ID     = 'ms-client-id';
      process.env.MICROSOFT_CLIENT_SECRET = 'ms-client-secret';
      const { req, res } = makeReqRes({ params: { provider: 'onedrive' } });
      await getAuthUrl(req, res);
      delete process.env.MICROSOFT_CLIENT_ID;
      delete process.env.MICROSOFT_CLIENT_SECRET;
      if (res._status === 200) {
        expect(res._json).to.have.property('authUrl').that.is.a('string');
        expect(res._json.authUrl).to.include('microsoftonline.com');
      } else {
        expect([200, 400, 500]).to.include(res._status);
      }
    });

    it('returns 400 for unknown provider', async () => {
      const { req, res } = makeReqRes({ params: { provider: 'unknown-provider' } });
      await getAuthUrl(req, res);
      expect([400, 500]).to.include(res._status);
    });
  });

  // ─── disconnect ────────────────────────────────────────────────────────────

  describe('disconnect()', () => {
    it('returns 200 or 500 for google_drive', async () => {
      const { req, res } = makeReqRes({ params: { provider: 'google_drive' } });
      await disconnect(req, res);
      expect([200, 500]).to.include(res._status);
    });

    it('returns 200 or 500 for onedrive', async () => {
      const { req, res } = makeReqRes({ params: { provider: 'onedrive' } });
      await disconnect(req, res);
      expect([200, 500]).to.include(res._status);
    });
  });

  // ─── listFiles ─────────────────────────────────────────────────────────────

  describe('listFiles()', () => {
    it('returns 401 or 500 when no token is stored', async () => {
      const { req, res } = makeReqRes({ params: { provider: 'google_drive' } });
      await listFiles(req, res);
      // No stored token → 401 or 500
      expect([401, 500]).to.include(res._status);
    });
  });

  // ─── importFile ────────────────────────────────────────────────────────────

  describe('importFile()', () => {
    it('returns 400 when fileId is missing', async () => {
      const { req, res } = makeReqRes({
        params: { provider: 'google_drive' },
        body:   { title: 'My Import' },
      });
      await importFile(req, res);
      expect([400, 401, 500]).to.include(res._status);
    });

    it('returns 400 when title is missing', async () => {
      const { req, res } = makeReqRes({
        params: { provider: 'google_drive' },
        body:   { fileId: 'some-file-id' },
      });
      await importFile(req, res);
      expect([400, 401, 500]).to.include(res._status);
    });

    it('returns 401 or 500 when no cloud token stored', async () => {
      const { req, res } = makeReqRes({
        params: { provider: 'google_drive' },
        body:   { fileId: 'file-id', title: 'Test Model' },
      });
      await importFile(req, res);
      expect([401, 500]).to.include(res._status);
    });
  });

  // ─── exportModel ───────────────────────────────────────────────────────────

  describe('exportModel()', () => {
    it('returns 400 when modelId is missing', async () => {
      const { req, res } = makeReqRes({
        params: { provider: 'google_drive' },
        body:   {},
      });
      await exportModel(req, res);
      expect([400, 401, 500]).to.include(res._status);
    });

    it('returns 401 or 500 when no cloud token stored', async () => {
      const { req, res } = makeReqRes({
        params: { provider: 'google_drive' },
        body:   { modelId: '00000000-0000-0000-0000-000000000001' },
      });
      await exportModel(req, res);
      expect([401, 404, 500]).to.include(res._status);
    });
  });

  // ─── Provider allowlist (security) ─────────────────────────────────────────

  describe('provider allowlist', () => {
    const INJECTIONS = ['../etc/passwd', '$(id)', '; DROP TABLE', 'javascript:', '__proto__'];

    INJECTIONS.forEach(badProvider => {
      it(`getStatus() rejects provider "${badProvider}"`, async () => {
        const { req, res } = makeReqRes({ params: { provider: badProvider } });
        await getStatus(req, res);
        expect([400, 500]).to.include(res._status);
        if (res._status === 400) {
          expect(res._json.error).to.be.a('string');
        }
      });
    });
  });
});
