/* global describe, it, beforeEach, afterEach */
import { expect } from 'chai';
import sinon from 'sinon';

import {
  assertTenantAccess,
  principalOrgId,
  scopeQuery,
  requireTenantScope,
  TenantScopeError,
} from '../../src/auth/tenantScope.js';
import loggerHelper from '../../src/helpers/logger.helper.js';

describe('auth/tenantScope.js', () => {
  beforeEach(() => {
    sinon.stub(loggerHelper.Logger.prototype, 'warn');
    sinon.stub(loggerHelper.Logger.prototype, 'info');
    sinon.stub(loggerHelper.Logger.prototype, 'error');
  });
  afterEach(() => sinon.restore());

  describe('principalOrgId', () => {
    it('returns null for a missing principal (never global)', () => {
      expect(principalOrgId(null)).to.equal(null);
      expect(principalOrgId(undefined)).to.equal(null);
      expect(principalOrgId({})).to.equal(null);
    });
    it('reads orgId or org_id', () => {
      expect(principalOrgId({ orgId: 'o1' })).to.equal('o1');
      expect(principalOrgId({ org_id: 'o2' })).to.equal('o2');
    });
  });

  describe('assertTenantAccess', () => {
    it('allows same-tenant access', () => {
      expect(assertTenantAccess({ orgId: 'o1' }, { orgId: 'o1' })).to.equal(true);
      expect(assertTenantAccess({ org_id: 'o1' }, { org_id: 'o1' })).to.equal(true);
    });

    it('denies a scopeless principal (BOLA / global fallback)', () => {
      expect(() => assertTenantAccess({}, { orgId: 'o1' })).to.throw(TenantScopeError).with.property('code', 'no_scope');
      expect(() => assertTenantAccess(null, { orgId: 'o1' })).to.throw(TenantScopeError);
    });

    it('denies cross-tenant access (IDOR)', () => {
      expect(() => assertTenantAccess({ orgId: 'o1' }, { orgId: 'o2' })).
        to.throw(TenantScopeError).with.property('code', 'cross_tenant');
    });

    it('denies a resource with no tenant scope', () => {
      expect(() => assertTenantAccess({ orgId: 'o1' }, {})).
        to.throw(TenantScopeError).with.property('code', 'resource_no_scope');
    });

    it('errors carry HTTP 403', () => {
      try { assertTenantAccess({ orgId: 'o1' }, { orgId: 'o2' }); }
      catch (e) { expect(e.status).to.equal(403); }
    });
  });

  describe('scopeQuery', () => {
    it('applies an org_id predicate to the query builder', () => {
      const qb = { where: sinon.stub().returnsThis() };
      const out = scopeQuery(qb, { orgId: 'o1' });
      expect(qb.where.calledOnceWith('org_id', 'o1')).to.equal(true);
      expect(out).to.equal(qb);
    });
    it('supports a custom column', () => {
      const qb = { where: sinon.stub().returnsThis() };
      scopeQuery(qb, { orgId: 'o1' }, 'organization_id');
      expect(qb.where.calledOnceWith('organization_id', 'o1')).to.equal(true);
    });
    it('throws (never returns an unscoped query) for a scopeless principal', () => {
      const qb = { where: sinon.stub().returnsThis() };
      expect(() => scopeQuery(qb, {})).to.throw(TenantScopeError).with.property('code', 'no_scope');
      expect(qb.where.called).to.equal(false);
    });
  });

  describe('requireTenantScope middleware', () => {
    let next, req, res;
    beforeEach(() => {
      req = { method: 'GET', path: '/api/v1/findings' };
      res = { status: sinon.stub().returnsThis(), json: sinon.stub() };
      next = sinon.stub();
    });

    it('401 when unauthenticated', () => {
      requireTenantScope(req, res, next);
      expect(res.status.calledWith(401)).to.equal(true);
      expect(next.called).to.equal(false);
    });

    it('403 when the principal has no tenant scope', () => {
      req.user = { id: 'u1' };
      requireTenantScope(req, res, next);
      expect(res.status.calledWith(403)).to.equal(true);
      expect(next.called).to.equal(false);
    });

    it('passes and sets req.orgId for a scoped principal', () => {
      req.user = { id: 'u1', orgId: 'o1' };
      requireTenantScope(req, res, next);
      expect(next.calledOnce).to.equal(true);
      expect(req.orgId).to.equal('o1');
    });
  });
});
