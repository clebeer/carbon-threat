"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
var _path = _interopRequireDefault(require("path"));
var _pathHelper = require("../helpers/path.helper.js");
var logger = _loggerHelper["default"].get('controllers/homecontroller.js');

/**
 * The path to the index.html file
 * @type {String}
 */
var indexHtmlPath = _path["default"].join(__dirname, _pathHelper.upDir, _pathHelper.upDir, _pathHelper.upDir, 'dist', 'index.html');

/**
 * Serves the index.html page for the SPA
 * @param {Object} req
 * @param {Object} res
 * @returns {Object}
 */
var index = function index(req, res) {
  logger.debug('API index request, sendFile ' + indexHtmlPath);
  res.sendFile(indexHtmlPath);
};
var _default = exports["default"] = {
  index: index
};