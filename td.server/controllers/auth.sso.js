"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.samlCallback = samlCallback;
exports.samlLogin = samlLogin;
exports.samlMetadata = samlMetadata;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _passportSaml = require("passport-saml");
var _passport = _interopRequireDefault(require("passport"));
var _knex = _interopRequireDefault(require("../db/knex.js"));
var _jwtHelper = _interopRequireDefault(require("../helpers/jwt.helper.js"));
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
var _samlConfig = require("../config/saml.config.js");
/**
 * SSO / SAML 2.0 authentication controller.
 *
 * Flows:
 *   GET  /api/auth/sso/saml          → redirect to IdP login page
 *   POST /api/auth/sso/saml/callback ← IdP posts SAML assertion here
 *   GET  /api/auth/sso/saml/metadata → expose SP metadata XML to IdP admins
 *
 * On successful assertion the user is upserted into the `users` table
 * (role defaults to 'viewer' on first login) and a JWT pair is issued,
 * compatible with the existing bearer.config.js middleware.
 */

var logger = _loggerHelper["default"].get('controllers/auth.sso.js');

// ── Strategy initialisation (lazy — only if SAML env vars are present) ────

var _strategy = null;
function getStrategy() {
  if (_strategy) return _strategy;
  if (!(0, _samlConfig.isSamlEnabled)()) {
    throw new Error('SAML is not configured. Set SAML_ENTRY_POINT, SAML_ISSUER, SAML_CERT and SAML_CALLBACK_URL.');
  }
  _strategy = new _passportSaml.Strategy((0, _samlConfig.getSamlConfig)(), /*#__PURE__*/function () {
    var _ref = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(profile, done) {
      var _ref2, email, displayName, user, _yield$db$insert$retu, _yield$db$insert$retu2, _t;
      return _regenerator["default"].wrap(function (_context) {
        while (1) switch (_context.prev = _context.next) {
          case 0:
            _context.prev = 0;
            email = (_ref2 = profile.email || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || profile.nameID) === null || _ref2 === void 0 ? void 0 : _ref2.toLowerCase().trim();
            if (email) {
              _context.next = 1;
              break;
            }
            return _context.abrupt("return", done(new Error('SAML assertion did not include an email claim')));
          case 1:
            displayName = profile.displayName || profile['http://schemas.microsoft.com/identity/claims/displayname'] || null; // Upsert: create on first login, update display_name thereafter
            _context.next = 2;
            return (0, _knex["default"])('users').where({
              email: email,
              is_active: true
            }).first();
          case 2:
            user = _context.sent;
            if (user) {
              _context.next = 4;
              break;
            }
            _context.next = 3;
            return (0, _knex["default"])('users').insert({
              email: email,
              display_name: displayName,
              // SSO users have no password_hash — they authenticate via IdP
              password_hash: null,
              role: 'viewer'
            }).returning(['id', 'email', 'role', 'org_id']);
          case 3:
            _yield$db$insert$retu = _context.sent;
            _yield$db$insert$retu2 = (0, _slicedToArray2["default"])(_yield$db$insert$retu, 1);
            user = _yield$db$insert$retu2[0];
            logger.info("SSO: new user provisioned: ".concat(email));
            _context.next = 5;
            break;
          case 4:
            if (!(displayName && user.display_name !== displayName)) {
              _context.next = 5;
              break;
            }
            _context.next = 5;
            return (0, _knex["default"])('users').where({
              id: user.id
            }).update({
              display_name: displayName,
              updated_at: _knex["default"].fn.now()
            });
          case 5:
            (0, _knex["default"])('users').where({
              id: user.id
            }).update({
              last_login_at: _knex["default"].fn.now()
            })["catch"](function (err) {
              return logger.error('Failed to update last_login_at', err);
            });
            return _context.abrupt("return", done(null, {
              id: user.id,
              email: user.email,
              role: user.role
            }));
          case 6:
            _context.prev = 6;
            _t = _context["catch"](0);
            logger.error('SAML strategy error', _t);
            return _context.abrupt("return", done(_t));
          case 7:
          case "end":
            return _context.stop();
        }
      }, _callee, null, [[0, 6]]);
    }));
    return function (_x, _x2) {
      return _ref.apply(this, arguments);
    };
  }());
  _passport["default"].use('saml', _strategy);
  return _strategy;
}

