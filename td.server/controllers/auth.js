"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _Env = _interopRequireDefault(require("../env/Env.js"));
var _errors = _interopRequireDefault(require("./errors.js"));
var _jwtHelper = _interopRequireDefault(require("../helpers/jwt.helper.js"));
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
var _index = _interopRequireDefault(require("../providers/index.js"));
var _responseWrapper = _interopRequireDefault(require("./responseWrapper.js"));
var _token = _interopRequireDefault(require("../repositories/token.js"));
var logger = _loggerHelper["default"].get('controllers/auth.js');
var login = function login(req, res) {
  logger.debug("API login request: ".concat(logger.transformToString(req)));
  try {
    var provider = _index["default"].get(req.params.provider);
    return _responseWrapper["default"].sendResponse(function () {
      return provider.getOauthRedirectUrl();
    }, req, res, logger);
  } catch (err) {
    return _errors["default"].badRequest(err.message, res, logger);
  }
};
var oauthReturn = function oauthReturn(req, res) {
  logger.debug("API oauthReturn request: ".concat(logger.transformToString(req)));
  var returnUrl = "/#/oauth-return?code=".concat(req.query.code);
  if (_Env["default"].get().config.NODE_ENV === 'development') {
    returnUrl = "http://localhost:8080".concat(returnUrl);
  }
  return res.redirect(returnUrl);
};
var completeLogin = function completeLogin(req, res) {
  logger.debug("API completeLogin request: ".concat(logger.transformToString(req)));
  try {
    var provider = _index["default"].get(req.params.provider);

    // Errors in here will return as server errors as opposed to bad requests
    return _responseWrapper["default"].sendResponseAsync(/*#__PURE__*/(0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee() {
      var _yield$provider$compl, user, opts, _yield$jwtHelper$crea, accessToken, refreshToken;
      return _regenerator["default"].wrap(function (_context) {
        while (1) switch (_context.prev = _context.next) {
          case 0:
            _context.next = 1;
            return provider.completeLoginAsync(req.query.code);
          case 1:
            _yield$provider$compl = _context.sent;
            user = _yield$provider$compl.user;
            opts = _yield$provider$compl.opts;
            _context.next = 2;
            return _jwtHelper["default"].createAsync(provider.name, opts, user);
          case 2:
            _yield$jwtHelper$crea = _context.sent;
            accessToken = _yield$jwtHelper$crea.accessToken;
            refreshToken = _yield$jwtHelper$crea.refreshToken;
            _context.next = 3;
            return _token["default"].add(refreshToken);
          case 3:
            return _context.abrupt("return", {
              accessToken: accessToken,
              refreshToken: refreshToken
            });
          case 4:
          case "end":
            return _context.stop();
        }
      }, _callee);
    })), req, res, logger);
  } catch (err) {
    return _errors["default"].badRequest(err.message, res, logger);
  }
};
var logout = function logout(req, res) {
  return _responseWrapper["default"].sendResponseAsync(/*#__PURE__*/(0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee2() {
    var _ref3, refreshToken, _t;
    return _regenerator["default"].wrap(function (_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          logger.debug("API logout request: ".concat(logger.transformToString(req)));
          _context2.prev = 1;
          _ref3 = req.body || {}, refreshToken = _ref3.refreshToken;
          if (refreshToken) {
            _context2.next = 2;
            break;
          }
          logger.audit('Log out without a refresh token');
          // Return OK, it could be a client error or an expired token
          return _context2.abrupt("return", '');
        case 2:
          logger.debug('Remove refresh token');
          _context2.next = 3;
          return _token["default"].remove(refreshToken);
        case 3:
          return _context2.abrupt("return", '');
        case 4:
          _context2.prev = 4;
          _t = _context2["catch"](1);
          logger.error(_t);
          return _context2.abrupt("return", '');
        case 5:
        case "end":
          return _context2.stop();
      }
    }, _callee2, null, [[1, 4]]);
  })), req, res, logger);
};
var refresh = /*#__PURE__*/function () {
  var _ref4 = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee4(req, res) {
    var tokenBody;
    return _regenerator["default"].wrap(function (_context4) {
      while (1) switch (_context4.prev = _context4.next) {
        case 0:
          logger.debug("API refresh request: ".concat(logger.transformToString(req)));
          _context4.next = 1;
          return _token["default"].verify((req.body || {}).refreshToken);
        case 1:
          tokenBody = _context4.sent;
          if (tokenBody) {
            _context4.next = 2;
            break;
          }
          return _context4.abrupt("return", _errors["default"].unauthorized(res, logger));
        case 2:
          return _context4.abrupt("return", _responseWrapper["default"].sendResponseAsync(/*#__PURE__*/(0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee3() {
            var provider, user, _yield$jwtHelper$crea2, accessToken;
            return _regenerator["default"].wrap(function (_context3) {
              while (1) switch (_context3.prev = _context3.next) {
                case 0:
                  provider = tokenBody.provider, user = tokenBody.user;
                  _context3.next = 1;
                  return _jwtHelper["default"].createAsync(provider.name, provider, user);
                case 1:
                  _yield$jwtHelper$crea2 = _context3.sent;
                  accessToken = _yield$jwtHelper$crea2.accessToken;
                  return _context3.abrupt("return", {
                    accessToken: accessToken,
                    refreshToken: (req.body || {}).refreshToken
                  });
                case 2:
                case "end":
                  return _context3.stop();
              }
            }, _callee3);
          })), req, res, logger));
        case 3:
        case "end":
          return _context4.stop();
      }
    }, _callee4);
  }));
  return function refresh(_x, _x2) {
    return _ref4.apply(this, arguments);
  };
}();
var _default = exports["default"] = {
  completeLogin: completeLogin,
  login: login,
  logout: logout,
  oauthReturn: oauthReturn,
  refresh: refresh
};