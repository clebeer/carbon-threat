'use strict';
/**
 * Production entry point.
 * Awaits app.create() (which runs DB migrations) before binding the server.
 */
const appFactory = require('./dist/app.js');
const loggerHelper = require('./dist/helpers/logger.helper.js').default;

const fs = require('fs');
const http = require('http');
const https = require('https');

const logger = loggerHelper.get('server.js');

appFactory.default
  .create()
  .then((app) => {
    const port = app.get('port') || process.env.PORT || 3001;
    const useTls = process.env.APP_USE_TLS === 'true';

    if (useTls) {
      try {
        const options = {
          cert: fs.readFileSync(process.env.APP_TLS_CERT_PATH || '/etc/ssl/certs/fullchain.pem'),
          key: fs.readFileSync(process.env.APP_TLS_KEY_PATH || '/etc/ssl/certs/privkey.pem')
        };
        https.createServer(options, app).listen(port, '0.0.0.0', () => {
          logger.info(`CarbonThreat listening securely on HTTPS port ${port}`);
        });
      } catch (err) {
        logger.error(`Failed to start TLS server. Check cert paths: ${err.message}`);
        process.exit(1);
      }
    } else {
      http.createServer(app).listen(port, '0.0.0.0', () => {
        logger.info(`CarbonThreat listening on HTTP port ${port}`);
      });
    }
  })
  .catch((err) => {
    logger.error(`Fatal startup error: ${err.message}`);
    process.exit(1);
  });
