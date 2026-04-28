"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.applyTemplate = applyTemplate;
exports.getPack = getPack;
exports.listPacks = listPacks;
exports.listTemplates = listTemplates;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _knex = _interopRequireDefault(require("../db/knex.js"));
var _encryption = require("../security/encryption.js");
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
var logger = _loggerHelper["default"].get('controllers/domainPacksController.js');
function listPacks(_x, _x2) {
  return _listPacks.apply(this, arguments);
}
function _listPacks() {
  _listPacks = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(req, res) {
    var packs, _t;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 1;
          return (0, _knex["default"])('domain_packs').select('id', 'slug', 'name', 'description', 'is_builtin', 'created_at', 'updated_at').orderBy('name', 'asc');
        case 1:
          packs = _context.sent;
          return _context.abrupt("return", res.json({
            packs: packs
          }));
        case 2:
          _context.prev = 2;
          _t = _context["catch"](0);
          logger.error('listPacks failed', _t);
          return _context.abrupt("return", res.status(500).json({
            error: 'Failed to list domain packs'
          }));
        case 3:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[0, 2]]);
  }));
  return _listPacks.apply(this, arguments);
}
function getPack(_x3, _x4) {
  return _getPack.apply(this, arguments);
}
function _getPack() {
  _getPack = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee2(req, res) {
    var slug, pack, _t2;
    return _regenerator["default"].wrap(function (_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          slug = req.params.slug;
          _context2.prev = 1;
          _context2.next = 2;
          return (0, _knex["default"])('domain_packs').where({
            slug: slug
          }).first();
        case 2:
          pack = _context2.sent;
          if (pack) {
            _context2.next = 3;
            break;
          }
          return _context2.abrupt("return", res.status(404).json({
            error: 'Domain pack not found'
          }));
        case 3:
          return _context2.abrupt("return", res.json({
            pack: pack
          }));
        case 4:
          _context2.prev = 4;
          _t2 = _context2["catch"](1);
          logger.error('getPack failed', _t2);
          return _context2.abrupt("return", res.status(500).json({
            error: 'Failed to retrieve domain pack'
          }));
        case 5:
        case "end":
          return _context2.stop();
      }
    }, _callee2, null, [[1, 4]]);
  }));
  return _getPack.apply(this, arguments);
}
function listTemplates(_x5, _x6) {
  return _listTemplates.apply(this, arguments);
}
function _listTemplates() {
  _listTemplates = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee3(req, res) {
    var slug, pack, templates, _t3;
    return _regenerator["default"].wrap(function (_context3) {
      while (1) switch (_context3.prev = _context3.next) {
        case 0:
          slug = req.params.slug;
          _context3.prev = 1;
          _context3.next = 2;
          return (0, _knex["default"])('domain_packs').where({
            slug: slug
          }).first();
        case 2:
          pack = _context3.sent;
          if (pack) {
            _context3.next = 3;
            break;
          }
          return _context3.abrupt("return", res.status(404).json({
            error: 'Domain pack not found'
          }));
        case 3:
          _context3.next = 4;
          return (0, _knex["default"])('domain_templates').where({
            pack_id: pack.id
          }).select('id', 'pack_id', 'name', 'description', 'diagram_json', 'created_at', 'updated_at').orderBy('name', 'asc');
        case 4:
          templates = _context3.sent;
          return _context3.abrupt("return", res.json({
            templates: templates
          }));
        case 5:
          _context3.prev = 5;
          _t3 = _context3["catch"](1);
          logger.error('listTemplates failed', _t3);
          return _context3.abrupt("return", res.status(500).json({
            error: 'Failed to list templates'
          }));
        case 6:
        case "end":
          return _context3.stop();
      }
    }, _callee3, null, [[1, 5]]);
  }));
  return _listTemplates.apply(this, arguments);
}
function applyTemplate(_x7, _x8) {
  return _applyTemplate.apply(this, arguments);
}
function _applyTemplate() {
  _applyTemplate = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee4(req, res) {
    var _req$user, _ref2, _req$user$orgId, _req$user2, _req$provider;
    var _req$params, slug, templateId, _ref, title, userId, orgId, pack, template, content, encrypted, _yield$db$insert$retu, _yield$db$insert$retu2, model, _t4;
    return _regenerator["default"].wrap(function (_context4) {
      while (1) switch (_context4.prev = _context4.next) {
        case 0:
          _req$params = req.params, slug = _req$params.slug, templateId = _req$params.templateId;
          _ref = req.body || {}, title = _ref.title;
          if (!(!title || !title.trim())) {
            _context4.next = 1;
            break;
          }
          return _context4.abrupt("return", res.status(400).json({
            error: 'title is required'
          }));
        case 1:
          userId = (_req$user = req.user) === null || _req$user === void 0 ? void 0 : _req$user.id;
          orgId = (_ref2 = (_req$user$orgId = (_req$user2 = req.user) === null || _req$user2 === void 0 ? void 0 : _req$user2.orgId) !== null && _req$user$orgId !== void 0 ? _req$user$orgId : (_req$provider = req.provider) === null || _req$provider === void 0 ? void 0 : _req$provider.orgId) !== null && _ref2 !== void 0 ? _ref2 : null;
          _context4.prev = 2;
          _context4.next = 3;
          return (0, _knex["default"])('domain_packs').where({
            slug: slug
          }).first();
        case 3:
          pack = _context4.sent;
          if (pack) {
            _context4.next = 4;
            break;
          }
          return _context4.abrupt("return", res.status(404).json({
            error: 'Domain pack not found'
          }));
        case 4:
          _context4.next = 5;
          return (0, _knex["default"])('domain_templates').where({
            id: templateId,
            pack_id: pack.id
          }).first();
        case 5:
          template = _context4.sent;
          if (template) {
            _context4.next = 6;
            break;
          }
          return _context4.abrupt("return", res.status(404).json({
            error: 'Template not found'
          }));
        case 6:
          content = template.diagram_json || {};
          encrypted = (0, _encryption.encryptModel)(content);
          _context4.next = 7;
          return (0, _knex["default"])('threat_models').insert({
            title: title.trim(),
            description: "Created from template: ".concat(template.name),
            content_encrypted: JSON.stringify(encrypted),
            owner_id: userId,
            org_id: orgId || null,
            version: 1
          }).returning(['id', 'title', 'description', 'version', 'is_archived', 'created_at', 'updated_at', 'owner_id', 'org_id']);
        case 7:
          _yield$db$insert$retu = _context4.sent;
          _yield$db$insert$retu2 = (0, _slicedToArray2["default"])(_yield$db$insert$retu, 1);
          model = _yield$db$insert$retu2[0];
          logger.info("Model created from template ".concat(templateId, " by user ").concat(userId));
          return _context4.abrupt("return", res.status(201).json({
            model: model
          }));
        case 8:
          _context4.prev = 8;
          _t4 = _context4["catch"](2);
          logger.error('applyTemplate failed', _t4);
          return _context4.abrupt("return", res.status(500).json({
            error: 'Failed to apply template'
          }));
        case 9:
        case "end":
          return _context4.stop();
      }
    }, _callee4, null, [[2, 8]]);
  }));
  return _applyTemplate.apply(this, arguments);
}