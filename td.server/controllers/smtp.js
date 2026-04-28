"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getSmtpConfig = getSmtpConfig;
exports.saveSmtpConfig = saveSmtpConfig;
exports.testSmtpConfig = testSmtpConfig;
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _nodemailer = _interopRequireDefault(require("nodemailer"));
var _knex = _interopRequireDefault(require("../db/knex.js"));
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
var _excluded = ["password"];
/**
 * SMTP configuration controller.
 *
 * Routes (all admin-only):
 *   GET    /api/config/smtp        — return current SMTP config (password redacted)
 *   PUT    /api/config/smtp        — persist SMTP config
 *   POST   /api/config/smtp/test   — send a test email to the logged-in admin
 */
var logger = _loggerHelper["default"].get('controllers/smtp.js');
var CONFIG_KEY = 'smtp_config';
function loadSmtp() {
  return _loadSmtp.apply(this, arguments);
}
function _loadSmtp() {
  _loadSmtp = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee() {
    var row;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.next = 1;
          return (0, _knex["default"])('app_config').where({
            key: CONFIG_KEY
          }).first();
        case 1:
          row = _context.sent;
          return _context.abrupt("return", row ? row.value : null);
        case 2:
        case "end":
          return _context.stop();
      }
    }, _callee);
  }));
  return _loadSmtp.apply(this, arguments);
}
function getSmtpConfig(_x, _x2) {
  return _getSmtpConfig.apply(this, arguments);
}
function _getSmtpConfig() {
  _getSmtpConfig = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee2(_req, res) {
    var cfg, _pw, safe, _t;
    return _regenerator["default"].wrap(function (_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          _context2.next = 1;
          return loadSmtp();
        case 1:
          cfg = _context2.sent;
          if (cfg) {
            _context2.next = 2;
            break;
          }
          return _context2.abrupt("return", res.json({
            smtp: null
          }));
        case 2:
          // Never return the password over the API
          _pw = cfg.password, safe = (0, _objectWithoutProperties2["default"])(cfg, _excluded);
          return _context2.abrupt("return", res.json({
            smtp: safe
          }));
        case 3:
          _context2.prev = 3;
          _t = _context2["catch"](0);
          logger.error('getSmtpConfig failed', _t);
          return _context2.abrupt("return", res.status(500).json({
            error: 'Failed to load SMTP config'
          }));
        case 4:
        case "end":
          return _context2.stop();
      }
    }, _callee2, null, [[0, 3]]);
  }));
  return _getSmtpConfig.apply(this, arguments);
}
function saveSmtpConfig(_x3, _x4) {
  return _saveSmtpConfig.apply(this, arguments);
}
function _saveSmtpConfig() {
  _saveSmtpConfig = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee3(req, res) {
    var _ref, host, port, user, password, from, secure, cfg, existing, jsonCfg, _t2;
    return _regenerator["default"].wrap(function (_context3) {
      while (1) switch (_context3.prev = _context3.next) {
        case 0:
          _ref = req.body || {}, host = _ref.host, port = _ref.port, user = _ref.user, password = _ref.password, from = _ref.from, secure = _ref.secure;
          if (!(!host || !port)) {
            _context3.next = 1;
            break;
          }
          return _context3.abrupt("return", res.status(400).json({
            error: 'host and port are required'
          }));
        case 1:
          cfg = {
            host: host,
            port: parseInt(port, 10) || 587,
            user: user || '',
            password: password || '',
            from: from || '',
            secure: Boolean(secure)
          }; // If password is blank, keep existing one
          if (password) {
            _context3.next = 3;
            break;
          }
          _context3.next = 2;
          return loadSmtp();
        case 2:
          existing = _context3.sent;
          if (existing !== null && existing !== void 0 && existing.password) cfg.password = existing.password;
        case 3:
          _context3.prev = 3;
          jsonCfg = JSON.stringify(cfg);
          _context3.next = 4;
          return (0, _knex["default"])('app_config').insert({
            key: CONFIG_KEY,
            value: jsonCfg
          }).onConflict('key').merge({
            value: jsonCfg,
            updated_at: _knex["default"].fn.now()
          });
        case 4:
          logger.info('SMTP config updated');
          return _context3.abrupt("return", res.json({
            ok: true
          }));
        case 5:
          _context3.prev = 5;
          _t2 = _context3["catch"](3);
          logger.error('saveSmtpConfig failed', _t2);
          return _context3.abrupt("return", res.status(500).json({
            error: 'Failed to save SMTP config'
          }));
        case 6:
        case "end":
          return _context3.stop();
      }
    }, _callee3, null, [[3, 5]]);
  }));
  return _saveSmtpConfig.apply(this, arguments);
}
function testSmtpConfig(_x5, _x6) {
  return _testSmtpConfig.apply(this, arguments);
}
function _testSmtpConfig() {
  _testSmtpConfig = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee4(req, res) {
    var _cfg, _req$body, _req$user, cfg, existing, transport, to, defaultFrom, _t3;
    return _regenerator["default"].wrap(function (_context4) {
      while (1) switch (_context4.prev = _context4.next) {
        case 0:
          _context4.prev = 0;
          cfg = req.body; // Fallback: If no host provided from UI, load entirely from DB
          if (!(!cfg || !cfg.host)) {
            _context4.next = 2;
            break;
          }
          _context4.next = 1;
          return loadSmtp();
        case 1:
          cfg = _context4.sent;
          _context4.next = 4;
          break;
        case 2:
          if (cfg.password) {
            _context4.next = 4;
            break;
          }
          _context4.next = 3;
          return loadSmtp();
        case 3:
          existing = _context4.sent;
          if (existing !== null && existing !== void 0 && existing.password) cfg.password = existing.password;
        case 4:
          if ((_cfg = cfg) !== null && _cfg !== void 0 && _cfg.host) {
            _context4.next = 5;
            break;
          }
          return _context4.abrupt("return", res.status(400).json({
            error: 'SMTP not configured yet'
          }));
        case 5:
          transport = _nodemailer["default"].createTransport({
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            auth: cfg.user ? {
              user: cfg.user,
              pass: cfg.password
            } : undefined
          });
          to = ((_req$body = req.body) === null || _req$body === void 0 ? void 0 : _req$body.to) || ((_req$user = req.user) === null || _req$user === void 0 ? void 0 : _req$user.email) || cfg.from || 'test@example.com';
          defaultFrom = cfg.user && cfg.user.includes('@') ? cfg.user : 'no-reply@' + (cfg.host.replace('smtp.', '') || 'carbonthreat.io');
          _context4.next = 6;
          return transport.sendMail({
            from: cfg.from || defaultFrom,
            to: to,
            subject: 'CarbonThreat — SMTP test',
            text: 'This is a test email from CarbonThreat Enterprise. Your outbound mail is working correctly.'
          });
        case 6:
          logger.info("SMTP test email sent to ".concat(to));
          return _context4.abrupt("return", res.json({
            ok: true,
            sentTo: to
          }));
        case 7:
          _context4.prev = 7;
          _t3 = _context4["catch"](0);
          logger.warn('SMTP test failed', _t3);
          return _context4.abrupt("return", res.status(503).json({
            error: _t3.message || 'SMTP test failed'
          }));
        case 8:
        case "end":
          return _context4.stop();
      }
    }, _callee4, null, [[0, 7]]);
  }));
  return _testSmtpConfig.apply(this, arguments);
}