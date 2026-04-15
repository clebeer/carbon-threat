import { expect } from 'chai';
import sinon from 'sinon';
import passport from 'passport';

import { setupAuth } from '../../src/auth/enterprise-sso.js';
import loggerHelper from '../../src/helpers/logger.helper.js';

describe('auth/enterprise-sso.js', () => {
    let appMock;

    beforeEach(() => {
        appMock = {
            use: sinon.stub()
        };

        // We stub get to return a mock logger, however, the module is ALREADY evaluated,
        // so `const logger = loggerHelper.get(...)` inside enterprise-sso.js has already executed
        // and holds an instance of Logger.
        // What we CAN do is stub `loggerHelper.Logger.prototype.error`
        sinon.stub(loggerHelper.Logger.prototype, 'error');
        sinon.stub(loggerHelper.Logger.prototype, 'warn');
        sinon.stub(loggerHelper.Logger.prototype, 'info');

        sinon.stub(passport, 'use');
        sinon.stub(passport, 'serializeUser');
        sinon.stub(passport, 'deserializeUser');
        sinon.stub(passport, 'initialize').returns('mockInitialize');
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should successfully setup auth', () => {
        setupAuth(appMock);

        expect(passport.use.calledOnce).to.be.true;
        expect(passport.serializeUser.calledOnce).to.be.true;
        expect(passport.deserializeUser.calledOnce).to.be.true;
        expect(passport.initialize.calledOnce).to.be.true;
        expect(appMock.use.calledWith('mockInitialize')).to.be.true;
        expect(loggerHelper.Logger.prototype.error.called).to.be.false;
    });

    it('should catch error and log it when configuration fails', () => {
        const fakeError = new Error('Passport misconfigured');
        passport.use.throws(fakeError);

        expect(() => setupAuth(appMock)).not.to.throw();

        expect(loggerHelper.Logger.prototype.error.calledOnce).to.be.true;

        // Let's check arguments, since logger format method receives the message and might prepend service name
        // Wait, the Logger implementation in logger.helper.js for error(message) calls this._formatMessage
        // But the call in enterprise-sso is: `logger.error('Failed to configure Enterprise SSO', error);`
        // Looking at Logger.prototype.error:
        // error (message) { this.logger.error(this._formatMessage(this.service, message, 'error')); }
        // It does not accept a second argument `error` properly, it just ignores it or _formatMessage handles it.
        // But let's check what enterprise-sso called logger.error with.

        expect(loggerHelper.Logger.prototype.error.firstCall.args[0]).to.equal('Failed to configure Enterprise SSO');
    });
});
