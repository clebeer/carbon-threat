import { expect } from 'chai';
import express from 'express';
import sinon from 'sinon';
import rateLimiter from 'express-rate-limit';

import appFactory from '../src/app.js';
import envConfig from '../src/config/env.config.js';
import env from '../src/env/Env.js';
import expressHelper from '../src/helpers/express.helper.js';
import https from '../src/config/https.config.js';
import { getMockApp } from './mocks/express.mocks.js';
import loggerHelper from '../src/helpers/logger.helper.js';
import parsersConfig from '../src/config/parsers.config.js';
import routesConfig from '../src/config/routes.config.js';
import securityHeaders from '../src/config/securityheaders.config.js';
import * as migrate from '../src/db/migrate.js';
import * as seed from '../src/db/seed.js';

describe('app.js main application', () => {
    let mockApp;
    const mockLogger = {
        info: () => {},
        error: () => {},
        warn: () => {}
    };

    beforeEach(() => {
        mockApp = getMockApp();
        sinon.stub(expressHelper, 'getInstance').returns(mockApp);
        sinon.stub(express, 'static');

        sinon.stub(securityHeaders, 'config');
        sinon.stub(parsersConfig, 'config');
        sinon.stub(routesConfig, 'config');
        sinon.stub(https, 'middleware');
        sinon.stub(loggerHelper, 'level');
        sinon.stub(loggerHelper, 'get').returns(mockLogger);
        sinon.stub(rateLimiter, 'rateLimit');

        // Stub async startup dependencies
        sinon.stub(migrate, 'runMigrations').resolves();
        sinon.stub(seed, 'runSeeds').resolves();
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('without errors', () => {
        beforeEach(async () => {
            process.env.NODE_ENV = 'production';
            sinon.stub(envConfig, 'tryLoadDotEnv');
            sinon.stub(env, 'get').returns({
                config: {
                    LOG_LEVEL: 'warn',
                    PORT: 3000
                }
            });
            await appFactory.create();
        });

        it('sets the log level', () => {
            expect(loggerHelper.level).to.have.been.calledWith('warn');
        });

        it('trusts proxies', () => {
            expect(mockApp.set).to.have.been.calledWith('trust proxy', 1);
        });

        it('adds the https middleware', () => {
            expect(mockApp.use).to.have.been.calledWith(https.middleware);
        });

        it('uses dotenv config', () => {
            expect(envConfig.tryLoadDotEnv).to.have.been.calledOnce;
        });
        
        it('uses static content', () => {
            expect(express.static).to.have.been.calledWith(sinon.match('dist'));
        });

        it('uses the security headers config', () => {
            expect(securityHeaders.config).to.have.been.calledOnce;
        });

        it('uses the parsers config', () => {
            expect(parsersConfig.config).to.have.been.calledOnce;
        });

        it('uses the routes config', () => {
            expect(routesConfig.config).to.have.been.calledOnce;
        });

        it('sets the port', () => {
            expect(mockApp.set).to.have.been.calledWith('port', 3000);
        });
    });

    describe('with default environment', () => {
        beforeEach(async () => {
            process.env.ENV_FILE = 'none';
            sinon.stub(envConfig, 'tryLoadDotEnv');
            sinon.stub(env, 'get').returns({
                config: {
                    LOG_LEVEL: 'warn',
                    PORT: 3000
                }
            });
            await appFactory.create();
        });

        it('sets the default log level', () => {
            expect(loggerHelper.level).to.have.been.calledWith('warn');
        });

        it('sets the default port', () => {
            expect(mockApp.set).to.have.been.calledWith('port', 3000);
        });
    });

    describe('with development environment', () => {
        beforeEach(async () => {
            process.env.NODE_ENV = 'development';
            sinon.stub(envConfig, 'tryLoadDotEnv');
            sinon.stub(env, 'get').returns({
                config: {
                    LOG_LEVEL: 'debug',
                    PORT: 3000
                }
            });
            await appFactory.create();
        });

        it('disables the rate limiting', () => {
            expect(rateLimiter.rateLimit).not.to.have.been.called;
        });
    });

    describe('with error', () => {
        const err = new Error('whoops!');

        it('rethrows the error', async () => {
            sinon.stub(envConfig, 'tryLoadDotEnv').throws(err);
            process.env.NODE_ENV = 'production';
            try {
                await appFactory.create();
                expect.fail('should have thrown');
            } catch (e) {
                expect(e.message).to.equal('whoops!');
            }
        });
    });
});