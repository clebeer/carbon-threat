"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.analyzeModel = analyzeModel;
exports.createThreat = createThreat;
exports.deleteThreat = deleteThreat;
exports.exportSarif = exportSarif;
exports.listThreats = listThreats;
exports.updateThreat = updateThreat;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _knex = _interopRequireDefault(require("../db/knex.js"));
var _encryption = require("../security/encryption.js");
var _ruleEngine = require("../engine/rule-engine.js");
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
var logger = _loggerHelper["default"].get('controllers/threats.pg.js');
function scopedModelQuery(req) {
  var _req$user, _ref, _req$user$orgId, _req$user2, _req$provider;
  var userId = (_req$user = req.user) === null || _req$user === void 0 ? void 0 : _req$user.id;
  var orgId = (_ref = (_req$user$orgId = (_req$user2 = req.user) === null || _req$user2 === void 0 ? void 0 : _req$user2.orgId) !== null && _req$user$orgId !== void 0 ? _req$user$orgId : (_req$provider = req.provider) === null || _req$provider === void 0 ? void 0 : _req$provider.orgId) !== null && _ref !== void 0 ? _ref : null;
  var q = (0, _knex["default"])('threat_models').where({
    is_archived: false
  });
  if (orgId) {
    return q.where({
      org_id: orgId
    });
  }
  return q.where({
    owner_id: userId
  });
}
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function listThreats(_x, _x2) {
  return _listThreats.apply(this, arguments);
}
function _listThreats() {
  _listThreats = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(req, res) {
    var _req$query, modelId, status, strideCategory, q, model, models, modelIds, threats, _t;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _req$query = req.query, modelId = _req$query.modelId, status = _req$query.status, strideCategory = _req$query.strideCategory;
          if (!(modelId && !UUID_RE.test(modelId))) {
            _context.next = 1;
            break;
          }
          return _context.abrupt("return", res.status(400).json({
            error: 'modelId must be a valid UUID'
          }));
        case 1:
          _context.prev = 1;
          q = (0, _knex["default"])('threats');
          if (!modelId) {
            _context.next = 4;
            break;
          }
          _context.next = 2;
          return scopedModelQuery(req).where({
            id: modelId
          }).first();
        case 2:
          model = _context.sent;
          if (model) {
            _context.next = 3;
            break;
          }
          return _context.abrupt("return", res.status(404).json({
            error: 'Threat model not found'
          }));
        case 3:
          q = q.where({
            model_id: modelId
          });
          _context.next = 7;
          break;
        case 4:
          _context.next = 5;
          return scopedModelQuery(req).select('id');
        case 5:
          models = _context.sent;
          modelIds = models.map(function (m) {
            return m.id;
          });
          if (!(modelIds.length === 0)) {
            _context.next = 6;
            break;
          }
          return _context.abrupt("return", res.json({
            threats: []
          }));
        case 6:
          q = q.whereIn('model_id', modelIds);
        case 7:
          if (status) q = q.where({
            status: status
          });
          if (strideCategory) q = q.where({
            stride_category: strideCategory
          });
          _context.next = 8;
          return q.orderBy('created_at', 'desc');
        case 8:
          threats = _context.sent;
          return _context.abrupt("return", res.json({
            threats: threats
          }));
        case 9:
          _context.prev = 9;
          _t = _context["catch"](1);
          logger.error('listThreats failed', _t);
          return _context.abrupt("return", res.status(500).json({
            error: 'Failed to list threats'
          }));
        case 10:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[1, 9]]);
  }));
  return _listThreats.apply(this, arguments);
}
function createThreat(_x3, _x4) {
  return _createThreat.apply(this, arguments);
}
function _createThreat() {
  _createThreat = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee2(req, res) {
    var _ref2, model_id, title, description, stride_category, severity, status, source, node_ids, edge_ids, mitigation, rule_id, owasp_refs, model, _yield$db$insert$retu, _yield$db$insert$retu2, threat, _t2;
    return _regenerator["default"].wrap(function (_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          _ref2 = req.body || {}, model_id = _ref2.model_id, title = _ref2.title, description = _ref2.description, stride_category = _ref2.stride_category, severity = _ref2.severity, status = _ref2.status, source = _ref2.source, node_ids = _ref2.node_ids, edge_ids = _ref2.edge_ids, mitigation = _ref2.mitigation, rule_id = _ref2.rule_id, owasp_refs = _ref2.owasp_refs;
          if (model_id) {
            _context2.next = 1;
            break;
          }
          return _context2.abrupt("return", res.status(400).json({
            error: 'model_id is required'
          }));
        case 1:
          if (!(!title || !title.trim())) {
            _context2.next = 2;
            break;
          }
          return _context2.abrupt("return", res.status(400).json({
            error: 'title is required'
          }));
        case 2:
          _context2.prev = 2;
          _context2.next = 3;
          return scopedModelQuery(req).where({
            id: model_id
          }).first();
        case 3:
          model = _context2.sent;
          if (model) {
            _context2.next = 4;
            break;
          }
          return _context2.abrupt("return", res.status(404).json({
            error: 'Threat model not found'
          }));
        case 4:
          _context2.next = 5;
          return (0, _knex["default"])('threats').insert({
            model_id: model_id,
            title: title.trim(),
            description: description || null,
            stride_category: stride_category || 'Tampering',
            severity: severity || 'Medium',
            status: status || 'Open',
            source: source || 'manual',
            node_ids: node_ids || [],
            edge_ids: edge_ids || [],
            mitigation: mitigation || null,
            rule_id: rule_id || null,
            owasp_refs: JSON.stringify(owasp_refs || []),
            org_id: model.org_id || null
          }).returning('*');
        case 5:
          _yield$db$insert$retu = _context2.sent;
          _yield$db$insert$retu2 = (0, _slicedToArray2["default"])(_yield$db$insert$retu, 1);
          threat = _yield$db$insert$retu2[0];
          logger.info("Threat created: ".concat(threat.id, " for model ").concat(model_id));
          return _context2.abrupt("return", res.status(201).json({
            threat: threat
          }));
        case 6:
          _context2.prev = 6;
          _t2 = _context2["catch"](2);
          logger.error('createThreat failed', _t2);
          return _context2.abrupt("return", res.status(500).json({
            error: 'Failed to create threat'
          }));
        case 7:
        case "end":
          return _context2.stop();
      }
    }, _callee2, null, [[2, 6]]);
  }));
  return _createThreat.apply(this, arguments);
}
function updateThreat(_x5, _x6) {
  return _updateThreat.apply(this, arguments);
}
function _updateThreat() {
  _updateThreat = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee3(req, res) {
    var id, _ref3, title, description, stride_category, severity, status, mitigation, owasp_refs, node_ids, edge_ids, existing, model, patch, _yield$db$where$updat, _yield$db$where$updat2, threat, _t3;
    return _regenerator["default"].wrap(function (_context3) {
      while (1) switch (_context3.prev = _context3.next) {
        case 0:
          id = req.params.id;
          _ref3 = req.body || {}, title = _ref3.title, description = _ref3.description, stride_category = _ref3.stride_category, severity = _ref3.severity, status = _ref3.status, mitigation = _ref3.mitigation, owasp_refs = _ref3.owasp_refs, node_ids = _ref3.node_ids, edge_ids = _ref3.edge_ids;
          _context3.prev = 1;
          _context3.next = 2;
          return (0, _knex["default"])('threats').where({
            id: id
          }).first();
        case 2:
          existing = _context3.sent;
          if (existing) {
            _context3.next = 3;
            break;
          }
          return _context3.abrupt("return", res.status(404).json({
            error: 'Threat not found'
          }));
        case 3:
          _context3.next = 4;
          return scopedModelQuery(req).where({
            id: existing.model_id
          }).first();
        case 4:
          model = _context3.sent;
          if (model) {
            _context3.next = 5;
            break;
          }
          return _context3.abrupt("return", res.status(404).json({
            error: 'Threat not found'
          }));
        case 5:
          patch = {
            updated_at: _knex["default"].fn.now()
          };
          if (title !== undefined) patch.title = title.trim();
          if (description !== undefined) patch.description = description;
          if (stride_category !== undefined) patch.stride_category = stride_category;
          if (severity !== undefined) patch.severity = severity;
          if (status !== undefined) patch.status = status;
          if (mitigation !== undefined) patch.mitigation = mitigation;
          if (owasp_refs !== undefined) patch.owasp_refs = JSON.stringify(owasp_refs);
          if (node_ids !== undefined) patch.node_ids = node_ids;
          if (edge_ids !== undefined) patch.edge_ids = edge_ids;
          _context3.next = 6;
          return (0, _knex["default"])('threats').where({
            id: id
          }).update(patch).returning('*');
        case 6:
          _yield$db$where$updat = _context3.sent;
          _yield$db$where$updat2 = (0, _slicedToArray2["default"])(_yield$db$where$updat, 1);
          threat = _yield$db$where$updat2[0];
          return _context3.abrupt("return", res.json({
            threat: threat
          }));
        case 7:
          _context3.prev = 7;
          _t3 = _context3["catch"](1);
          logger.error('updateThreat failed', _t3);
          return _context3.abrupt("return", res.status(500).json({
            error: 'Failed to update threat'
          }));
        case 8:
        case "end":
          return _context3.stop();
      }
    }, _callee3, null, [[1, 7]]);
  }));
  return _updateThreat.apply(this, arguments);
}
function deleteThreat(_x7, _x8) {
  return _deleteThreat.apply(this, arguments);
} // ── SARIF export ──────────────────────────────────────────────────────────────
function _deleteThreat() {
  _deleteThreat = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee4(req, res) {
    var id, existing, model, _t4;
    return _regenerator["default"].wrap(function (_context4) {
      while (1) switch (_context4.prev = _context4.next) {
        case 0:
          id = req.params.id;
          if (UUID_RE.test(id)) {
            _context4.next = 1;
            break;
          }
          return _context4.abrupt("return", res.status(400).json({
            error: 'Invalid threat id'
          }));
        case 1:
          _context4.prev = 1;
          _context4.next = 2;
          return (0, _knex["default"])('threats').where({
            id: id
          }).first();
        case 2:
          existing = _context4.sent;
          if (existing) {
            _context4.next = 3;
            break;
          }
          return _context4.abrupt("return", res.status(404).json({
            error: 'Threat not found'
          }));
        case 3:
          _context4.next = 4;
          return scopedModelQuery(req).where({
            id: existing.model_id
          }).first();
        case 4:
          model = _context4.sent;
          if (model) {
            _context4.next = 5;
            break;
          }
          return _context4.abrupt("return", res.status(404).json({
            error: 'Threat not found'
          }));
        case 5:
          _context4.next = 6;
          return (0, _knex["default"])('threats').where({
            id: id
          }).del();
        case 6:
          logger.info("Threat deleted: ".concat(id));
          return _context4.abrupt("return", res.json({
            message: 'Threat deleted'
          }));
        case 7:
          _context4.prev = 7;
          _t4 = _context4["catch"](1);
          logger.error('deleteThreat failed', _t4);
          return _context4.abrupt("return", res.status(500).json({
            error: 'Failed to delete threat'
          }));
        case 8:
        case "end":
          return _context4.stop();
      }
    }, _callee4, null, [[1, 7]]);
  }));
  return _deleteThreat.apply(this, arguments);
}
var SARIF_SEVERITY = {
  Critical: 'error',
  High: 'error',
  Medium: 'warning',
  Low: 'note'
};

