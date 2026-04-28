"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.archiveThreatModel = archiveThreatModel;
exports.createThreatModel = createThreatModel;
exports.getThreatModel = getThreatModel;
exports.importThreatModel = importThreatModel;
exports.listThreatModels = listThreatModels;
exports.updateThreatModel = updateThreatModel;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _knex = _interopRequireDefault(require("../db/knex.js"));
var _encryption = require("../security/encryption.js");
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
/**
 * PostgreSQL-backed threat model controller.
 *
 * Provides CRUD for threat models stored in the `threat_models` table
 * (migration 002). Model content is encrypted at rest via AES-256-GCM
 * (security/encryption.js).
 *
 * Routes (all require Bearer auth):
 *   GET    /api/threatmodels                   → list (org-scoped)
 *   POST   /api/threatmodels                   → create
 *   GET    /api/threatmodels/:id               → get one
 *   PUT    /api/threatmodels/:id               → update
 *   DELETE /api/threatmodels/:id               → archive (soft delete)
 */

var logger = _loggerHelper["default"].get('controllers/threatmodels.pg.js');

// ── helpers ──────────────────────────────────────────────────────────────────

function notFound(res) {
  return res.status(404).json({
    error: 'Threat model not found'
  });
}

/**
 * Returns a base query scoped to the authenticated user's org (if set)
 * or to models owned by that user when no org is present.
 */
function scopedQuery(req) {
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

// ── list ─────────────────────────────────────────────────────────────────────
function listThreatModels(_x, _x2) {
  return _listThreatModels.apply(this, arguments);
} // ── get one ───────────────────────────────────────────────────────────────────
function _listThreatModels() {
  _listThreatModels = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(req, res) {
    var models, _t;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 1;
          return scopedQuery(req).select('id', 'title', 'description', 'version', 'is_archived', 'created_at', 'updated_at', 'owner_id', 'org_id').orderBy('updated_at', 'desc');
        case 1:
          models = _context.sent;
          return _context.abrupt("return", res.json({
            models: models
          }));
        case 2:
          _context.prev = 2;
          _t = _context["catch"](0);
          logger.error('listThreatModels failed', _t);
          return _context.abrupt("return", res.status(500).json({
            error: 'Failed to list threat models'
          }));
        case 3:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[0, 2]]);
  }));
  return _listThreatModels.apply(this, arguments);
}
function getThreatModel(_x3, _x4) {
  return _getThreatModel.apply(this, arguments);
} // ── create ────────────────────────────────────────────────────────────────────
function _getThreatModel() {
  _getThreatModel = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee2(req, res) {
    var row, content, _t2, _t3;
    return _regenerator["default"].wrap(function (_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          _context2.next = 1;
          return scopedQuery(req).where({
            id: req.params.id
          }).first();
        case 1:
          row = _context2.sent;
          if (row) {
            _context2.next = 2;
            break;
          }
          return _context2.abrupt("return", notFound(res));
        case 2:
          content = {};
          if (!row.content_encrypted) {
            _context2.next = 5;
            break;
          }
          _context2.prev = 3;
          content = (0, _encryption.decryptModel)(JSON.parse(row.content_encrypted));
          _context2.next = 5;
          break;
        case 4:
          _context2.prev = 4;
          _t2 = _context2["catch"](3);
          logger.error("Failed to decrypt model ".concat(req.params.id), _t2);
          return _context2.abrupt("return", res.status(500).json({
            error: 'Failed to decrypt model content'
          }));
        case 5:
          return _context2.abrupt("return", res.json({
            summary: {
              id: row.id,
              title: row.title,
              description: row.description,
              version: row.version,
              is_archived: row.is_archived,
              created_at: row.created_at,
              updated_at: row.updated_at,
              owner_id: row.owner_id,
              org_id: row.org_id
            },
            content: content
          }));
        case 6:
          _context2.prev = 6;
          _t3 = _context2["catch"](0);
          logger.error('getThreatModel failed', _t3);
          return _context2.abrupt("return", res.status(500).json({
            error: 'Failed to retrieve threat model'
          }));
        case 7:
        case "end":
          return _context2.stop();
      }
    }, _callee2, null, [[0, 6], [3, 4]]);
  }));
  return _getThreatModel.apply(this, arguments);
}
function createThreatModel(_x5, _x6) {
  return _createThreatModel.apply(this, arguments);
} // ── update ────────────────────────────────────────────────────────────────────
function _createThreatModel() {
  _createThreatModel = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee3(req, res) {
    var _req$user3, _ref5, _req$user$orgId2, _req$user4, _req$provider2;
    var _ref4, title, description, _ref4$content, content, userId, orgId, encrypted, _yield$db$insert$retu, _yield$db$insert$retu2, model, _t4;
    return _regenerator["default"].wrap(function (_context3) {
      while (1) switch (_context3.prev = _context3.next) {
        case 0:
          _ref4 = req.body || {}, title = _ref4.title, description = _ref4.description, _ref4$content = _ref4.content, content = _ref4$content === void 0 ? {} : _ref4$content;
          if (!(!title || !title.trim())) {
            _context3.next = 1;
            break;
          }
          return _context3.abrupt("return", res.status(400).json({
            error: 'title is required'
          }));
        case 1:
          userId = (_req$user3 = req.user) === null || _req$user3 === void 0 ? void 0 : _req$user3.id; // orgId may live in req.provider (set by bearer.config) or req.user — default to null
          orgId = (_ref5 = (_req$user$orgId2 = (_req$user4 = req.user) === null || _req$user4 === void 0 ? void 0 : _req$user4.orgId) !== null && _req$user$orgId2 !== void 0 ? _req$user$orgId2 : (_req$provider2 = req.provider) === null || _req$provider2 === void 0 ? void 0 : _req$provider2.orgId) !== null && _ref5 !== void 0 ? _ref5 : null;
          _context3.prev = 2;
          encrypted = (0, _encryption.encryptModel)(content);
          _context3.next = 3;
          return (0, _knex["default"])('threat_models').insert({
            title: title.trim(),
            description: description || null,
            content_encrypted: JSON.stringify(encrypted),
            owner_id: userId,
            org_id: orgId !== undefined ? orgId : null,
            version: 1
          }).returning(['id', 'title', 'description', 'version', 'is_archived', 'created_at', 'updated_at', 'owner_id', 'org_id']);
        case 3:
          _yield$db$insert$retu = _context3.sent;
          _yield$db$insert$retu2 = (0, _slicedToArray2["default"])(_yield$db$insert$retu, 1);
          model = _yield$db$insert$retu2[0];
          logger.info("Threat model created: ".concat(model.id, " by user ").concat(userId));
          return _context3.abrupt("return", res.status(201).json({
            model: model
          }));
        case 4:
          _context3.prev = 4;
          _t4 = _context3["catch"](2);
          logger.error('createThreatModel failed', _t4);
          return _context3.abrupt("return", res.status(500).json({
            error: 'Failed to create threat model'
          }));
        case 5:
        case "end":
          return _context3.stop();
      }
    }, _callee3, null, [[2, 4]]);
  }));
  return _createThreatModel.apply(this, arguments);
}
function updateThreatModel(_x7, _x8) {
  return _updateThreatModel.apply(this, arguments);
} // ── import (Threat Dragon v1 / v2 JSON) ───────────────────────────────────────
/**
 * Maps a Threat Dragon mxGraph cell shape string to a CarbonThreat node type.
 */
