'use strict';
/**
 * Production entry point.
 * Awaits app.create() (which runs DB migrations) before binding the server.
 */
const appFactory = require('./dist/app.js');

const fs = require('fs');
const http = require('http');
const https = require('https');

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
          console.log(`CarbonThreat listening securely on HTTPS port ${port}`);
        });
      } catch (err) {
        console.error('Failed to start TLS server. Check cert paths:', err.message);
        process.exit(1);
      }
    } else {
      http.createServer(app).listen(port, '0.0.0.0', () => {
        console.log(`CarbonThreat listening on HTTP port ${port}`);
      });
    }
  })
  .catch((err) => {
    console.error('Fatal startup error:', err.message);
    process.exit(1);
  });
