import { expect } from 'chai';
import sinon from 'sinon';

import * as julesController from '../../src/controllers/jules.controller.js';
import * as julesService from '../../src/integrations/jules/jules.service.js';

function makeReqRes({ user = { id: 1, role: 'analyst' }, params = {}, body = {}, query = {} } = {}) {
  const req = { user, params, body, query };
  const res = {
    _status: 200, _json: null,
    status(code) { this._status = code; return this; },
    json(data)   { this._json  = data; return this; },
  };
  return { req, res };
}

describe('jules.controller.js', () => {
  afterEach(() => sinon.restore());

  describe('listSources()', () => {
    it('returns sources from service', async () => {
      sinon.stub(julesService, 'getSources').resolves([{ name: 'sources/abc' }]);
      const { req, res } = makeReqRes();
      await julesController.listSources(req, res);
      expect(res._status).to.equal(200);
      expect(res._json.sources).to.deep.equal([{ name: 'sources/abc' }]);
    });

    it('returns 503 when API key not configured', async () => {
      sinon.stub(julesService, 'getSources').rejects(new Error('JULES_API_KEY is not configured'));
      const { req, res } = makeReqRes();
      await julesController.listSources(req, res);
      expect(res._status).to.equal(503);
      expect(res._json.error).to.include('API key');
    });
  });

  describe('createSession()', () => {
    it('returns 400 when finding_id is missing', async () => {
      const { req, res } = makeReqRes({ body: { source_name: 'sources/abc' } });
      await julesController.createSession(req, res);
      expect(res._status).to.equal(400);
      expect(res._json.error).to.include('finding_id');
    });

    it('returns 400 when source_name is missing', async () => {
      const { req, res } = makeReqRes({ body: { finding_id: 'finding-123' } });
      await julesController.createSession(req, res);
      expect(res._status).to.equal(400);
      expect(res._json.error).to.include('source_name');
    });

    it('returns 400 for invalid automation_mode', async () => {
      const { req, res } = makeReqRes({ body: { finding_id: 'f1', source_name: 's1', automation_mode: 'INVALID' } });
      await julesController.createSession(req, res);
      expect(res._status).to.equal(400);
    });

    it('creates session with valid payload', async () => {
      const fakeSession = { id: 'uuid-1', status: 'planning' };
      sinon.stub(julesService, 'createSession').resolves(fakeSession);
      const { req, res } = makeReqRes({ body: { finding_id: 'f1', source_name: 'sources/abc', automation_mode: 'AUTO_CREATE_PR' } });
      await julesController.createSession(req, res);
      expect(res._status).to.equal(201);
      expect(res._json.session).to.deep.equal(fakeSession);
    });

    it('defaults automation_mode to AUTO_CREATE_PR', async () => {
      const stub = sinon.stub(julesService, 'createSession').resolves({ id: 'uuid-2', status: 'planning' });
      const { req, res } = makeReqRes({ body: { finding_id: 'f1', source_name: 'sources/abc' } });
      await julesController.createSession(req, res);
      expect(stub.calledOnce).to.be.true;
      expect(stub.firstCall.args[0].automationMode).to.equal('AUTO_CREATE_PR');
    });
  });

  describe('getSession()', () => {
    it('returns 404 when session not found', async () => {
      sinon.stub(julesService, 'getSessionWithActivities').resolves(null);
      const { req, res } = makeReqRes({ params: { id: 'no-exist' } });
      await julesController.getSession(req, res);
      expect(res._status).to.equal(404);
    });

    it('returns session and activities', async () => {
      const data = { session: { id: 'uuid-1', status: 'running' }, activities: [] };
      sinon.stub(julesService, 'getSessionWithActivities').resolves(data);
      const { req, res } = makeReqRes({ params: { id: 'uuid-1' } });
      await julesController.getSession(req, res);
      expect(res._status).to.equal(200);
      expect(res._json).to.deep.equal(data);
    });
  });

  describe('approveSessionPlan()', () => {
    it('returns 409 when service throws statusCode 409', async () => {
      const err = Object.assign(new Error('Session is not awaiting approval'), { statusCode: 409 });
      sinon.stub(julesService, 'approvePlan').rejects(err);
      const { req, res } = makeReqRes({ params: { id: 'uuid-1' } });
      await julesController.approveSessionPlan(req, res);
      expect(res._status).to.equal(409);
    });

    it('returns session on success', async () => {
      const session = { id: 'uuid-1', status: 'running' };
      sinon.stub(julesService, 'approvePlan').resolves(session);
      const { req, res } = makeReqRes({ params: { id: 'uuid-1' } });
      await julesController.approveSessionPlan(req, res);
      expect(res._status).to.equal(200);
      expect(res._json.session).to.deep.equal(session);
    });
  });

  describe('sendSessionMessage()', () => {
    it('returns 400 when message is missing', async () => {
      const { req, res } = makeReqRes({ params: { id: 'uuid-1' }, body: {} });
      await julesController.sendSessionMessage(req, res);
      expect(res._status).to.equal(400);
      expect(res._json.error).to.include('message');
    });

    it('returns ok on success', async () => {
      sinon.stub(julesService, 'sendMessage').resolves();
      const { req, res } = makeReqRes({ params: { id: 'uuid-1' }, body: { message: 'hello' } });
      await julesController.sendSessionMessage(req, res);
      expect(res._status).to.equal(200);
      expect(res._json.ok).to.be.true;
    });
  });

  describe('deleteSession()', () => {
    it('returns 200 on success', async () => {
      sinon.stub(julesService, 'deleteSession').resolves();
      const { req, res } = makeReqRes({ params: { id: 'uuid-1' } });
      await julesController.deleteSession(req, res);
      expect(res._status).to.equal(200);
      expect(res._json.ok).to.be.true;
    });

    it('returns 404 when not found', async () => {
      const err = Object.assign(new Error('Session not found'), { statusCode: 404 });
      sinon.stub(julesService, 'deleteSession').rejects(err);
      const { req, res } = makeReqRes({ params: { id: 'no-exist' } });
      await julesController.deleteSession(req, res);
      expect(res._status).to.equal(404);
    });
  });

  describe('listSessions()', () => {
    it('returns paginated sessions', async () => {
      const result = { sessions: [], total: 0, page: 1, limit: 20 };
      sinon.stub(julesService, 'listSessions').resolves(result);
      const { req, res } = makeReqRes({ query: { page: '1', limit: '20' } });
      await julesController.listSessions(req, res);
      expect(res._status).to.equal(200);
      expect(res._json).to.deep.equal(result);
    });
  });
});