function _updateThreatModel() {
  _updateThreatModel = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee4(req, res) {
    var _ref6, title, description, content, existing, patch, _yield$db$where$updat, _yield$db$where$updat2, model, _t5;
    return _regenerator["default"].wrap(function (_context4) {
      while (1) switch (_context4.prev = _context4.next) {
        case 0:
          _ref6 = req.body || {}, title = _ref6.title, description = _ref6.description, content = _ref6.content;
          _context4.prev = 1;
          _context4.next = 2;
          return scopedQuery(req).where({
            id: req.params.id
          }).first();
        case 2:
          existing = _context4.sent;
          if (existing) {
            _context4.next = 3;
            break;
          }
          return _context4.abrupt("return", notFound(res));
        case 3:
          patch = {
            updated_at: _knex["default"].fn.now()
          };
          if (title !== undefined) patch.title = title.trim();
          if (description !== undefined) patch.description = description;
          if (content !== undefined) {
            patch.content_encrypted = JSON.stringify((0, _encryption.encryptModel)(content));
            patch.version = existing.version + 1;
          }
          _context4.next = 4;
          return (0, _knex["default"])('threat_models').where({
            id: req.params.id
          }).update(patch).returning(['id', 'title', 'description', 'version', 'is_archived', 'created_at', 'updated_at', 'owner_id', 'org_id']);
        case 4:
          _yield$db$where$updat = _context4.sent;
          _yield$db$where$updat2 = (0, _slicedToArray2["default"])(_yield$db$where$updat, 1);
          model = _yield$db$where$updat2[0];
          return _context4.abrupt("return", res.json({
            model: model
          }));
        case 5:
          _context4.prev = 5;
          _t5 = _context4["catch"](1);
          logger.error('updateThreatModel failed', _t5);
          return _context4.abrupt("return", res.status(500).json({
            error: 'Failed to update threat model'
          }));
        case 6:
        case "end":
          return _context4.stop();
      }
    }, _callee4, null, [[1, 5]]);
  }));
  return _updateThreatModel.apply(this, arguments);
}
function tdShapeToNodeType(shape) {
  if (!shape) return 'process';
  var s = shape.toLowerCase();
  if (s.includes('actor') || s.includes('person')) return 'actor';
  if (s.includes('store') || s.includes('database')) return 'datastore';
  if (s.includes('boundary')) return 'boundary';
  return 'process';
}