/**
 * GET /api/threatmodels/:id/sarif
 *
 * Returns a SARIF 2.1.0 document for all threats in the given model.
 * The SARIF format is consumable by GitHub Advanced Security, GitLab SAST,
 * and most CI/CD security dashboards.
 */
function exportSarif(_x9, _x0) {
  return _exportSarif.apply(this, arguments);
}
function _exportSarif() {
  _exportSarif = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee5(req, res) {
    var modelId, model, threats, results, sarif, _t5;
    return _regenerator["default"].wrap(function (_context5) {
      while (1) switch (_context5.prev = _context5.next) {
        case 0:
          modelId = req.params.id;
          if (UUID_RE.test(modelId)) {
            _context5.next = 1;
            break;
          }
          return _context5.abrupt("return", res.status(400).json({
            error: 'Invalid model id'
          }));
        case 1:
          _context5.prev = 1;
          _context5.next = 2;
          return scopedModelQuery(req).where({
            id: modelId
          }).first();
        case 2:
          model = _context5.sent;
          if (model) {
            _context5.next = 3;
            break;
          }
          return _context5.abrupt("return", res.status(404).json({
            error: 'Threat model not found'
          }));
        case 3:
          _context5.next = 4;
          return (0, _knex["default"])('threats').where({
            model_id: modelId
          }).orderBy('created_at');
        case 4:
          threats = _context5.sent;
          results = threats.map(function (t) {
            var _t$rule_id, _SARIF_SEVERITY$t$sev;
            var owaspRefs = Array.isArray(t.owasp_refs) ? t.owasp_refs : typeof t.owasp_refs === 'string' ? JSON.parse(t.owasp_refs || '[]') : [];
            var result = {
              ruleId: (_t$rule_id = t.rule_id) !== null && _t$rule_id !== void 0 ? _t$rule_id : "CT-".concat(t.id.slice(0, 8).toUpperCase()),
              level: (_SARIF_SEVERITY$t$sev = SARIF_SEVERITY[t.severity]) !== null && _SARIF_SEVERITY$t$sev !== void 0 ? _SARIF_SEVERITY$t$sev : 'warning',
              message: {
                text: "[".concat(t.stride_category, "] ").concat(t.title)
              },
              properties: {
                severity: t.severity,
                stride: t.stride_category,
                status: t.status,
                source: t.source,
                threat_model: model.title,
                model_id: modelId
              }
            };
            if (t.description) {
              result.message.text += "\n\n".concat(t.description);
            }
            if (t.mitigation) {
              result.properties.mitigation = t.mitigation;
            }
            if (owaspRefs.length > 0) {
              result.relatedLocations = owaspRefs.map(function (r, i) {
                var _r$title, _r$url;
                return {
                  id: i,
                  message: {
                    text: "".concat(r.type, ": ").concat((_r$title = r.title) !== null && _r$title !== void 0 ? _r$title : r.ref)
                  },
                  physicalLocation: {
                    artifactLocation: {
                      uri: (_r$url = r.url) !== null && _r$url !== void 0 ? _r$url : "https://owasp.org"
                    }
                  }
                };
              });
            }
            return result;
          });
          sarif = {
            $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
            version: '2.1.0',
            runs: [{
              tool: {
                driver: {
                  name: 'CarbonThreat',
                  version: '1.0.0',
                  informationUri: 'https://github.com/OWASP/threat-dragon',
                  rules: threats.map(function (t) {
                    var _t$rule_id2, _t$description, _SARIF_SEVERITY$t$sev2;
                    return {
                      id: (_t$rule_id2 = t.rule_id) !== null && _t$rule_id2 !== void 0 ? _t$rule_id2 : "CT-".concat(t.id.slice(0, 8).toUpperCase()),
                      name: t.title,
                      shortDescription: {
                        text: t.title
                      },
                      fullDescription: {
                        text: (_t$description = t.description) !== null && _t$description !== void 0 ? _t$description : t.title
                      },
                      defaultConfiguration: {
                        level: (_SARIF_SEVERITY$t$sev2 = SARIF_SEVERITY[t.severity]) !== null && _SARIF_SEVERITY$t$sev2 !== void 0 ? _SARIF_SEVERITY$t$sev2 : 'warning'
                      },
                      properties: {
                        tags: ['security', 'threat-modeling', t.stride_category.toLowerCase().replace(/ /g, '-')]
                      }
                    };
                  })
                }
              },
              results: results,
              properties: {
                threatModel: model.title,
                modelVersion: model.version,
                exportedAt: new Date().toISOString()
              }
            }]
          };
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', "attachment; filename=\"carbonthreat-".concat(model.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40), ".sarif.json\""));
          return _context5.abrupt("return", res.json(sarif));
        case 5:
          _context5.prev = 5;
          _t5 = _context5["catch"](1);
          logger.error('exportSarif failed', _t5);
          return _context5.abrupt("return", res.status(500).json({
            error: 'Failed to generate SARIF export'
          }));
        case 6:
        case "end":
          return _context5.stop();
      }
    }, _callee5, null, [[1, 5]]);
  }));
  return _exportSarif.apply(this, arguments);
}
function analyzeModel(_x1, _x10) {
  return _analyzeModel.apply(this, arguments);
}
function _analyzeModel() {
  _analyzeModel = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee6(req, res) {
    var modelId, row, content, nodes, edges, candidates, inserted, _iterator, _step, candidate, existing, _yield$db$insert$retu3, _yield$db$insert$retu4, threat, _t6, _t7, _t8, _t9;
    return _regenerator["default"].wrap(function (_context6) {
      while (1) switch (_context6.prev = _context6.next) {
        case 0:
          modelId = req.params.id;
          if (UUID_RE.test(modelId)) {
            _context6.next = 1;
            break;
          }
          return _context6.abrupt("return", res.status(400).json({
            error: 'Invalid model id'
          }));
        case 1:
          _context6.prev = 1;
          _context6.next = 2;
          return scopedModelQuery(req).where({
            id: modelId
          }).first();
        case 2:
          row = _context6.sent;
          if (row) {
            _context6.next = 3;
            break;
          }
          return _context6.abrupt("return", res.status(404).json({
            error: 'Threat model not found'
          }));
        case 3:
          content = {};
          if (!row.content_encrypted) {
            _context6.next = 6;
            break;
          }
          _context6.prev = 4;
          content = (0, _encryption.decryptModel)(JSON.parse(row.content_encrypted));
          _context6.next = 6;
          break;
        case 5:
          _context6.prev = 5;
          _t6 = _context6["catch"](4);
          logger.error("Failed to decrypt model ".concat(modelId), _t6);
          return _context6.abrupt("return", res.status(500).json({
            error: 'Failed to decrypt model content'
          }));
        case 6:
          nodes = content.nodes || [];
          edges = content.edges || [];
          candidates = (0, _ruleEngine.generateThreats)(nodes, edges);
          inserted = [];
          _iterator = _createForOfIteratorHelper(candidates);
          _context6.prev = 7;
          _iterator.s();
        case 8:
          if ((_step = _iterator.n()).done) {
            _context6.next = 15;
            break;
          }
          candidate = _step.value;
          if (!candidate.rule_id) {
            _context6.next = 10;
            break;
          }
          _context6.next = 9;
          return (0, _knex["default"])('threats').where({
            model_id: modelId,
            rule_id: candidate.rule_id
          }).first();
        case 9:
          _t7 = _context6.sent;
          _context6.next = 11;
          break;
        case 10:
          _t7 = null;
        case 11:
          existing = _t7;
          if (!existing) {
            _context6.next = 12;
            break;
          }
          inserted.push(existing);
          return _context6.abrupt("continue", 14);
        case 12:
          _context6.next = 13;
          return (0, _knex["default"])('threats').insert({
            model_id: modelId,
            org_id: row.org_id || null,
            title: candidate.title,
            description: candidate.description,
            stride_category: candidate.stride_category,
            severity: candidate.severity,
            status: 'Open',
            source: 'rule',
            rule_id: candidate.rule_id || null,
            node_ids: candidate.node_ids || [],
            edge_ids: candidate.edge_ids || [],
            mitigation: candidate.mitigation || null,
            owasp_refs: JSON.stringify(candidate.owasp_refs || [])
          }).returning('*');
        case 13:
          _yield$db$insert$retu3 = _context6.sent;
          _yield$db$insert$retu4 = (0, _slicedToArray2["default"])(_yield$db$insert$retu3, 1);
          threat = _yield$db$insert$retu4[0];
          inserted.push(threat);
        case 14:
          _context6.next = 8;
          break;
        case 15:
          _context6.next = 17;
          break;
        case 16:
          _context6.prev = 16;
          _t8 = _context6["catch"](7);
          _iterator.e(_t8);
        case 17:
          _context6.prev = 17;
          _iterator.f();
          return _context6.finish(17);
        case 18:
          logger.info("analyzeModel: ".concat(inserted.length, " threats for model ").concat(modelId));
          return _context6.abrupt("return", res.json({
            threats: inserted,
            count: inserted.length,
            message: "Analysis complete. ".concat(inserted.length, " threat(s) generated.")
          }));
        case 19:
          _context6.prev = 19;
          _t9 = _context6["catch"](1);
          logger.error('analyzeModel failed', _t9);
          return _context6.abrupt("return", res.status(500).json({
            error: 'Failed to analyze model'
          }));
        case 20:
        case "end":
          return _context6.stop();
      }
    }, _callee6, null, [[1, 19], [4, 5], [7, 16, 17, 18]]);
  }));
  return _analyzeModel.apply(this, arguments);
}