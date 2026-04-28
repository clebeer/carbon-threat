"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.listAssets = listAssets;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _knex = _interopRequireDefault(require("../db/knex.js"));
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
var _encryption = require("../security/encryption.js");
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; } /**
 * Asset registry controller.
 *
 * Assets are extracted from the nodes in all active threat models.
 * GET /api/assets  — returns a deduplicated list of all assets across models.
 */
var logger = _loggerHelper["default"].get('controllers/assets.js');

/**
 * Map ReactFlow node kinds to human-readable asset types.
 */
var KIND_LABEL = {
  db: 'Database',
  server: 'Server',
  fw: 'Firewall',
  user: 'External Actor',
  api: 'API / Service',
  cloud: 'Cloud Service',
  browser: 'Client / Browser',
  process: 'Process',
  store: 'Data Store'
};
var CONF_RANK = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1
};
function classifyConfidentiality() {
  var label = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var l = label.toLowerCase();
  if (l.includes('password') || l.includes('key') || l.includes('secret') || l.includes('credential') || l.includes('pii') || l.includes('payment')) {
    return 'Critical';
  }
  if (l.includes('auth') || l.includes('token') || l.includes('session') || l.includes('user') || l.includes('account')) {
    return 'High';
  }
  if (l.includes('api') || l.includes('service') || l.includes('server') || l.includes('cloud')) {
    return 'Medium';
  }
  return 'Low';
}
function listAssets(_x, _x2) {
  return _listAssets.apply(this, arguments);
}
function _listAssets() {
  _listAssets = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(req, res) {
    var _req$user$org_id, _req$user, orgId, models, assetMap, _iterator, _step, _ref, _content$nodes, _content, _content2, model, content, payload, nodes, _iterator2, _step2, _node$data, _node$attrs, _node$data2, node, label, kind, key, _KIND_LABEL$kind, _CONF_RANK$existing$c, _CONF_RANK$classifyCo, existing, existingRank, newRank, _t, _t2, _t3;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          orgId = (_req$user$org_id = (_req$user = req.user) === null || _req$user === void 0 ? void 0 : _req$user.org_id) !== null && _req$user$org_id !== void 0 ? _req$user$org_id : null;
          _context.next = 1;
          return (0, _knex["default"])('threat_models').where({
            is_archived: false
          }).modify(function (q) {
            if (orgId) q.where('org_id', orgId);
          }).select('id', 'title', 'content_encrypted');
        case 1:
          models = _context.sent;
          // Deduplicate by node label — same label across models merges into one asset
          assetMap = new Map();
          _iterator = _createForOfIteratorHelper(models);
          _context.prev = 2;
          _iterator.s();
        case 3:
          if ((_step = _iterator.n()).done) {
            _context.next = 8;
            break;
          }
          model = _step.value;
          content = void 0;
          _context.prev = 4;
          payload = JSON.parse(model.content_encrypted);
          content = (0, _encryption.decryptModel)(payload);
          _context.next = 6;
          break;
        case 5:
          _context.prev = 5;
          _t = _context["catch"](4);
          return _context.abrupt("continue", 7);
        case 6:
          nodes = (_ref = (_content$nodes = (_content = content) === null || _content === void 0 ? void 0 : _content.nodes) !== null && _content$nodes !== void 0 ? _content$nodes : (_content2 = content) === null || _content2 === void 0 || (_content2 = _content2.detail) === null || _content2 === void 0 || (_content2 = _content2.diagrams) === null || _content2 === void 0 ? void 0 : _content2.flatMap(function (d) {
            var _d$cells;
            return (_d$cells = d.cells) !== null && _d$cells !== void 0 ? _d$cells : [];
          })) !== null && _ref !== void 0 ? _ref : [];
          _iterator2 = _createForOfIteratorHelper(nodes);
          try {
            for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
              node = _step2.value;
              label = (node === null || node === void 0 || (_node$data = node.data) === null || _node$data === void 0 ? void 0 : _node$data.label) || (node === null || node === void 0 || (_node$attrs = node.attrs) === null || _node$attrs === void 0 || (_node$attrs = _node$attrs.label) === null || _node$attrs === void 0 ? void 0 : _node$attrs.text) || (node === null || node === void 0 ? void 0 : node.label) || 'Unnamed';
              kind = (node === null || node === void 0 || (_node$data2 = node.data) === null || _node$data2 === void 0 ? void 0 : _node$data2.kind) || (node === null || node === void 0 ? void 0 : node.type) || 'unknown';
              key = "".concat(label, "::").concat(kind);
              if (!assetMap.has(key)) {
                assetMap.set(key, {
                  id: "ast-".concat(Buffer.from(key).toString('base64').slice(0, 8)),
                  name: label,
                  type: (_KIND_LABEL$kind = KIND_LABEL[kind]) !== null && _KIND_LABEL$kind !== void 0 ? _KIND_LABEL$kind : 'Component',
                  confidentiality: classifyConfidentiality(label),
                  source: model.title || 'Unknown model'
                });
              } else {
                // If seen in multiple models, escalate confidentiality rank to highest
                existing = assetMap.get(key);
                existingRank = (_CONF_RANK$existing$c = CONF_RANK[existing.confidentiality]) !== null && _CONF_RANK$existing$c !== void 0 ? _CONF_RANK$existing$c : 0;
                newRank = (_CONF_RANK$classifyCo = CONF_RANK[classifyConfidentiality(label)]) !== null && _CONF_RANK$classifyCo !== void 0 ? _CONF_RANK$classifyCo : 0;
                if (newRank > existingRank) {
                  existing.confidentiality = classifyConfidentiality(label);
                }
              }
            }
          } catch (err) {
            _iterator2.e(err);
          } finally {
            _iterator2.f();
          }
        case 7:
          _context.next = 3;
          break;
        case 8:
          _context.next = 10;
          break;
        case 9:
          _context.prev = 9;
          _t2 = _context["catch"](2);
          _iterator.e(_t2);
        case 10:
          _context.prev = 10;
          _iterator.f();
          return _context.finish(10);
        case 11:
          return _context.abrupt("return", res.json({
            assets: Array.from(assetMap.values())
          }));
        case 12:
          _context.prev = 12;
          _t3 = _context["catch"](0);
          logger.error('listAssets failed', _t3);
          return _context.abrupt("return", res.status(500).json({
            error: 'Failed to load assets'
          }));
        case 13:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[0, 12], [2, 9, 10, 11], [4, 5]]);
  }));
  return _listAssets.apply(this, arguments);
}