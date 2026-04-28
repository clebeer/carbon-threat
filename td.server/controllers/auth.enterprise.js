"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.bootstrapAdmin = bootstrapAdmin;
exports.localLogin = localLogin;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _bcrypt = _interopRequireDefault(require("bcrypt"));
var _knex = _interopRequireDefault(require("../db/knex.js"));
var _jwtHelper = _interopRequireDefault(require("../helpers/jwt.helper.js"));
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
var _token = _interopRequireDefault(require("../repositories/token.js"));
var logger = _loggerHelper["default"].get('controllers/auth.enterprise.js');

/**
 * POST /api/auth/local/login
 * Authenticates a user with email + password and returns a JWT pair.
 * Compatible with the existing bearer.config.js middleware — the access token
 * can be used in Authorization: Bearer <token> headers for all protected routes.
 */
function localLogin(_x, _x2) {
  return _localLogin.apply(this, arguments);
}
/**
 * POST /api/auth/local/register
 * Creates the first admin account when no users exist yet (bootstrap only).
 * Once any user exists this endpoint returns 403 — use the admin UI thereafter.
 */
function _localLogin() {
  _localLogin = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(req, res) {
    var _ref, email, password, user, dummyHash, valid, _yield$jwtHelper$crea, accessToken, refreshToken, _t, _t2;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _ref = req.body || {}, email = _ref.email, password = _ref.password;
          if (!(!email || !password)) {
            _context.next = 1;
            break;
          }
          return _context.abrupt("return", res.status(400).json({
            error: 'email and password are required'
          }));
        case 1:
          _context.prev = 1;
          _context.next = 2;
          return (0, _knex["default"])('users').where({
            email: email.toLowerCase().trim(),
            is_active: true
          }).first();
        case 2:
          user = _context.sent;
          // Constant-time-ish: always run bcrypt even when no user found to prevent timing attacks
          dummyHash = '$2b$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXXX';
          if (!user) {
            _context.next = 4;
            break;
          }
          _context.next = 3;
          return _bcrypt["default"].compare(password, user.password_hash);
        case 3:
          _t = _context.sent;
          _context.next = 6;
          break;
        case 4:
          _context.next = 5;
          return _bcrypt["default"].compare(password, dummyHash).then(function () {
            return false;
          });
        case 5:
          _t = _context.sent;
        case 6:
          valid = _t;
          if (!(!user || !valid)) {
            _context.next = 7;
            break;
          }
          logger.warn("Failed login attempt for email: ".concat(email));
          return _context.abrupt("return", res.status(401).json({
            error: 'Invalid credentials'
          }));
        case 7:
          _context.next = 8;
          return _jwtHelper["default"].createAsync('local', {
            type: 'local',
            orgId: user.org_id || null
          }, {
            id: user.id,
            email: user.email,
            role: user.role
          });
        case 8:
          _yield$jwtHelper$crea = _context.sent;
          accessToken = _yield$jwtHelper$crea.accessToken;
          refreshToken = _yield$jwtHelper$crea.refreshToken;
          // Update last_login_at without blocking the response
          (0, _knex["default"])('users').where({
            id: user.id
          }).update({
            last_login_at: _knex["default"].fn.now()
          })["catch"](function (err) {
            return logger.error('Failed to update last_login_at', err);
          });

          // Register the refresh token so /api/token/refresh can validate it
          _context.next = 9;
          return _token["default"].add(refreshToken);
        case 9:
          logger.info("Successful login: ".concat(user.email, " (role=").concat(user.role, ")"));
          return _context.abrupt("return", res.json({
            accessToken: accessToken,
            refreshToken: refreshToken,
            user: {
              id: user.id,
              email: user.email,
              role: user.role
            }
          }));
        case 10:
          _context.prev = 10;
          _t2 = _context["catch"](1);
          logger.error('Error during local login', _t2);
          return _context.abrupt("return", res.status(500).json({
            error: 'Internal server error'
          }));
        case 11:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[1, 10]]);
  }));
  return _localLogin.apply(this, arguments);
}
function bootstrapAdmin(_x3, _x4) {
  return _bootstrapAdmin.apply(this, arguments);
}
function _bootstrapAdmin() {
  _bootstrapAdmin = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee2(req, res) {
    var count, _ref2, email, password, password_hash, _yield$db$insert$retu, _yield$db$insert$retu2, user, _t3;
    return _regenerator["default"].wrap(function (_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          _context2.next = 1;
          return (0, _knex["default"])('users').count('id as n').first();
        case 1:
          count = _context2.sent;
          if (!(parseInt(count.n, 10) > 0)) {
            _context2.next = 2;
            break;
          }
          return _context2.abrupt("return", res.status(403).json({
            error: 'Bootstrap is only allowed when no users exist'
          }));
        case 2:
          _ref2 = req.body || {}, email = _ref2.email, password = _ref2.password;
          if (!(!email || !password)) {
            _context2.next = 3;
            break;
          }
          return _context2.abrupt("return", res.status(400).json({
            error: 'email and password are required'
          }));
        case 3:
          if (!(password.length < 12)) {
            _context2.next = 4;
            break;
          }
          return _context2.abrupt("return", res.status(400).json({
            error: 'Password must be at least 12 characters'
          }));
        case 4:
          _context2.next = 5;
          return _bcrypt["default"].hash(password, 12);
        case 5:
          password_hash = _context2.sent;
          _context2.next = 6;
          return (0, _knex["default"])('users').insert({
            email: email.toLowerCase().trim(),
            password_hash: password_hash,
            role: 'admin'
          }).returning(['id', 'email', 'role']);
        case 6:
          _yield$db$insert$retu = _context2.sent;
          _yield$db$insert$retu2 = (0, _slicedToArray2["default"])(_yield$db$insert$retu, 1);
          user = _yield$db$insert$retu2[0];
          logger.info("Bootstrap admin created: ".concat(user.email));
          return _context2.abrupt("return", res.status(201).json({
            message: 'Admin account created',
            user: user
          }));
        case 7:
          _context2.prev = 7;
          _t3 = _context2["catch"](0);
          logger.error('Error during admin bootstrap', _t3);
          return _context2.abrupt("return", res.status(500).json({
            error: 'Internal server error'
          }));
        case 8:
        case "end":
          return _context2.stop();
      }
    }, _callee2, null, [[0, 7]]);
  }));
  return _bootstrapAdmin.apply(this, arguments);
}