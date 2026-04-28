"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _express = _interopRequireDefault(require("express"));
var _path = _interopRequireDefault(require("path"));
var _expressRateLimit = _interopRequireDefault(require("express-rate-limit"));
var _swaggerUiExpress = _interopRequireDefault(require("swagger-ui-express"));
var _Env = _interopRequireDefault(require("./env/Env.js"));
var _env = _interopRequireDefault(require("./config/env.config"));
var _expressHelper = _interopRequireDefault(require("./helpers/express.helper.js"));
var _httpsConfig = _interopRequireDefault(require("./config/https.config.js"));
var _loggerHelper = _interopRequireDefault(require("./helpers/logger.helper.js"));
var _parsersConfig = _interopRequireDefault(require("./config/parsers.config.js"));
var _routesConfig = _interopRequireDefault(require("./config/routes.config.js"));
var _securityheadersConfig = _interopRequireDefault(require("./config/securityheaders.config.js"));
var _migrate = require("./db/migrate.js");
var _pathHelper = require("./helpers/path.helper.js");
var _openapi = require("./config/openapi.js");
/**
 * Validates that critical secret environment variables meet minimum entropy
 * requirements before the server accepts any requests.
 *
 * Rejects obviously weak values like 'asdfasdfasdf', short keys, or missing vars.
 * Called once at startup — throws so the process exits cleanly with a clear message.
 */
function assertSecretEntropy() {
  var REQUIRED_SECRETS = [{
    key: 'ENCRYPTION_JWT_SIGNING_KEY',
    minLength: 32
  }, {
    key: 'ENCRYPTION_JWT_REFRESH_SIGNING_KEY',
    minLength: 32
  }];
  var errors = [];
  for (var _i = 0, _REQUIRED_SECRETS = REQUIRED_SECRETS; _i < _REQUIRED_SECRETS.length; _i++) {
    var _REQUIRED_SECRETS$_i = _REQUIRED_SECRETS[_i],
      key = _REQUIRED_SECRETS$_i.key,
      minLength = _REQUIRED_SECRETS$_i.minLength;
    var value = process.env[key];
    if (!value) {
      errors.push("".concat(key, " is not set"));
      continue;
    }
    if (value.length < minLength) {
      errors.push("".concat(key, " is too short (").concat(value.length, " chars, minimum ").concat(minLength, ")"));
      continue;
    }
    // Reject keys with very low character variety (e.g. 'asdfasdfasdf', 'aaaaaaa')
    var uniqueChars = new Set(value).size;
    if (uniqueChars < 8) {
      errors.push("".concat(key, " has insufficient entropy (only ").concat(uniqueChars, " unique characters \u2014 use openssl rand -base64 48)"));
    }
  }
  if (errors.length > 0) {
    throw new Error("Startup aborted \u2014 insecure secret configuration:\n" + errors.map(function (e) {
      return "  \u2022 ".concat(e);
    }).join('\n') + '\n' + "Generate strong keys: openssl rand -base64 48");
  }
}
var siteDir = _path["default"].join(__dirname, _pathHelper.upDir, _pathHelper.upDir, 'dist');
var docsDir = _path["default"].join(__dirname, _pathHelper.upDir, _pathHelper.upDir, 'docs');

// set up rate limiter: maximum of 6000 requests per 30 minute interval
var limiter = (0, _expressRateLimit["default"])({
  windowMs: 30 * 60 * 1000,
  // 10 minutes
  max: 6000,
  standardHeaders: true,
  // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false // Disable the `X-RateLimit-*` headers
});
var create = /*#__PURE__*/function () {
  var _ref = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee() {
    var logger, app, _t;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _env["default"].tryLoadDotEnv();
          // logging environment, env will always supply a value
          _loggerHelper["default"].level(_Env["default"].get().config.LOG_LEVEL);
          logger = _loggerHelper["default"].get('app.js');

          // Reject weak/missing secrets before accepting any requests
          assertSecretEntropy();

          // Run pending database migrations before accepting any requests
          _context.next = 1;
          return (0, _migrate.runMigrations)();
        case 1:
          app = _expressHelper["default"].getInstance();
          app.set('trust proxy', true);
          // rate limiting only for production environemnts, otherwise automated e2e tests fail
          if (process.env.NODE_ENV === 'production') {
            app.use(limiter);
            logger.info('Apply rate limiting in production environments');
          } else {
            logger.warn('Rate limiting disabled for development environments');
          }

          // security headers
          _securityheadersConfig["default"].config(app);

          // Force HTTPS in production
          app.use(_httpsConfig["default"].middleware);

          // static content
          app.use('/', _express["default"]["static"](siteDir));
          app.use('/public', _express["default"]["static"](siteDir));
          app.use('/docs', _express["default"]["static"](docsDir));

          // parsers
          _parsersConfig["default"].config(app);

          // OpenAPI / Swagger UI — mount before routes so bearer middleware does not block
          app.use('/api-docs', _swaggerUiExpress["default"].serve, _swaggerUiExpress["default"].setup(_openapi.openApiSpec, {
            customSiteTitle: 'CarbonThreat API Docs',
            swaggerOptions: {
              persistAuthorization: true
            }
          }));
          app.get('/api-docs.json', function (_req, res) {
            return res.json(_openapi.openApiSpec);
          });

          // routes
          _routesConfig["default"].config(app);

          // env will always supply a value for the PORT
          app.set('port', _Env["default"].get().config.PORT);
          logger.info('Express server listening on ' + app.get('port'));
          logger.info('OWASP Threat Dragon application started');
          return _context.abrupt("return", app);
        case 2:
          _context.prev = 2;
          _t = _context["catch"](0);
          if (!logger) {
            logger = console;
          }
          logger.error('OWASP Threat Dragon failed to start');
          logger.error(_t.message);
          throw _t;
        case 3:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[0, 2]]);
  }));
  return function create() {
    return _ref.apply(this, arguments);
  };
}();
var _default = exports["default"] = {
  create: create
};