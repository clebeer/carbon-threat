import express from 'express';
import path from 'path';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import env from './env/Env.js';
import envConfig from './config/env.config';
import expressHelper from './helpers/express.helper.js';
import https from './config/https.config.js';
import loggerHelper from './helpers/logger.helper.js';
import parsers from './config/parsers.config.js';
import routes from './config/routes.config.js';
import securityHeaders from './config/securityheaders.config.js';
import { runMigrations } from './db/migrate.js';
import { upDir } from './helpers/path.helper.js';
import { openApiSpec } from './config/openapi.js';

/**
 * Validates that critical secret environment variables meet minimum entropy
 * requirements before the server accepts any requests.
 *
 * Rejects obviously weak values like 'asdfasdfasdf', short keys, or missing vars.
 * Called once at startup — throws so the process exits cleanly with a clear message.
 */
function assertSecretEntropy() {
    const REQUIRED_SECRETS = [
        { key: 'ENCRYPTION_JWT_SIGNING_KEY',         minLength: 32 },
        { key: 'ENCRYPTION_JWT_REFRESH_SIGNING_KEY', minLength: 32 },
    ];

    const errors = [];

    for (const { key, minLength } of REQUIRED_SECRETS) {
        const value = process.env[key];
        if (!value) {
            errors.push(`${key} is not set`);
            continue;
        }
        if (value.length < minLength) {
            errors.push(`${key} is too short (${value.length} chars, minimum ${minLength})`);
            continue;
        }
        // Reject keys with very low character variety (e.g. 'asdfasdfasdf', 'aaaaaaa')
        const uniqueChars = new Set(value).size;
        if (uniqueChars < 8) {
            errors.push(`${key} has insufficient entropy (only ${uniqueChars} unique characters — use openssl rand -base64 48)`);
        }
    }

    if (errors.length > 0) {
        throw new Error(
            `Startup aborted — insecure secret configuration:\n` +
            errors.map((e) => `  • ${e}`).join('\n') + '\n' +
            `Generate strong keys: openssl rand -base64 48`
        );
    }
}

const siteDir = path.join(__dirname, upDir, upDir, 'dist');
const docsDir = path.join(__dirname, upDir, upDir, 'docs');

// set up rate limiter: maximum of 6000 requests per 30 minute interval
const limiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 10 minutes
    max: 6000,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false // Disable the `X-RateLimit-*` headers
});

const create = async () => {
    let logger;

    try {
        envConfig.tryLoadDotEnv();
        // logging environment, env will always supply a value
        loggerHelper.level(env.get().config.LOG_LEVEL);
        logger = loggerHelper.get('app.js');

        // Reject weak/missing secrets before accepting any requests
        assertSecretEntropy();

        // Run pending database migrations before accepting any requests
        await runMigrations();

        const app = expressHelper.getInstance();
        app.set('trust proxy', true);
        // rate limiting only for production environemnts, otherwise automated e2e tests fail
        if (process.env.NODE_ENV === 'production') {
            app.use(limiter);
            logger.info('Apply rate limiting in production environments');
        } else {
            logger.warn('Rate limiting disabled for development environments');
        }

        // security headers
        securityHeaders.config(app);

        // Force HTTPS in production
        app.use(https.middleware);

        // static content
        app.use('/', express.static(siteDir));
        app.use('/public', express.static(siteDir));
        app.use('/docs', express.static(docsDir));

        // parsers
        parsers.config(app);

        // OpenAPI / Swagger UI — mount before routes so bearer middleware does not block
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
            customSiteTitle: 'CarbonThreat API Docs',
            swaggerOptions: { persistAuthorization: true },
        }));
        app.get('/api-docs.json', (_req, res) => res.json(openApiSpec));

        // routes
        routes.config(app);

        // env will always supply a value for the PORT
        app.set('port', env.get().config.PORT);
        logger.info('Express server listening on ' + app.get('port'));

        logger.info('OWASP Threat Dragon application started');
        return app;
    } catch (e) {
        if (!logger) { logger = console; }
        logger.error('OWASP Threat Dragon failed to start');
        logger.error(e.message);
        throw e;
    }
};

export default {
    create
};
