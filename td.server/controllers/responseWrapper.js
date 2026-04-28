"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _errors = _interopRequireDefault(require("./errors.js"));
/**
 * Wraps a function to be sent using a standardized JSON format
 * This catches errors and logs them using the logger
 * @param {Function} fn
 * @param {*} req
 * @param {*} res
 * @param {*} logger
 * @returns {*}
 */
var sendResponse = function sendResponse(fn, req, res, logger) {
  try {
    var respObj = {
      status: 200,
      data: fn()
    };
    return res.status(200).json(respObj);
  } catch (e) {
    logger.error(e);
    return _errors["default"].serverError('Internal Server Error', res, logger);
  }
};

/**
 * Wraps an async function (promise) to be sent using a standardized JSON format
 * This catches errors and logs them using the logger
 * @param {function(): Promise<{localEnabled: boolean, githubEnabled, bitbucketEnabled}>} asyncFn
 * @param {*} req
 * @param {*} res
 * @param {*} logger
 * @returns {*}
 */
var sendResponseAsync = /*#__PURE__*/function () {
  var _ref = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(asyncFn, req, res, logger) {
    var data, _t;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 1;
          return asyncFn();
        case 1:
          data = _context.sent;
          return _context.abrupt("return", res.status(200).json({
            status: 200,
            data: data
          }));
        case 2:
          _context.prev = 2;
          _t = _context["catch"](0);
          logger.error(_t);
          return _context.abrupt("return", _errors["default"].serverError('Internal Server Error', res, logger));
        case 3:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[0, 2]]);
  }));
  return function sendResponseAsync(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
}();
var _default = exports["default"] = {
  sendResponse: sendResponse,
  sendResponseAsync: sendResponseAsync
};