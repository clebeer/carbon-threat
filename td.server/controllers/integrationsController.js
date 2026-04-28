"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.deleteConfig = deleteConfig;
exports.exportIssue = exportIssue;
exports.getConfig = getConfig;
exports.listConfigs = listConfigs;
exports.upsertConfig = upsertConfig;
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _knex = _interopRequireDefault(require("../db/knex.js"));
var _encryption = require("../security/encryption.js");
var _thirdParty = require("../integrations/third-party.js");
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
var _excluded = ["is_enabled"];
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { (0, _defineProperty2["default"])(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
var logger = _loggerHelper["default"].get('controllers/integrationsController.js');
var VALID_PLATFORMS = ['github', 'jira', 'servicenow', 'openai', 'ollama'];

// ── Helpers ────────────────────────────────────────────────────────────────

function encryptConfig(configObj) {
  // encryptModel accepts any JSON-serialisable object
  var payload = (0, _encryption.encryptModel)(configObj);
  return JSON.stringify(payload);
}
function decryptConfig(storedStr) {
  var payload = JSON.parse(storedStr);
  return (0, _encryption.decryptModel)(payload);
}

/**
 * Returns a safe (secrets redacted) view of the config for API responses.
 * Replaces credential values with '***' so the frontend can confirm
 * a config exists without exposing the actual tokens.
 */
function redactSecrets(configObj) {
  var SECRET_KEYS = ['token', 'password', 'apiKey', 'api_key', 'clientSecret', 'client_secret'];
  var out = _objectSpread({}, configObj);
  for (var _i = 0, _SECRET_KEYS = SECRET_KEYS; _i < _SECRET_KEYS.length; _i++) {
    var key = _SECRET_KEYS[_i];
    if (out[key]) out[key] = '***';
  }
  return out;
}

// ── Controllers ────────────────────────────────────────────────────────────

/**
 * GET /api/integrations
 * Returns all configured integrations for the user's org (secrets redacted).
 */
function listConfigs(_x, _x2) {
  return _listConfigs.apply(this, arguments);
}
/**
 * GET /api/integrations/:platform
 * Returns the config for a single platform (secrets redacted).
 */
function _listConfigs() {
  _listConfigs = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(req, res) {
    var _req$user$org_id, rows, configs, _t;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 1;
          return (0, _knex["default"])('integration_configs').where({
            org_id: (_req$user$org_id = req.user.org_id) !== null && _req$user$org_id !== void 0 ? _req$user$org_id : null
          }).select('id', 'platform', 'is_enabled', 'updated_at');
        case 1:
          rows = _context.sent;
          // Decrypt each row so the frontend knows which fields are set
          configs = rows.map(function (row) {
            try {
              var _row$config_encrypted;
              var plain = decryptConfig((_row$config_encrypted = row.config_encrypted) !== null && _row$config_encrypted !== void 0 ? _row$config_encrypted : '{}');
              return _objectSpread(_objectSpread({}, row), {}, {
                config: redactSecrets(plain)
              });
            } catch (_unused) {
              return _objectSpread(_objectSpread({}, row), {}, {
                config: {}
              });
            }
          });
          return _context.abrupt("return", res.json({
            configs: configs
          }));
        case 2:
          _context.prev = 2;
          _t = _context["catch"](0);
          logger.error('listConfigs failed', _t);
          return _context.abrupt("return", res.status(500).json({
            error: 'Internal server error'
          }));
        case 3:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[0, 2]]);
  }));
  return _listConfigs.apply(this, arguments);
}
function getConfig(_x3, _x4) {
  return _getConfig.apply(this, arguments);
}
/**
 * PUT /api/integrations/:platform
 * Creates or updates the encrypted config for a platform. Admin only.
 * Body: the platform-specific credentials object (see integration docs).
 */
