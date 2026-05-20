/* global describe, it, beforeEach, afterEach */
import { expect } from 'chai';
import sinon from 'sinon';

import { requireRole } from '../../src/auth/rbac.js';
import loggerHelper from '../../src/helpers/logger.helper.js';

describe('auth/rbac.js', () => {
    let req, res, next, middleware;

    beforeEach(() => {
        req = {
            method: 'GET',
            path: '/api/test'
        };

        res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };

        next = sinon.stub();

        sinon.stub(loggerHelper.Logger.prototype, 'warn');
        sinon.stub(loggerHelper.Logger.prototype, 'info');
        sinon.stub(loggerHelper.Logger.prototype, 'error');
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should return 401 when req.user is missing', () => {
        middleware = requireRole('admin');
        middleware(req, res, next);

        expect(loggerHelper.Logger.prototype.warn.calledOnce).to.be.true;
        expect(loggerHelper.Logger.prototype.warn.firstCall.args[0]).to.equal('RBAC: unauthenticated request to GET /api/test');

        expect(res.status.calledOnceWith(401)).to.be.true;
        expect(res.json.calledOnceWith({ error: 'Unauthorized' })).to.be.true;
        expect(next.called).to.be.false;
    });

    it('should return 403 when req.user.role does not match any required role', () => {
        req.user = { id: 'user123', role: 'viewer' };
        middleware = requireRole('admin', 'analyst');
        middleware(req, res, next);

        expect(loggerHelper.Logger.prototype.warn.calledOnce).to.be.true;
        expect(loggerHelper.Logger.prototype.warn.firstCall.args[0]).to.equal(
            'RBAC: user user123 (role=viewer) denied access to GET /api/test — requires one of [admin, analyst]'
        );

        expect(res.status.calledOnceWith(403)).to.be.true;
        expect(res.json.calledOnceWith({ error: 'Forbidden: insufficient permissions' })).to.be.true;
        expect(next.called).to.be.false;
    });

    it('should call next() when req.user.role matches a required role', () => {
        req.user = { id: 'user123', role: 'analyst' };
        middleware = requireRole('admin', 'analyst');
        middleware(req, res, next);

        expect(loggerHelper.Logger.prototype.warn.called).to.be.false;
        expect(res.status.called).to.be.false;
        expect(res.json.called).to.be.false;
        expect(next.calledOnce).to.be.true;
    });
});
