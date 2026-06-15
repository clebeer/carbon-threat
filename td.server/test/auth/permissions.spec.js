/**
 * Unit tests — auth/permissions.js
 *
 * Stubs: db (knex), logger
 * Tests: requirePermission middleware, invalidateCache, getEffectivePermissions
 */

import { expect } from 'chai';
import sinon from 'sinon';

import db from '../../src/db/knex.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeReqRes(user) {
  const req = { user, method: 'GET', path: '/api/test' };
  const res = {
    _status: 200,
    _json: null,
    status(code) { this._status = code; return this; },
    json(data)   { this._json  = data; return this; },
  };
  const next = sinon.stub();
  return { req, res, next };
}

// Stub db chain: db('role_permissions').join(...).where(...).select(...)
function stubDbPermissions(keys) {
  const chain = {
    join:   sinon.stub().returnsThis(),
    where:  sinon.stub().returnsThis(),
    select: sinon.stub().resolves(keys.map((k) => ({ permission_key: k }))),
  };
  return sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => chain);
}

// ── import after we can stub ──────────────────────────────────────────────────

describe('auth/permissions.js', () => {
  let requirePermission, invalidateCache, getEffectivePermissions;
  let dbStub;

  before(async () => {
    // Dynamic import so stubs apply at first use
    const mod = await import('../../src/auth/permissions.js');
    requirePermission       = mod.requirePermission;
    invalidateCache         = mod.invalidateCache;
    getEffectivePermissions = mod.getEffectivePermissions;
  });

  afterEach(() => {
    sinon.restore();
    // Clear cache between tests so each test starts fresh
    invalidateCache();
  });

  // ── requirePermission ────────────────────────────────────────────────────────

  describe('requirePermission', () => {
    it('returns 401 when req.user is absent', async () => {
      const middleware = requirePermission('roles:manage');
      const { req, res, next } = makeReqRes(undefined);

      await middleware(req, res, next);

      expect(res._status).to.equal(401);
      expect(res._json).to.deep.equal({ error: 'Unauthorized' });
      expect(next.called).to.be.false;
    });

    it('calls next() immediately for admin role (full bypass)', async () => {
      const middleware = requirePermission('roles:manage');
      const { req, res, next } = makeReqRes({ id: '1', role: 'admin' });

      await middleware(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(res._status).to.equal(200); // untouched
    });

    it('returns 403 when role lacks the required permission', async () => {
      // Stub DB to return no matching permissions
      dbStub = sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => ({
        join:   sinon.stub().returnsThis(),
        where:  sinon.stub().returnsThis(),
        select: sinon.stub().resolves([]),
      }));

      const middleware = requirePermission('roles:manage');
      const { req, res, next } = makeReqRes({ id: '2', role: 'viewer' });

      await middleware(req, res, next);

      expect(res._status).to.equal(403);
      expect(res._json.error).to.include('Forbidden');
      expect(next.called).to.be.false;
    });

    it('calls next() when role has the required permission', async () => {
      dbStub = sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => ({
        join:   sinon.stub().returnsThis(),
        where:  sinon.stub().returnsThis(),
        select: sinon.stub().resolves([{ permission_key: 'roles:manage' }]),
      }));

      const middleware = requirePermission('roles:manage');
      const { req, res, next } = makeReqRes({ id: '3', role: 'custom-admin' });

      await middleware(req, res, next);

      expect(next.calledOnce).to.be.true;
    });

    it('passes when ANY of several keys is granted (logical OR)', async () => {
      dbStub = sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => ({
        join:   sinon.stub().returnsThis(),
        where:  sinon.stub().returnsThis(),
        select: sinon.stub().resolves([{ permission_key: 'scanner:run' }]),
      }));

      const middleware = requirePermission('roles:manage', 'scanner:run');
      const { req, res, next } = makeReqRes({ id: '4', role: 'analyst' });

      await middleware(req, res, next);

      expect(next.calledOnce).to.be.true;
    });

    it('uses cache on second call (DB queried only once)', async () => {
      const selectStub = sinon.stub().resolves([{ permission_key: 'roles:manage' }]);
      dbStub = sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => ({
        join:   sinon.stub().returnsThis(),
        where:  sinon.stub().returnsThis(),
        select: selectStub,
      }));

      const middleware = requirePermission('roles:manage');
      const user = { id: '5', role: 'custom-role' };

      await middleware({ ...makeReqRes(user).req }, makeReqRes(user).res, sinon.stub());
      await middleware({ ...makeReqRes(user).req }, makeReqRes(user).res, sinon.stub());

      expect(selectStub.callCount).to.equal(1);
    });
  });

  // ── invalidateCache ──────────────────────────────────────────────────────────

  describe('invalidateCache', () => {
    it('forces a fresh DB query after cache is cleared for a slug', async () => {
      const selectStub = sinon.stub().resolves([{ permission_key: 'roles:manage' }]);
      dbStub = sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => ({
        join:   sinon.stub().returnsThis(),
        where:  sinon.stub().returnsThis(),
        select: selectStub,
      }));

      const middleware = requirePermission('roles:manage');
      const user = { id: '6', role: 'invalidation-test' };

      await middleware({ ...makeReqRes(user).req }, makeReqRes(user).res, sinon.stub());
      invalidateCache('invalidation-test');
      await middleware({ ...makeReqRes(user).req }, makeReqRes(user).res, sinon.stub());

      expect(selectStub.callCount).to.equal(2);
    });
  });

  // ── getEffectivePermissions ───────────────────────────────────────────────────

  describe('getEffectivePermissions', () => {
    it('returns all catalog keys for admin role (no DB query)', async () => {
      dbStub = sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => ({
        join:   sinon.stub().returnsThis(),
        where:  sinon.stub().returnsThis(),
        select: sinon.stub().rejects(new Error('Should not be called')),
      }));

      const perms = await getEffectivePermissions({ role: 'admin' });

      expect(perms).to.be.an('array').that.includes('roles:manage');
      expect(perms).to.include('threatmodel:create');
      expect(perms.length).to.be.greaterThan(10);
    });

    it('returns DB-resolved keys for non-admin roles', async () => {
      dbStub = sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => ({
        join:   sinon.stub().returnsThis(),
        where:  sinon.stub().returnsThis(),
        select: sinon.stub().resolves([
          { permission_key: 'scanner:read' },
          { permission_key: 'scanner:run' },
        ]),
      }));

      const perms = await getEffectivePermissions({ role: 'analyst' });

      expect(perms).to.deep.equal(['scanner:read', 'scanner:run']);
    });

    it('returns empty array on DB error (non-blocking)', async () => {
      dbStub = sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => ({
        join:   sinon.stub().returnsThis(),
        where:  sinon.stub().returnsThis(),
        select: sinon.stub().rejects(new Error('DB failure')),
      }));

      const perms = await getEffectivePermissions({ role: 'broken-role' });

      expect(perms).to.deep.equal([]);
    });
  });
});