function _getConfig() {
  _getConfig = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee2(req, res) {
    var platform, _req$user$org_id2, row, plain, _t2;
    return _regenerator["default"].wrap(function (_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          platform = req.params.platform;
          if (VALID_PLATFORMS.includes(platform)) {
            _context2.next = 1;
            break;
          }
          return _context2.abrupt("return", res.status(400).json({
            error: "Unknown platform: ".concat(platform)
          }));
        case 1:
          _context2.prev = 1;
          _context2.next = 2;
          return (0, _knex["default"])('integration_configs').where({
            platform: platform,
            org_id: (_req$user$org_id2 = req.user.org_id) !== null && _req$user$org_id2 !== void 0 ? _req$user$org_id2 : null
          }).first();
        case 2:
          row = _context2.sent;
          if (row) {
            _context2.next = 3;
            break;
          }
          return _context2.abrupt("return", res.status(404).json({
            error: 'Integration not configured'
          }));
        case 3:
          plain = decryptConfig(row.config_encrypted);
          return _context2.abrupt("return", res.json({
            platform: platform,
            is_enabled: row.is_enabled,
            config: redactSecrets(plain)
          }));
        case 4:
          _context2.prev = 4;
          _t2 = _context2["catch"](1);
          logger.error('getConfig failed', _t2);
          return _context2.abrupt("return", res.status(500).json({
            error: 'Internal server error'
          }));
        case 5:
        case "end":
          return _context2.stop();
      }
    }, _callee2, null, [[1, 4]]);
  }));
  return _getConfig.apply(this, arguments);
}
function upsertConfig(_x5, _x6) {
  return _upsertConfig.apply(this, arguments);
}
/**
 * DELETE /api/integrations/:platform
 * Removes the integration config entirely. Admin only.
 */
function _upsertConfig() {
  _upsertConfig = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee3(req, res) {
    var platform, _ref, _ref$is_enabled, is_enabled, configFields, _req$user$org_id3, config_encrypted, now, existing, _req$user$org_id4, _t3;
    return _regenerator["default"].wrap(function (_context3) {
      while (1) switch (_context3.prev = _context3.next) {
        case 0:
          platform = req.params.platform;
          _ref = req.body || {}, _ref$is_enabled = _ref.is_enabled, is_enabled = _ref$is_enabled === void 0 ? true : _ref$is_enabled, configFields = (0, _objectWithoutProperties2["default"])(_ref, _excluded);
          if (VALID_PLATFORMS.includes(platform)) {
            _context3.next = 1;
            break;
          }
          return _context3.abrupt("return", res.status(400).json({
            error: "Unknown platform: ".concat(platform)
          }));
        case 1:
          if (!(Object.keys(configFields).length === 0)) {
            _context3.next = 2;
            break;
          }
          return _context3.abrupt("return", res.status(400).json({
            error: 'Config body cannot be empty'
          }));
        case 2:
          _context3.prev = 2;
          config_encrypted = encryptConfig(configFields);
          now = _knex["default"].fn.now();
          _context3.next = 3;
          return (0, _knex["default"])('integration_configs').where({
            platform: platform,
            org_id: (_req$user$org_id3 = req.user.org_id) !== null && _req$user$org_id3 !== void 0 ? _req$user$org_id3 : null
          }).first();
        case 3:
          existing = _context3.sent;
          if (!existing) {
            _context3.next = 5;
            break;
          }
          _context3.next = 4;
          return (0, _knex["default"])('integration_configs').where({
            id: existing.id
          }).update({
            config_encrypted: config_encrypted,
            is_enabled: is_enabled,
            updated_at: now
          });
        case 4:
          _context3.next = 6;
          break;
        case 5:
          _context3.next = 6;
          return (0, _knex["default"])('integration_configs').insert({
            platform: platform,
            org_id: (_req$user$org_id4 = req.user.org_id) !== null && _req$user$org_id4 !== void 0 ? _req$user$org_id4 : null,
            config_encrypted: config_encrypted,
            is_enabled: is_enabled
          });
        case 6:
          logger.info("Integration config saved: platform=".concat(platform, " by user=").concat(req.user.id));
          return _context3.abrupt("return", res.json({
            message: "Integration \"".concat(platform, "\" saved successfully"),
            is_enabled: is_enabled
          }));
        case 7:
          _context3.prev = 7;
          _t3 = _context3["catch"](2);
          logger.error('upsertConfig failed', _t3);
          return _context3.abrupt("return", res.status(500).json({
            error: 'Internal server error'
          }));
        case 8:
        case "end":
          return _context3.stop();
      }
    }, _callee3, null, [[2, 7]]);
  }));
  return _upsertConfig.apply(this, arguments);
}
function deleteConfig(_x7, _x8) {
  return _deleteConfig.apply(this, arguments);
}
/**
 * POST /api/integrations/:platform/export
 * Exports a threat (issue) to the target platform.
 * Body: { title: string, description: string }
 * Requires integration to be enabled and configured.
 */