/**
 * Converts a Threat Dragon v1/v2 JSON object into our ReactFlow content format.
 * Iterates over all diagrams and collects nodes + edges.
 */
function convertTdJson(json) {
  var _json$detail$diagrams, _json$detail;
  var nodes = [];
  var edges = [];
  var diagrams = (_json$detail$diagrams = json === null || json === void 0 || (_json$detail = json.detail) === null || _json$detail === void 0 ? void 0 : _json$detail.diagrams) !== null && _json$detail$diagrams !== void 0 ? _json$detail$diagrams : [];
  diagrams.forEach(function (diagram) {
    var _diagram$cells;
    var cells = (_diagram$cells = diagram.cells) !== null && _diagram$cells !== void 0 ? _diagram$cells : [];
    cells.forEach(function (cell) {
      // Edges have source + target
      if (cell.source && cell.target) {
        var _cell$id, _ref2, _cell$attrs$text$valu, _cell$attrs;
        edges.push({
          id: (_cell$id = cell.id) !== null && _cell$id !== void 0 ? _cell$id : "e-".concat(Math.random().toString(36).slice(2)),
          source: cell.source,
          target: cell.target,
          data: {
            label: (_ref2 = (_cell$attrs$text$valu = (_cell$attrs = cell.attrs) === null || _cell$attrs === void 0 || (_cell$attrs = _cell$attrs.text) === null || _cell$attrs === void 0 ? void 0 : _cell$attrs.value) !== null && _cell$attrs$text$valu !== void 0 ? _cell$attrs$text$valu : cell.value) !== null && _ref2 !== void 0 ? _ref2 : ''
          }
        });
      } else if (cell.id) {
        var _cell$shape, _cell$position$x, _cell$position, _cell$position$y, _cell$position2, _ref3, _cell$attrs$text$valu2, _cell$attrs2;
        // Skip trust-boundary decorators that have no meaningful position
        var isBoundary = ((_cell$shape = cell.shape) !== null && _cell$shape !== void 0 ? _cell$shape : '').toLowerCase().includes('boundary');
        nodes.push({
          id: cell.id,
          type: isBoundary ? 'boundary' : tdShapeToNodeType(cell.shape),
          position: {
            x: (_cell$position$x = (_cell$position = cell.position) === null || _cell$position === void 0 ? void 0 : _cell$position.x) !== null && _cell$position$x !== void 0 ? _cell$position$x : 0,
            y: (_cell$position$y = (_cell$position2 = cell.position) === null || _cell$position2 === void 0 ? void 0 : _cell$position2.y) !== null && _cell$position$y !== void 0 ? _cell$position$y : 0
          },
          data: {
            label: (_ref3 = (_cell$attrs$text$valu2 = (_cell$attrs2 = cell.attrs) === null || _cell$attrs2 === void 0 || (_cell$attrs2 = _cell$attrs2.text) === null || _cell$attrs2 === void 0 ? void 0 : _cell$attrs2.value) !== null && _cell$attrs$text$valu2 !== void 0 ? _cell$attrs$text$valu2 : cell.value) !== null && _ref3 !== void 0 ? _ref3 : 'Node'
          }
        });
      }
    });
  });
  return {
    nodes: nodes,
    edges: edges
  };
}
function importThreatModel(_x9, _x0) {
  return _importThreatModel.apply(this, arguments);
} // ── archive (soft delete) ─────────────────────────────────────────────────────
function _importThreatModel() {
  _importThreatModel = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee5(req, res) {
    var _json$summary, _req$user5, _ref8, _req$user$orgId3, _req$user6, _req$provider3;
    var _ref7, json, title, userId, orgId, _json$summary2, content, encrypted, _yield$db$insert$retu3, _yield$db$insert$retu4, model, _t6;
    return _regenerator["default"].wrap(function (_context5) {
      while (1) switch (_context5.prev = _context5.next) {
        case 0:
          _ref7 = req.body || {}, json = _ref7.json;
          if (!(!json || (0, _typeof2["default"])(json) !== 'object')) {
            _context5.next = 1;
            break;
          }
          return _context5.abrupt("return", res.status(400).json({
            error: 'json field with a Threat Dragon model object is required'
          }));
        case 1:
          title = (_json$summary = json.summary) === null || _json$summary === void 0 ? void 0 : _json$summary.title;
          if (!(!title || !String(title).trim())) {
            _context5.next = 2;
            break;
          }
          return _context5.abrupt("return", res.status(400).json({
            error: 'Model title is missing from the import file'
          }));
        case 2:
          userId = (_req$user5 = req.user) === null || _req$user5 === void 0 ? void 0 : _req$user5.id;
          orgId = (_ref8 = (_req$user$orgId3 = (_req$user6 = req.user) === null || _req$user6 === void 0 ? void 0 : _req$user6.orgId) !== null && _req$user$orgId3 !== void 0 ? _req$user$orgId3 : (_req$provider3 = req.provider) === null || _req$provider3 === void 0 ? void 0 : _req$provider3.orgId) !== null && _ref8 !== void 0 ? _ref8 : null;
          _context5.prev = 3;
          content = convertTdJson(json);
          encrypted = (0, _encryption.encryptModel)(content);
          _context5.next = 4;
          return (0, _knex["default"])('threat_models').insert({
            title: String(title).trim(),
            description: ((_json$summary2 = json.summary) === null || _json$summary2 === void 0 ? void 0 : _json$summary2.description) || null,
            content_encrypted: JSON.stringify(encrypted),
            owner_id: userId,
            org_id: orgId !== undefined ? orgId : null,
            version: 1
          }).returning(['id', 'title', 'description', 'version', 'is_archived', 'created_at', 'updated_at', 'owner_id', 'org_id']);
        case 4:
          _yield$db$insert$retu3 = _context5.sent;
          _yield$db$insert$retu4 = (0, _slicedToArray2["default"])(_yield$db$insert$retu3, 1);
          model = _yield$db$insert$retu4[0];
          logger.info("Threat model imported (TD JSON): ".concat(model.id, " by user ").concat(userId, " \u2014 ").concat(content.nodes.length, " nodes, ").concat(content.edges.length, " edges"));
          return _context5.abrupt("return", res.status(201).json({
            model: model,
            imported: {
              nodes: content.nodes.length,
              edges: content.edges.length
            }
          }));
        case 5:
          _context5.prev = 5;
          _t6 = _context5["catch"](3);
          logger.error('importThreatModel failed', _t6);
          return _context5.abrupt("return", res.status(500).json({
            error: 'Failed to import threat model'
          }));
        case 6:
        case "end":
          return _context5.stop();
      }
    }, _callee5, null, [[3, 5]]);
  }));
  return _importThreatModel.apply(this, arguments);
}
function archiveThreatModel(_x1, _x10) {
  return _archiveThreatModel.apply(this, arguments);
}
function _archiveThreatModel() {
  _archiveThreatModel = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee6(req, res) {
    var existing, _t7;
    return _regenerator["default"].wrap(function (_context6) {
      while (1) switch (_context6.prev = _context6.next) {
        case 0:
          _context6.prev = 0;
          _context6.next = 1;
          return scopedQuery(req).where({
            id: req.params.id
          }).first();
        case 1:
          existing = _context6.sent;
          if (existing) {
            _context6.next = 2;
            break;
          }
          return _context6.abrupt("return", notFound(res));
        case 2:
          _context6.next = 3;
          return (0, _knex["default"])('threat_models').where({
            id: req.params.id
          }).update({
            is_archived: true,
            updated_at: _knex["default"].fn.now()
          });
        case 3:
          logger.info("Threat model archived: ".concat(req.params.id));
          return _context6.abrupt("return", res.json({
            message: 'Threat model archived'
          }));
        case 4:
          _context6.prev = 4;
          _t7 = _context6["catch"](0);
          logger.error('archiveThreatModel failed', _t7);
          return _context6.abrupt("return", res.status(500).json({
            error: 'Failed to archive threat model'
          }));
        case 5:
        case "end":
          return _context6.stop();
      }
    }, _callee6, null, [[0, 4]]);
  }));
  return _archiveThreatModel.apply(this, arguments);
}