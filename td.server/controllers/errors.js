"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.unauthorized = exports.serverError = exports.notFound = exports.forbidden = exports["default"] = exports.conflict = exports.badRequest = void 0;
/**
 * @name errors
 * @description A handful of errors / status codes that might get returned by the server
 */

/**
 * Sends an error to the client
 * @param {String} error
 * @param {Number} code
 * @param {String} message
 * @param {Object} res
 * @param {*} logger
 * @returns {Object}
 */
var sendError = function sendError(error, code, message, res, logger) {
  var returnObj = {
    status: code,
    message: message,
    details: error
  };
  logger.debug("Returning error to client: ".concat(JSON.stringify(returnObj)));
  return res.status(code).json(returnObj);
};

/**
 * Returns a 500 status / error
 * @param {String} error
 * @param {Object} res
 * @param {*} logger
 * @returns {Object}
 */
var serverError = exports.serverError = function serverError(error, res, logger) {
  return sendError(error, 500, 'Internal Server Error', res, logger);
};

/**
 * Returns a 404 status / error
 * @param {String} error
 * @param {Object} res
 * @param {*} logger
 * @returns {Object}
 */
var notFound = exports.notFound = function notFound(error, res, logger) {
  return sendError(error, 404, 'Not Found', res, logger);
};

/**
 * Returns a 400 status / error
 * @param {String} error
 * @param {Object} res
 * @param {*} logger
 * @returns {Object}
 */
var badRequest = exports.badRequest = function badRequest(error, res, logger) {
  return sendError(error, 400, 'Bad Request', res, logger);
};

/**
 * Returns a 401 status / error
 * @param {Object} res
 * @param {*} logger
 * @returns {Object}
 */
var unauthorized = exports.unauthorized = function unauthorized(res, logger) {
  return sendError('You must login to continue', 401, 'Unauthorized', res, logger);
};

/**
 * Returns a 403 status / error
 * @param {Object} res
 * @param {*} logger
 * @returns {Object}
 */
var forbidden = exports.forbidden = function forbidden(res, logger) {
  return sendError('Forbidden', 403, 'Forbidden', res, logger);
};

/**
 * Returns a 422 status / error
 * @param {String} error
 * @param {Object} res
 * @param {*} logger
 * @returns {Object}
 */
var conflict = exports.conflict = function conflict(error, res, logger) {
  return sendError(error, 422, 'Conflict', res, logger);
};
var _default = exports["default"] = {
  badRequest: badRequest,
  conflict: conflict,
  forbidden: forbidden,
  notFound: notFound,
  serverError: serverError,
  unauthorized: unauthorized
};