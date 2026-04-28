"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.suggest = suggest;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _threatBot = require("../ai/threat-bot.js");
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
var logger = _loggerHelper["default"].get('controllers/aiController.js');

/**
 * POST /api/ai/suggest
 * Body: { nodeId: string, label: string, type?: string }
 *
 * Calls the configured LLM (Ollama/OpenAI) to suggest STRIDE threats
 * for the selected diagram node. Returns an array of threat objects.
 *
 * Rate: protected by the global limiter in app.js; additionally
 * constrained to admin/analyst roles via requireRole middleware in routes.
 */
function suggest(_x, _x2) {
  return _suggest.apply(this, arguments);
}
function _suggest() {
  _suggest = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(req, res) {
    var _req$user;
    var _ref, nodeId, label, type, safeLabel, safeType, threats, sanitised, _t;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _ref = req.body || {}, nodeId = _ref.nodeId, label = _ref.label, type = _ref.type;
          if (!(!label || typeof label !== 'string' || label.trim().length === 0)) {
            _context.next = 1;
            break;
          }
          return _context.abrupt("return", res.status(400).json({
            error: 'label is required'
          }));
        case 1:
          // Sanitise inputs — strip any chars that could be used for prompt injection
          safeLabel = label.trim().slice(0, 120).replace(/[`<>]/g, '');
          safeType = (type !== null && type !== void 0 ? type : 'Component').trim().slice(0, 80).replace(/[`<>]/g, '');
          logger.info("AI suggest requested by user ".concat((_req$user = req.user) === null || _req$user === void 0 ? void 0 : _req$user.id, " for node \"").concat(safeLabel, "\" (").concat(safeType, ")"));
          _context.prev = 2;
          _context.next = 3;
          return (0, _threatBot.suggestThreats)({
            label: safeLabel,
            type: safeType
          });
        case 3:
          threats = _context.sent;
          if (Array.isArray(threats)) {
            _context.next = 4;
            break;
          }
          logger.warn('AI response was not an array — returning empty');
          return _context.abrupt("return", res.json({
            nodeId: nodeId,
            suggestions: []
          }));
        case 4:
          // Validate / sanitise each suggestion before forwarding to the client
          sanitised = threats.filter(function (t) {
            return t && typeof t.title === 'string';
          }).map(function (t) {
            return {
              title: String(t.title).slice(0, 200),
              severity: ['High', 'Medium', 'Low'].includes(t.severity) ? t.severity : 'Medium',
              mitigation: t.mitigation ? String(t.mitigation).slice(0, 500) : '',
              strideCategory: t.strideCategory ? String(t.strideCategory).slice(0, 50) : 'Unknown'
            };
          });
          logger.info("AI returned ".concat(sanitised.length, " suggestions for \"").concat(safeLabel, "\""));
          return _context.abrupt("return", res.json({
            nodeId: nodeId,
            suggestions: sanitised
          }));
        case 5:
          _context.prev = 5;
          _t = _context["catch"](2);
          logger.error('AI suggest failed', _t);
          return _context.abrupt("return", res.status(502).json({
            error: 'AI service unavailable. Check LLM provider configuration.'
          }));
        case 6:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[2, 5]]);
  }));
  return _suggest.apply(this, arguments);
}