function _deleteConfig() {
  _deleteConfig = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee4(req, res) {
    var platform, _req$user$org_id5, deleted, _t4;
    return _regenerator["default"].wrap(function (_context4) {
      while (1) switch (_context4.prev = _context4.next) {
        case 0:
          platform = req.params.platform;
          _context4.prev = 1;
          _context4.next = 2;
          return (0, _knex["default"])('integration_configs').where({
            platform: platform,
            org_id: (_req$user$org_id5 = req.user.org_id) !== null && _req$user$org_id5 !== void 0 ? _req$user$org_id5 : null
          })["delete"]();
        case 2:
          deleted = _context4.sent;
          if (deleted) {
            _context4.next = 3;
            break;
          }
          return _context4.abrupt("return", res.status(404).json({
            error: 'Integration not found'
          }));
        case 3:
          logger.info("Integration config deleted: platform=".concat(platform, " by user=").concat(req.user.id));
          return _context4.abrupt("return", res.json({
            message: "Integration \"".concat(platform, "\" removed")
          }));
        case 4:
          _context4.prev = 4;
          _t4 = _context4["catch"](1);
          logger.error('deleteConfig failed', _t4);
          return _context4.abrupt("return", res.status(500).json({
            error: 'Internal server error'
          }));
        case 5:
        case "end":
          return _context4.stop();
      }
    }, _callee4, null, [[1, 4]]);
  }));
  return _deleteConfig.apply(this, arguments);
}
function exportIssue(_x9, _x0) {
  return _exportIssue.apply(this, arguments);
}
function _exportIssue() {
  _exportIssue = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee5(req, res) {
    var platform, _ref2, title, description, _req$user$org_id6, row, config, result, _result$error, _t5;
    return _regenerator["default"].wrap(function (_context5) {
      while (1) switch (_context5.prev = _context5.next) {
        case 0:
          platform = req.params.platform;
          _ref2 = req.body || {}, title = _ref2.title, description = _ref2.description;
          if (VALID_PLATFORMS.includes(platform)) {
            _context5.next = 1;
            break;
          }
          return _context5.abrupt("return", res.status(400).json({
            error: "Unknown platform: ".concat(platform)
          }));
        case 1:
          if (title) {
            _context5.next = 2;
            break;
          }
          return _context5.abrupt("return", res.status(400).json({
            error: 'title is required'
          }));
        case 2:
          if (description) {
            _context5.next = 3;
            break;
          }
          return _context5.abrupt("return", res.status(400).json({
            error: 'description is required'
          }));
        case 3:
          _context5.prev = 3;
          _context5.next = 4;
          return (0, _knex["default"])('integration_configs').where({
            platform: platform,
            org_id: (_req$user$org_id6 = req.user.org_id) !== null && _req$user$org_id6 !== void 0 ? _req$user$org_id6 : null,
            is_enabled: true
          }).first();
        case 4:
          row = _context5.sent;
          if (row) {
            _context5.next = 5;
            break;
          }
          return _context5.abrupt("return", res.status(409).json({
            error: "Integration \"".concat(platform, "\" is not enabled or configured")
          }));
        case 5:
          config = decryptConfig(row.config_encrypted);
          _context5.next = 6;
          return (0, _thirdParty.createThirdPartyIssue)(platform, {
            title: title,
            description: description
          }, config);
        case 6:
          result = _context5.sent;
          if (result.success) {
            _context5.next = 7;
            break;
          }
          logger.warn("Export to ".concat(platform, " failed: ").concat(result.error));
          return _context5.abrupt("return", res.status(502).json({
            error: (_result$error = result.error) !== null && _result$error !== void 0 ? _result$error : 'Export failed'
          }));
        case 7:
          logger.info("Issue exported to ".concat(platform, " by user=").concat(req.user.id, ": \"").concat(title, "\""));
          return _context5.abrupt("return", res.json({
            message: "Issue created on ".concat(platform)
          }));
        case 8:
          _context5.prev = 8;
          _t5 = _context5["catch"](3);
          logger.error('exportIssue failed', _t5);
          return _context5.abrupt("return", res.status(500).json({
            error: 'Internal server error'
          }));
        case 9:
        case "end":
          return _context5.stop();
      }
    }, _callee5, null, [[3, 8]]);
  }));
  return _exportIssue.apply(this, arguments);
}