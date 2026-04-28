"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.config = config;
exports.submitEnterpriseSetup = submitEnterpriseSetup;
exports.testDbConnection = testDbConnection;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _bcrypt = _interopRequireDefault(require("bcrypt"));
var _pg = require("pg");
var _knex = _interopRequireDefault(require("knex"));
var _knex2 = _interopRequireDefault(require("../db/knex.js"));
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { (0, _defineProperty2["default"])(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
var logger = _loggerHelper["default"].get('controllers/config.js');

/**
 * POST /api/config/test-db
 *
 * Validates external PostgreSQL credentials supplied by the Setup Wizard
 * before the user commits to them. Returns 200 on success or 400/503 on
 * failure with a human-readable error message.
 */
function testDbConnection(_x, _x2) {
  return _testDbConnection.apply(this, arguments);
}
/**
 * POST /api/config/setup
 *
 * Day-0 initialisation endpoint.  Accepts:
 *   {
 *     db:       { type, host, port, user, password, name }
 *     authType: 'local' | 'saml'
 *     admin?:   { email, displayName, password }   // only when authType === 'local'
 *     saml?:    { entryPoint, issuer, cert }         // only when authType === 'saml'
 *   }
 *
 * This endpoint is unauthenticated by design — it runs before any users exist.
 */
function _testDbConnection() {
  _testDbConnection = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(req, res) {
    var _ref, host, port, user, password, name, client, _t, _t2;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _ref = req.body || {}, host = _ref.host, port = _ref.port, user = _ref.user, password = _ref.password, name = _ref.name;
          if (!(!host || !user || !password || !name)) {
            _context.next = 1;
            break;
          }
          return _context.abrupt("return", res.status(400).json({
            error: 'host, user, password and name are required'
          }));
        case 1:
          client = new _pg.Client({
            host: host,
            port: parseInt(port, 10) || 5432,
            user: user,
            password: password,
            database: name,
            connectionTimeoutMillis: 5000,
            ssl: false
          });
          _context.prev = 2;
          _context.next = 3;
          return client.connect();
        case 3:
          _context.next = 4;
          return client.query('SELECT 1');
        case 4:
          _context.next = 5;
          return client.end();
        case 5:
          return _context.abrupt("return", res.json({
            ok: true
          }));
        case 6:
          _context.prev = 6;
          _t = _context["catch"](2);
          _context.prev = 7;
          _context.next = 8;
          return client.end();
        case 8:
          _context.next = 10;
          break;
        case 9:
          _context.prev = 9;
          _t2 = _context["catch"](7);
        case 10:
          logger.warn("DB test connection failed: ".concat(_t.message));
          return _context.abrupt("return", res.status(503).json({
            error: _t.message || 'Connection failed'
          }));
        case 11:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[2, 6], [7, 9]]);
  }));
  return _testDbConnection.apply(this, arguments);
}
function submitEnterpriseSetup(_x3, _x4) {
  return _submitEnterpriseSetup.apply(this, arguments);
}
/**
 * GET /api/config
 * Returns the current public-safe configuration (no secrets).
 */
