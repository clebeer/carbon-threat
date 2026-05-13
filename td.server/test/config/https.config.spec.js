import { expect } from 'chai';
import sinon from 'sinon';

import { getMockRequest, getMockResponse } from '../mocks/express.mocks.js';
import httpsConfig from '../../src/config/https.config.js';

describe('config/https.config.js', () => {
    let req, res, next;

    beforeEach(() => {
        req = getMockRequest();
        res = getMockResponse();
        next = sinon.spy();
    });

    describe('simulated production', () => {
        describe('upgrading an insecure request', () => {
            beforeEach(() => {
                res.secure = false;
                httpsConfig.middleware(req, res, next);
            });

            it('calls next (passthrough middleware)', () => {
                expect(next).to.have.been.calledOnce;
            });
        });

        describe('allowing a secure request to continue', () => {
            beforeEach(() => {
                res.secure = true;
                httpsConfig.middleware(req, res, next);
            });

            it('does not redirect', () => {
                expect(res.redirect).not.to.have.been.calledOnce;
            });

            it('calls next', () => {
                expect(next).to.have.been.calledOnce;
            });
        });
    });

    describe('development', () => {
        beforeEach(() => {
            res.secure = false;
            httpsConfig.middleware(req, res, next);
        });

        it('does not redirect', () => {
            expect(res.redirect).not.to.have.been.calledOnce;
        });

        it('calls next', () => {
            expect(next).to.have.been.calledOnce;
        });
    });
});