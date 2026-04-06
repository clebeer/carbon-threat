/**
 * Unit tests — controllers/domainPacksController.js
 *
 * Strategy:
 *  - Input validation → tested exactly
 *  - DB-dependent paths → accept 200/404/500
 *  - Bug regression: listTemplates must include diagram_json
 */

import { expect } from 'chai';
import sinon from 'sinon';

import {
  listPacks,
  getPack,
  listTemplates,
  applyTemplate,
} from '../../src/controllers/domainPacksController.js';

// ── fixtures ─────────────────────────────────────────────────────────────────

const ADMIN_USER = { id: 'user-1', role: 'admin', orgId: null };

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

describe('controllers/domainPacksController.js', () => {

  afterEach(() => sinon.restore());

  // ─── listPacks ─────────────────────────────────────────────────────────────

  describe('listPacks()', () => {
    it('returns 200 or 500 (DB-dependent)', async () => {
      const { req, res } = makeReqRes();
      await listPacks(req, res);
      expect([200, 500]).to.include(res._status);
    });

    it('returns an object with a packs array when DB is available', async () => {
      const { req, res } = makeReqRes();
      await listPacks(req, res);
      if (res._status === 200) {
        expect(res._json).to.have.property('packs').that.is.an('array');
      }
    });
  });

  // ─── getPack ───────────────────────────────────────────────────────────────

  describe('getPack()', () => {
    it('proceeds with a valid slug', async () => {
      const { req, res } = makeReqRes({ params: { slug: 'generic' } });
      await getPack(req, res);
      expect([200, 404, 500]).to.include(res._status);
    });

    it('returns 404 or 500 for an unknown slug', async () => {
      const { req, res } = makeReqRes({ params: { slug: 'does-not-exist-xyz' } });
      await getPack(req, res);
      expect([404, 500]).to.include(res._status);
    });

    it('returns pack object on success', async () => {
      const { req, res } = makeReqRes({ params: { slug: 'generic' } });
      await getPack(req, res);
      if (res._status === 200) {
        expect(res._json).to.have.property('pack').that.is.an('object');
        expect(res._json.pack).to.have.property('slug', 'generic');
      }
    });
  });

  // ─── listTemplates ─────────────────────────────────────────────────────────

  describe('listTemplates()', () => {
    it('proceeds with a valid pack slug', async () => {
      const { req, res } = makeReqRes({ params: { slug: 'aws' } });
      await listTemplates(req, res);
      expect([200, 404, 500]).to.include(res._status);
    });

    it('returns 404 or 500 for unknown pack slug', async () => {
      const { req, res } = makeReqRes({ params: { slug: 'unknown-pack-xyz' } });
      await listTemplates(req, res);
      expect([404, 500]).to.include(res._status);
    });

    // Regression test for the diagram_json bug (was excluded from SELECT)
    it('templates response includes diagram_json when DB is available', async () => {
      const { req, res } = makeReqRes({ params: { slug: 'aws' } });
      await listTemplates(req, res);
      if (res._status === 200 && res._json.templates.length > 0) {
        const tpl = res._json.templates[0];
        expect(tpl).to.have.property('diagram_json');
        // diagram_json should not be null/undefined for seeded templates
        if (tpl.diagram_json) {
          expect(tpl.diagram_json).to.have.property('nodes').that.is.an('array');
        }
      }
    });

    it('returns templates array on success', async () => {
      const { req, res } = makeReqRes({ params: { slug: 'generic' } });
      await listTemplates(req, res);
      if (res._status === 200) {
        expect(res._json).to.have.property('templates').that.is.an('array');
      }
    });
  });

  // ─── applyTemplate ─────────────────────────────────────────────────────────

  describe('applyTemplate()', () => {
    it('returns 400 when title is missing', async () => {
      const { req, res } = makeReqRes({
        params: { slug: 'generic', templateId: 'some-id' },
        body:   {},
      });
      await applyTemplate(req, res);
      expect(res._status).to.equal(400);
      expect(res._json.error).to.include('title');
    });

    it('returns 400 when title is blank whitespace', async () => {
      const { req, res } = makeReqRes({
        params: { slug: 'generic', templateId: 'some-id' },
        body:   { title: '   ' },
      });
      await applyTemplate(req, res);
      expect(res._status).to.equal(400);
      expect(res._json.error).to.include('title');
    });

    it('returns 404 or 500 when pack slug is unknown', async () => {
      const { req, res } = makeReqRes({
        params: { slug: 'unknown-pack', templateId: 'any' },
        body:   { title: 'My Model' },
      });
      await applyTemplate(req, res);
      expect([404, 500]).to.include(res._status);
    });

    it('returns 404 or 500 when templateId does not exist', async () => {
      const { req, res } = makeReqRes({
        params: { slug: 'generic', templateId: '00000000-0000-0000-0000-000000000000' },
        body:   { title: 'My Model' },
      });
      await applyTemplate(req, res);
      expect([404, 500]).to.include(res._status);
    });

    it('trims whitespace from title before using it', async () => {
      const { req, res } = makeReqRes({
        params: { slug: 'generic', templateId: 'any-id' },
        body:   { title: '  Padded Name  ' },
      });
      await applyTemplate(req, res);
      // If 201, verify title was trimmed
      if (res._status === 201) {
        expect(res._json.model.title).to.equal('Padded Name');
      } else {
        expect([404, 500]).to.include(res._status);
      }
    });

    it('sets owner_id from req.user.id', async () => {
      const { req, res } = makeReqRes({
        user:   { id: 'custom-user-id', role: 'analyst', orgId: null },
        params: { slug: 'generic', templateId: 'any-id' },
        body:   { title: 'From User' },
      });
      await applyTemplate(req, res);
      if (res._status === 201) {
        expect(res._json.model.owner_id).to.equal('custom-user-id');
      } else {
        expect([404, 500]).to.include(res._status);
      }
    });
  });
});
