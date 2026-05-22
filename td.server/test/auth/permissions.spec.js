/* global describe, it, beforeEach, afterEach */
import { expect } from 'chai';
import sinon from 'sinon';

import { requirePermission, invalidateCache, __resetCache } from '../../src/auth/permissions.js';
import db from '../../src/db/knex.js';
import loggerHelper from '../../src/helpers/logger.helper.js';

describe('auth/permissions.js — requirePermission', () => {
    let req, res, next;

    beforeEach(() => {
        req = { method: 'GET', path: '/api/test', user: undefined };
        res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub(),
        };
        next = sinon.stub();

        sinon.stub(loggerHelper.Logger.prototype, 'warn');
        sinon.stub(loggerHelper.Logger.prototype, 'info');
        sinon.stub(loggerHelper.Logger.prototype, 'error');

        // Reset the permission cache between tests
        __resetCache();
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should return 401 when req.user is missing', async () => {
        const middleware = requirePermission('threatmodel:read');
        await middleware(req, res, next);

        expect(res.status.calledOnceWith(401)).to.be.true;
        expect(res.json.calledOnce).to.be.true;
        expect(res.json.firstCall.args[0].error).to.equal('Unauthorized');
        expect(next.called).to.be.false;
    });

    it('should bypass (call next) for admin role regardless of permissions', async () => {
        req.user = { id: 'admin1', role: 'admin' };

        // Stub DB so we can verify it's NOT called for admin bypass
        const dbStub = sinon.stub(db, 'raw').resolves([]);

        const middleware = requirePermission('some:permission');
        await middleware(req, res, next);

        expect(next.calledOnce).to.be.true;
        expect(res.status.called).to.be.false;
        expect(dbStub.called).to.be.false;
    });

    it('should return 403 when user role has none of the required permissions', async () => {
        req.user = { id: 'user1', role: 'viewer' };

        // Mock DB to return an empty permission set (viewer has no write perms)
        sinon.stub(db, 'select').returns({
            join: sinon.stub().returns({
                where: sinon.stub().returns({
                    andWhere: sinon.stub().resolves([]),
                }),
            }),
        });

        const middleware = requirePermission('threatmodel:create');
        await middleware(req, res, next);

        expect(res.status.calledOnceWith(403)).to.be.true;
        expect(res.json.firstCall.args[0].error).to.equal('Forbidden: insufficient permissions');
        expect(next.called).to.be.false;
    });

    it('should call next() when user role has a matching permission', async () => {
        req.user = { id: 'user1', role: 'analyst' };

        // Mock DB to return matching permission
        sinon.stub(db, 'select').returns({
            join: sinon.stub().returns({
                where: sinon.stub().returns({
                    andWhere: sinon.stub().resolves([{ permission_key: 'threatmodel:read' }]),
                }),
            }),
        });

        const middleware = requirePermission('threatmodel:read');
        await middleware(req, res, next);

        expect(next.calledOnce).to.be.true;
        expect(res.status.called).to.be.false;
    });

    it('should accept any of multiple permission keys (OR semantics)', async () => {
        req.user = { id: 'user1', role: 'custom' };

        sinon.stub(db, 'select').returns({
            join: sinon.stub().returns({
                where: sinon.stub().returns({
                    andWhere: sinon.stub().resolves([
                        { permission_key: 'threatmodel:read' },
                    ]),
                }),
            }),
        });

        const middleware = requirePermission('threatmodel:create', 'threatmodel:read');
        await middleware(req, res, next);

        expect(next.calledOnce).to.be.true;
    });

    it('should use cached permissions within TTL', async () => {
        req.user = { id: 'user1', role: 'analyst' };

        const dbSelect = sinon.stub(db, 'select').returns({
            join: sinon.stub().returns({
                where: sinon.stub().returns({
                    andWhere: sinon.stub().resolves([
                        { permission_key: 'threatmodel:read' },
                    ]),
                }),
            }),
        });

        const middleware = requirePermission('threatmodel:read');

        // First call hits DB
        await middleware(req, res, next);
        expect(dbSelect.calledOnce).to.be.true;
        expect(next.calledOnce).to.be.true;

        // Reset for second call
        next = sinon.stub();
        res = { status: sinon.stub().returnsThis(), json: sinon.stub() };

        // Second call should use cache (DB not called again)
        await middleware(req, res, next);
        expect(dbSelect.calledOnce).to.be.true; // still only 1 call
        expect(next.calledOnce).to.be.true;
    });

    it('invalidateCache() should clear cache for a specific slug', async () => {
        req.user = { id: 'user1', role: 'analyst' };

        const dbSelect = sinon.stub(db, 'select').returns({
            join: sinon.stub().returns({
                where: sinon.stub().returns({
                    andWhere: sinon.stub().resolves([
                        { permission_key: 'threatmodel:read' },
                    ]),
                }),
            }),
        });

        const middleware = requirePermission('threatmodel:read');

        // First call populates cache
        await middleware(req, res, next);

        // Invalidate cache for 'analyst'
        invalidateCache('analyst');

        // Next call should hit DB again
        next = sinon.stub();
        res = { status: sinon.stub().returnsThis(), json: sinon.stub() };
        await middleware(req, res, next);

        expect(dbSelect.calledTwice).to.be.true;
    });

    it('invalidateCache() with no args should clear entire cache', async () => {
        req.user = { id: 'user1', role: 'analyst' };

        const dbSelect = sinon.stub(db, 'select').returns({
            join: sinon.stub().returns({
                where: sinon.stub().returns({
                    andWhere: sinon.stub().resolves([
                        { permission_key: 'threatmodel:read' },
                    ]),
                }),
            }),
        });

        const middleware = requirePermission('threatmodel:read');
        await middleware(req, res, next);

        // Invalidate all caches
        invalidateCache();

        next = sinon.stub();
        res = { status: sinon.stub().returnsThis(), json: sinon.stub() };
        await middleware(req, res, next);

        expect(dbSelect.calledTwice).to.be.true;
    });
});