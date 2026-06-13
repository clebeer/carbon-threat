import { expect } from 'chai';
import sinon from 'sinon';

import bearer from '../../src/config/bearer.config.js';
import errors from '../../src/controllers/errors.js';
import { getMockRequest, getMockResponse } from '../mocks/express.mocks.js';
import jwt from '../../src/helpers/jwt.helper.js';
import userStatus from '../../src/helpers/userStatus.helper.js';

describe('config/bearer.config.js', () => {
    const validToken = 'asdf.asdf.asdf';
    let req, res, next;

    beforeEach(() => {
        req = getMockRequest();
        res = getMockResponse();
        next = sinon.spy();
        sinon.stub(errors, 'unauthorized');
        sinon.stub(errors, 'badRequest');
    });

    describe('with a valid JWT', () => {
        const provider = { foo: 'bar' };
        const verifyResult = {
            provider: {
                'foobar': provider
            },
            user: {
                username: 'whatever'
            }
        };

        beforeEach(() => {
            req.headers.authorization = `Bearer ${validToken}`;
            sinon.stub(jwt, 'verifyToken').returns(verifyResult);
            bearer.middleware(req, res, next);
        });

        it('sets the provider', () => {
            expect(req.provider).to.deep.eq(verifyResult.provider);
        });

        it('sets the user', () => {
            expect(req.user).to.deep.eq(verifyResult.user);
        });

        it('calls next', () => {
            expect(next).to.have.been.calledOnce;
        });
    });

    describe('without a bearer token', () => {
        beforeEach(() => {
            req.headers.authorization = validToken;
            bearer.middleware(req, res, next);
        });

        ('returns an unauthorized response', () => {
            expect(errors.unauthorized).to.have.been.calledWith(res);
        });
    });

    describe('without an auth header', () => {
        beforeEach(() => {
            bearer.middleware(req, res, next);
        });

        ('returns an unauthorized response', () => {
            expect(errors.unauthorized).to.have.been.calledWith(res);
        });
    });

    describe('with a generic error', () => {
        beforeEach(() => {
            req.headers.authorization = `Bearer ${validToken}`;
            sinon.stub(jwt, 'verifyToken').throws('Invalid JWT');
            bearer.middleware(req, res, next);
        });

        it('returns a badRequest response', () => {
            expect(errors.badRequest).to.have.been.calledWith('Invalid JWT', res);
        });
    });

    describe('enterprise principal re-validation (CT-2026-01)', () => {
        beforeEach(() => {
            req.headers.authorization = `Bearer ${validToken}`;
            // Fresh object per test — in production verifyToken returns a newly
            // parsed payload each request, so the middleware may mutate it.
            sinon.stub(jwt, 'verifyToken').returns({
                provider: { local: 'enc' },
                user: { id: 'u-1', email: 'a@b.c', role: 'viewer' },
            });
        });

        it('rejects a token belonging to a deactivated user', async () => {
            sinon.stub(userStatus, 'getAuthState').resolves({ id: 'u-1', role: 'viewer', is_active: false });
            await bearer.middleware(req, res, next);
            expect(next).to.not.have.been.called;
            expect(errors.unauthorized).to.have.been.calledWith(res);
        });

        it('overrides the token role with the current DB role', async () => {
            sinon.stub(userStatus, 'getAuthState').resolves({ id: 'u-1', role: 'admin', is_active: true });
            await bearer.middleware(req, res, next);
            expect(next).to.have.been.calledOnce;
            expect(req.user.role).to.eq('admin');
        });

        it('fails closed when the status lookup throws', async () => {
            sinon.stub(userStatus, 'getAuthState').rejects(new Error('db down'));
            await bearer.middleware(req, res, next);
            expect(next).to.not.have.been.called;
            expect(errors.unauthorized).to.have.been.calledWith(res);
        });

        it('keeps JWT claims for non-enterprise (OAuth) identities not in users table', async () => {
            sinon.stub(userStatus, 'getAuthState').resolves(null);
            await bearer.middleware(req, res, next);
            expect(next).to.have.been.calledOnce;
            expect(req.user.role).to.eq('viewer');
        });
    });
});
