"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getConfig = exports["default"] = void 0;
var _Env = _interopRequireDefault(require("../env/Env"));
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
var _responseWrapper = _interopRequireDefault(require("./responseWrapper"));
var logger = _loggerHelper["default"].get('controllers/configcontroller.js');
var config = function config(req, res) {
  return _responseWrapper["default"].sendResponse(function () {
    return getConfig();
  }, req, res, logger);
};
var getConfig = exports.getConfig = function getConfig() {
  return {
    bitbucketEnabled: _Env["default"].get().config.BITBUCKET_CLIENT_ID !== undefined && _Env["default"].get().config.BITBUCKET_CLIENT_ID !== null,
    githubEnabled: _Env["default"].get().config.GITHUB_CLIENT_ID !== undefined && _Env["default"].get().config.GITHUB_CLIENT_ID !== null,
    gitlabEnabled: _Env["default"].get().config.GITLAB_CLIENT_ID !== undefined && _Env["default"].get().config.GITLAB_CLIENT_ID !== null,
    googleEnabled: _Env["default"].get().config.GOOGLE_CLIENT_ID !== undefined && _Env["default"].get().config.GOOGLE_CLIENT_ID !== null,
    localEnabled: true
  };
};
var _default = exports["default"] = {
  config: config
};