// ── Route handlers ─────────────────────────────────────────────────────────

/**
 * GET /api/auth/sso/saml
 * Redirects the browser to the IdP login page.
 */
function samlLogin(req, res, next) {
  if (!(0, _samlConfig.isSamlEnabled)()) {
    return res.status(503).json({
      error: 'SAML SSO is not configured on this instance'
    });
  }
  getStrategy(); // ensure strategy is registered
  _passport["default"].authenticate('saml', {
    session: false
  })(req, res, next);
}

/**
 * POST /api/auth/sso/saml/callback
 * Handles the IdP assertion. Issues a JWT pair on success.
 */
function samlCallback(req, res, next) {
  if (!(0, _samlConfig.isSamlEnabled)()) {
    return res.status(503).json({
      error: 'SAML SSO is not configured on this instance'
    });
  }
  getStrategy();
  _passport["default"].authenticate('saml', {
    session: false
  }, /*#__PURE__*/function () {
    var _ref3 = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee2(err, user) {
      var _process$env$SSO_REDI, _yield$jwtHelper$crea, accessToken, refreshToken, redirectUrl, _t2;
      return _regenerator["default"].wrap(function (_context2) {
        while (1) switch (_context2.prev = _context2.next) {
          case 0:
            if (!err) {
              _context2.next = 1;
              break;
            }
            logger.error('SAML callback error', err);
            return _context2.abrupt("return", res.status(401).json({
              error: 'SSO authentication failed'
            }));
          case 1:
            if (user) {
              _context2.next = 2;
              break;
            }
            return _context2.abrupt("return", res.status(401).json({
              error: 'SSO authentication failed: no user returned'
            }));
          case 2:
            _context2.prev = 2;
            _context2.next = 3;
            return _jwtHelper["default"].createAsync('saml', {
              type: 'saml'
            }, {
              id: user.id,
              email: user.email,
              role: user.role
            });
          case 3:
            _yield$jwtHelper$crea = _context2.sent;
            accessToken = _yield$jwtHelper$crea.accessToken;
            refreshToken = _yield$jwtHelper$crea.refreshToken;
            logger.info("SSO login successful: ".concat(user.email, " (role=").concat(user.role, ")"));

            // Redirect to the SPA with tokens as query params.
            // The frontend reads them once from the URL and stores them in memory/store,
            // then replaces the URL with history.replaceState to remove the tokens.
            redirectUrl = new URL((_process$env$SSO_REDI = process.env.SSO_REDIRECT_URL) !== null && _process$env$SSO_REDI !== void 0 ? _process$env$SSO_REDI : '/');
            redirectUrl.searchParams.set('accessToken', accessToken);
            redirectUrl.searchParams.set('refreshToken', refreshToken);
            return _context2.abrupt("return", res.redirect(redirectUrl.toString()));
          case 4:
            _context2.prev = 4;
            _t2 = _context2["catch"](2);
            logger.error('JWT creation failed after SAML callback', _t2);
            return _context2.abrupt("return", res.status(500).json({
              error: 'Internal server error'
            }));
          case 5:
          case "end":
            return _context2.stop();
        }
      }, _callee2, null, [[2, 4]]);
    }));
    return function (_x3, _x4) {
      return _ref3.apply(this, arguments);
    };
  }())(req, res, next);
}

/**
 * GET /api/auth/sso/saml/metadata
 * Returns SP metadata XML. IdP admins use this to register CarbonThreat.
 */
function samlMetadata(req, res) {
  if (!(0, _samlConfig.isSamlEnabled)()) {
    return res.status(503).json({
      error: 'SAML SSO is not configured on this instance'
    });
  }
  try {
    var strategy = getStrategy();
    var metadata = strategy.generateServiceProviderMetadata(null, null);
    res.type('application/xml');
    return res.send(metadata);
  } catch (err) {
    logger.error('Failed to generate SAML metadata', err);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}