function _submitEnterpriseSetup() {
  _submitEnterpriseSetup = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee2(req, res) {
    var _ref2, dbCfg, authType, admin, saml, targetDb, configs, _i, _configs, conf, usersExist, count, password_hash, _t3;
    return _regenerator["default"].wrap(function (_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          _ref2 = req.body || {}, dbCfg = _ref2.db, authType = _ref2.authType, admin = _ref2.admin, saml = _ref2.saml;
          if (authType) {
            _context2.next = 1;
            break;
          }
          return _context2.abrupt("return", res.status(400).json({
            error: 'authType is required'
          }));
        case 1:
          // If using an external database, wire up a separate Knex instance so we can
          // run migrations against the target host.  The default `db` instance points at
          // the server's own DATABASE_URL / DB_* vars.
          targetDb = _knex2["default"];
          if (dbCfg && dbCfg.type === 'external') {
            targetDb = (0, _knex["default"])({
              client: 'postgresql',
              connection: {
                host: dbCfg.host,
                port: parseInt(dbCfg.port, 10) || 5432,
                user: dbCfg.user,
                password: dbCfg.password,
                database: dbCfg.name
              },
              pool: {
                min: 1,
                max: 3
              }
            });
          }
          _context2.prev = 2;
          _context2.next = 3;
          return targetDb.raw("\n      CREATE TABLE IF NOT EXISTS app_config (\n        key          VARCHAR(255) PRIMARY KEY,\n        value        JSONB,\n        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()\n      )\n    ");
        case 3:
          // 2. Persist auth type and optional SAML config.
          configs = [{
            key: 'auth_type',
            value: JSON.stringify(authType)
          }];
          if (authType === 'saml' && saml) {
            configs.push({
              key: 'saml_config',
              value: JSON.stringify({
                entryPoint: saml.entryPoint,
                issuer: saml.issuer,
                cert: saml.cert
              })
            });
          }
          if (dbCfg) {
            // Store DB config without the password.
            configs.push({
              key: 'db_config',
              value: JSON.stringify({
                type: dbCfg.type,
                host: dbCfg.host || 'localhost',
                port: dbCfg.port || '5432',
                name: dbCfg.name || 'carbonthreat',
                user: dbCfg.user || ''
              })
            });
          }
          _i = 0, _configs = configs;
        case 4:
          if (!(_i < _configs.length)) {
            _context2.next = 6;
            break;
          }
          conf = _configs[_i];
          _context2.next = 5;
          return targetDb.raw("INSERT INTO app_config (key, value)\n         VALUES (?, ?)\n         ON CONFLICT (key) DO UPDATE SET value = ?, updated_at = NOW()", [conf.key, conf.value, conf.value]);
        case 5:
          _i++;
          _context2.next = 4;
          break;
        case 6:
          if (!(authType === 'local' && admin && admin.email && admin.password)) {
            _context2.next = 14;
            break;
          }
          _context2.next = 7;
          return targetDb.schema.hasTable('users');
        case 7:
          usersExist = _context2.sent;
          if (usersExist) {
            _context2.next = 8;
            break;
          }
          return _context2.abrupt("return", res.status(500).json({
            error: 'Users table does not exist. Run database migrations first.'
          }));
        case 8:
          _context2.next = 9;
          return targetDb('users').count('id as n').first();
        case 9:
          count = _context2.sent;
          if (!(parseInt(count.n, 10) === 0)) {
            _context2.next = 13;
            break;
          }
          if (!(admin.password.length < 12)) {
            _context2.next = 10;
            break;
          }
          return _context2.abrupt("return", res.status(400).json({
            error: 'Admin password must be at least 12 characters'
          }));
        case 10:
          _context2.next = 11;
          return _bcrypt["default"].hash(admin.password, 12);
        case 11:
          password_hash = _context2.sent;
          _context2.next = 12;
          return targetDb('users').insert({
            email: admin.email.toLowerCase().trim(),
            password_hash: password_hash,
            display_name: admin.displayName || 'System Administrator',
            role: 'admin',
            is_active: true
          });
        case 12:
          logger.info("Root admin created: ".concat(admin.email));
          _context2.next = 14;
          break;
        case 13:
          logger.warn('Setup called but users already exist — admin creation skipped.');
        case 14:
          logger.info("Enterprise setup completed (authType=".concat(authType, ")"));
          return _context2.abrupt("return", res.status(200).json({
            success: true,
            message: 'Setup completed successfully.'
          }));
        case 15:
          _context2.prev = 15;
          _t3 = _context2["catch"](2);
          logger.error('Enterprise setup failed', _t3);
          return _context2.abrupt("return", res.status(500).json({
            error: 'Setup failed',
            details: _t3.message
          }));
        case 16:
          _context2.prev = 16;
          if (!(targetDb !== _knex2["default"])) {
            _context2.next = 17;
            break;
          }
          _context2.next = 17;
          return targetDb.destroy()["catch"](function () {});
        case 17:
          return _context2.finish(16);
        case 18:
        case "end":
          return _context2.stop();
      }
    }, _callee2, null, [[2, 15, 16, 18]]);
  }));
  return _submitEnterpriseSetup.apply(this, arguments);
}
function config(_x5, _x6) {
  return _config.apply(this, arguments);
}
function _config() {
  _config = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee3(_req, res) {
    var rows, cfg, _t4;
    return _regenerator["default"].wrap(function (_context3) {
      while (1) switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          _context3.next = 1;
          return (0, _knex2["default"])('app_config').whereIn('key', ['auth_type', 'db_config']).select('key', 'value');
        case 1:
          rows = _context3.sent;
          cfg = Object.fromEntries(rows.map(function (r) {
            return [r.key, r.value];
          }));
          return _context3.abrupt("return", res.json(_objectSpread({
            status: 'configured'
          }, cfg)));
        case 2:
          _context3.prev = 2;
          _t4 = _context3["catch"](0);
          return _context3.abrupt("return", res.json({
            status: 'unconfigured'
          }));
        case 3:
        case "end":
          return _context3.stop();
      }
    }, _callee3, null, [[0, 2]]);
  }));
  return _config.apply(this, arguments);
}