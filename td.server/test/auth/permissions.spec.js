/**
 * Unit tests — auth/permissions.js
 *
 * The knex default export is a CALLABLE (`db('role_permissions')`), which cannot be
 * intercepted by stubbing a method on the imported binding. We inject a mock `db`
 * via proxyquire so the permission query returns controlled rows and no real database
 * connection is attempted.
 *
 * Stubs: db (knex, injected). Cache is cleared between tests via invalidateCache().
 */

import { expect } from 'chai';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

// ── injected mock db ─────────────────────────────────────────────────────────
// A callable knex mock; each call returns a query-builder whose terminal `.select()`
// resolves to the rows configured per test.
const dbStub = sinon.stub();

const { requirePermission, invalidateCache, getEffectivePermissions } = proxyquire(
  '../../src/auth/permissions.js',
  { '../db/knex.js': { __esModule: true, default: dbStub, '@noCallThru': true } },
);

// ── helpers ───────────────────────────────────────────────────────────────────

function makeReqRes(user) {
  const req = { user, method: 'GET', path: '/api/test' };
  const res = {
    _status: 200,
    _json: null,
    status(code) { this._status = code; return this; },
    json(data) { this._json = data; return this; },
  };
  const next = sinon.stub();
  return { req, res, next };
}

/**
 * Configures the mock `db('role_permissions').join(...).where(...).select(...)` chain
 * to resolve to the given permission keys. Returns the terminal `.select` stub so
 * tests can assert how many times the query ran (cache behaviour).
 */
function setPerms(keys) {
  const select = sinon.stub().resolves(keys.map((k) => ({ permission_key: k })));
  dbStub.returns({ join: sinon.stub().returnsThis(), where: sinon.stub().returnsThis(), select });
  return select;
}

/** Configures the query to reject, simulating a DB failure. */
function setPermsError(err) {
  const select = sinon.stub().rejects(err);
  dbStub.returns({ join: sinon.stub().returnsThis(), where: sinon.stub().returnsThis(), select });
  return select;
}

describe('auth/permissions.js', () => {
  beforeEach(() => {
    dbStub.reset();
    invalidateCache(); // fresh cache per test
  });

  afterEach(() => {
    sinon.restore();
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
      setPerms([]); // no matching permissions

      const middleware = requirePermission('roles:manage');
      const { req, res, next } = makeReqRes({ id: '2', role: 'viewer' });

      await middleware(req, res, next);

      expect(res._status).to.equal(403);
      expect(res._json.error).to.include('Forbidden');
      expect(next.called).to.be.false;
    });

    it('calls next() when role has the required permission', async () => {
      setPerms(['roles:manage']);

      const middleware = requirePermission('roles:manage');
      const { req, res, next } = makeReqRes({ id: '3', role: 'custom-admin' });

      await middleware(req, res, next);

      expect(next.calledOnce).to.be.true;
    });

    it('passes when ANY of several keys is granted (logical OR)', async () => {
      setPerms(['scanner:run']);

      const middleware = requirePermission('roles:manage', 'scanner:run');
      const { req, res, next } = makeReqRes({ id: '4', role: 'analyst' });

      await middleware(req, res, next);

      expect(next.calledOnce).to.be.true;
    });

    it('uses cache on second call (DB queried only once)', async () => {
      const selectStub = setPerms(['roles:manage']);

      const middleware = requirePermission('roles:manage');
      const user = { id: '5', role: 'custom-role' };

      await middleware(makeReqRes(user).req, makeReqRes(user).res, sinon.stub());
      await middleware(makeReqRes(user).req, makeReqRes(user).res, sinon.stub());

      expect(selectStub.callCount).to.equal(1);
    });
  });

  // ── invalidateCache ──────────────────────────────────────────────────────────

  describe('invalidateCache', () => {
    it('forces a fresh DB query after cache is cleared for a slug', async () => {
      const selectStub = setPerms(['roles:manage']);

      const middleware = requirePermission('roles:manage');
      const user = { id: '6', role: 'invalidation-test' };

      await middleware(makeReqRes(user).req, makeReqRes(user).res, sinon.stub());
      invalidateCache('invalidation-test');
      await middleware(makeReqRes(user).req, makeReqRes(user).res, sinon.stub());

      expect(selectStub.callCount).to.equal(2);
    });
  });

  // ── getEffectivePermissions ───────────────────────────────────────────────────

  describe('getEffectivePermissions', () => {
    it('returns all catalog keys for admin role (no DB query)', async () => {
      const perms = await getEffectivePermissions({ role: 'admin' });

      expect(perms).to.be.an('array').that.includes('roles:manage');
      expect(perms).to.include('threatmodel:create');
      expect(perms.length).to.be.greaterThan(10);
      expect(dbStub.called).to.be.false; // admin bypass — no query
    });

    it('returns DB-resolved keys for non-admin roles', async () => {
      setPerms(['scanner:read', 'scanner:run']);

      const perms = await getEffectivePermissions({ role: 'analyst' });

      expect(perms).to.deep.equal(['scanner:read', 'scanner:run']);
    });

    it('returns empty array on DB error (non-blocking)', async () => {
      setPermsError(new Error('DB failure'));

      const perms = await getEffectivePermissions({ role: 'broken-role' });

      expect(perms).to.deep.equal([]);
    });
  });
});
