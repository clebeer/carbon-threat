"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _errors = require("./errors.js");
var _Env = _interopRequireDefault(require("../env/Env.js"));
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
var _repositories = _interopRequireDefault(require("../repositories"));
var _responseWrapper = _interopRequireDefault(require("./responseWrapper.js"));
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { (0, _defineProperty2["default"])(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
var logger = _loggerHelper["default"].get("controllers/templateController.js");
var fetchTemplateMetadata = /*#__PURE__*/function () {
  var _ref = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(repository, accessToken) {
    var result, file, decoded, parsed, templates;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.next = 1;
          return repository.listTemplatesAsync(accessToken);
        case 1:
          result = _context.sent;
          file = result[0];
          decoded = Buffer.from(file.content, "base64").toString("utf8");
          parsed = JSON.parse(decoded);
          templates = Array.isArray(parsed) ? parsed : parsed.templates || [];
          return _context.abrupt("return", {
            templates: templates,
            sha: file.sha
          });
        case 2:
        case "end":
          return _context.stop();
      }
    }, _callee);
  }));
  return function fetchTemplateMetadata(_x, _x2) {
    return _ref.apply(this, arguments);
  };
}();

/**
 * Lists all available templates from the repository
 * 
 * Handles multiple repository states:
 * - Normal operation: Returns array of template metadata
 * - NOT_CONFIGURED: GITHUB_CONTENT_REPO environment variable not set
 * - NOT_INITIALIZED: Repository exists but metadata file not created (admin can initialize, non-admins informed)
 * - REPO_NOT_FOUND: Repository doesn't exist or is inaccessible (404)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
var listTemplates = function listTemplates(req, res) {
  return _responseWrapper["default"].sendResponseAsync(/*#__PURE__*/(0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee2() {
    var repository, contentRepo, _yield$fetchTemplateM, templates, _req$user, _req$user2, _t, _t2;
    return _regenerator["default"].wrap(function (_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          repository = _repositories["default"].get();
          contentRepo = _Env["default"].get().config.GITHUB_CONTENT_REPO;
          if (contentRepo) {
            _context2.next = 1;
            break;
          }
          return _context2.abrupt("return", {
            templates: [],
            repoStatus: "NOT_CONFIGURED",
            canInitialize: false,
            message: "Template repository not configured. Set GITHUB_CONTENT_REPO environment variable."
          });
        case 1:
          _context2.prev = 1;
          _context2.next = 2;
          return fetchTemplateMetadata(repository, req.provider.access_token);
        case 2:
          _yield$fetchTemplateM = _context2.sent;
          templates = _yield$fetchTemplateM.templates;
          return _context2.abrupt("return", {
            templates: templates
          });
        case 3:
          _context2.prev = 3;
          _t = _context2["catch"](1);
          if (!(_t.statusCode === 404)) {
            _context2.next = 7;
            break;
          }
          _context2.prev = 4;
          _context2.next = 5;
          return repository.repoExistsAsync(req.provider.access_token);
        case 5:
          return _context2.abrupt("return", {
            templates: [],
            repoStatus: "NOT_INITIALIZED",
            canInitialize: ((_req$user = req.user) === null || _req$user === void 0 ? void 0 : _req$user.isAdmin) || false,
            message: (_req$user2 = req.user) !== null && _req$user2 !== void 0 && _req$user2.isAdmin ? "Template repository not initialized." : "Template repository not initialized. Contact administrator."
          });
        case 6:
          _context2.prev = 6;
          _t2 = _context2["catch"](4);
          return _context2.abrupt("return", (0, _errors.notFound)("Template repository '".concat(contentRepo, "' not found"), res, logger));
        case 7:
          throw _t;
        case 8:
        case "end":
          return _context2.stop();
      }
    }, _callee2, null, [[1, 3], [4, 6]]);
  })), req, res, logger);
};
var importTemplate = /*#__PURE__*/function () {
  var _ref3 = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee3(req, res) {
    var _req$user3;
    var _req$user4, repository, accessToken, _req$body, templateMetadata, model, _yield$fetchTemplateM2, templates, sha, isDuplicate, _t3;
    return _regenerator["default"].wrap(function (_context3) {
      while (1) switch (_context3.prev = _context3.next) {
        case 0:
          if ((_req$user3 = req.user) !== null && _req$user3 !== void 0 && _req$user3.isAdmin) {
            _context3.next = 1;
            break;
          }
          logger.warn("Non-admin user attempted to import template: ".concat((_req$user4 = req.user) === null || _req$user4 === void 0 ? void 0 : _req$user4.username));
          return _context3.abrupt("return", (0, _errors.forbidden)(res, logger));
        case 1:
          repository = _repositories["default"].get();
          accessToken = req.provider.access_token;
          _req$body = req.body, templateMetadata = _req$body.templateMetadata, model = _req$body.model;
          _context3.prev = 2;
          _context3.next = 3;
          return fetchTemplateMetadata(repository, accessToken);
        case 3:
          _yield$fetchTemplateM2 = _context3.sent;
          templates = _yield$fetchTemplateM2.templates;
          sha = _yield$fetchTemplateM2.sha;
          isDuplicate = templates.some(function (t) {
            return (t.name || "").toLowerCase() === templateMetadata.name.toLowerCase();
          });
          if (!isDuplicate) {
            _context3.next = 4;
            break;
          }
          return _context3.abrupt("return", (0, _errors.badRequest)("A template with the name \"".concat(templateMetadata.name, "\" already exists"), res, logger));
        case 4:
          templates.push(templateMetadata);
          _context3.next = 5;
          return repository.updateMetadataAsync(accessToken, templates, sha);
        case 5:
          _context3.next = 6;
          return repository.createContentFileAsync(accessToken, templateMetadata.modelRef, model);
        case 6:
          return _context3.abrupt("return", res.status(201).json({
            status: 201,
            message: "Template imported successfully"
          }));
        case 7:
          _context3.prev = 7;
          _t3 = _context3["catch"](2);
          logger.error("Import template error:", _t3);
          return _context3.abrupt("return", (0, _errors.serverError)(_t3.message || "Failed to import template", res, logger));
        case 8:
        case "end":
          return _context3.stop();
      }
    }, _callee3, null, [[2, 7]]);
  }));
  return function importTemplate(_x3, _x4) {
    return _ref3.apply(this, arguments);
  };
}();
var deleteTemplate = /*#__PURE__*/function () {
  var _ref4 = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee4(req, res) {
    var _req$user5;
    var _req$user6, repository, accessToken, id, _yield$fetchTemplateM3, templates, sha, template, updatedTemplates, _t4;
    return _regenerator["default"].wrap(function (_context4) {
      while (1) switch (_context4.prev = _context4.next) {
        case 0:
          if ((_req$user5 = req.user) !== null && _req$user5 !== void 0 && _req$user5.isAdmin) {
            _context4.next = 1;
            break;
          }
          logger.warn("Non-admin user attempted to delete template: ".concat((_req$user6 = req.user) === null || _req$user6 === void 0 ? void 0 : _req$user6.username));
          return _context4.abrupt("return", (0, _errors.forbidden)(res, logger));
        case 1:
          repository = _repositories["default"].get();
          accessToken = req.provider.access_token;
          id = req.params.id;
          _context4.prev = 2;
          _context4.next = 3;
          return fetchTemplateMetadata(repository, accessToken);
        case 3:
          _yield$fetchTemplateM3 = _context4.sent;
          templates = _yield$fetchTemplateM3.templates;
          sha = _yield$fetchTemplateM3.sha;
          template = templates.find(function (t) {
            return t.id === id;
          });
          if (template) {
            _context4.next = 4;
            break;
          }
          return _context4.abrupt("return", (0, _errors.notFound)("Template with ID \"".concat(id, "\" not found"), res, logger));
        case 4:
          updatedTemplates = templates.filter(function (t) {
            return t.id !== id;
          });
          _context4.next = 5;
          return repository.updateMetadataAsync(accessToken, updatedTemplates, sha);
        case 5:
          _context4.next = 6;
          return repository.deleteContentFileAsync(accessToken, template.modelRef);
        case 6:
          return _context4.abrupt("return", res.status(200).json({
            status: 200,
            message: "Template deleted successfully"
          }));
        case 7:
          _context4.prev = 7;
          _t4 = _context4["catch"](2);
          logger.error(_t4);
          return _context4.abrupt("return", (0, _errors.serverError)(_t4.message || "Failed to delete template", res, logger));
        case 8:
        case "end":
          return _context4.stop();
      }
    }, _callee4, null, [[2, 7]]);
  }));
  return function deleteTemplate(_x5, _x6) {
    return _ref4.apply(this, arguments);
  };
}();
var updateTemplate = /*#__PURE__*/function () {
  var _ref5 = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee5(req, res) {
    var _req$user7;
    var _req$user8, repository, accessToken, id, _req$body2, name, description, tags, _yield$fetchTemplateM4, templates, sha, templateIndex, _t5;
    return _regenerator["default"].wrap(function (_context5) {
      while (1) switch (_context5.prev = _context5.next) {
        case 0:
          if ((_req$user7 = req.user) !== null && _req$user7 !== void 0 && _req$user7.isAdmin) {
            _context5.next = 1;
            break;
          }
          logger.warn("Non-admin user attempted to update template: ".concat((_req$user8 = req.user) === null || _req$user8 === void 0 ? void 0 : _req$user8.username));
          return _context5.abrupt("return", (0, _errors.forbidden)(res, logger));
        case 1:
          repository = _repositories["default"].get();
          accessToken = req.provider.access_token;
          id = req.params.id;
          _req$body2 = req.body, name = _req$body2.name, description = _req$body2.description, tags = _req$body2.tags;
          _context5.prev = 2;
          logger.debug("API updateTemplate request: ".concat(logger.transformToString(req)));
          _context5.next = 3;
          return fetchTemplateMetadata(repository, accessToken);
        case 3:
          _yield$fetchTemplateM4 = _context5.sent;
          templates = _yield$fetchTemplateM4.templates;
          sha = _yield$fetchTemplateM4.sha;
          templateIndex = templates.findIndex(function (t) {
            return t.id === id;
          });
          if (!(templateIndex === -1)) {
            _context5.next = 4;
            break;
          }
          return _context5.abrupt("return", (0, _errors.notFound)("Template with ID \"".concat(id, "\" not found"), res, logger));
        case 4:
          templates[templateIndex] = _objectSpread(_objectSpread(_objectSpread(_objectSpread({}, templates[templateIndex]), {}, {
            name: name.trim()
          }, description && {
            description: description.trim()
          }), Array.isArray(tags) && {
            tags: tags
          }), {}, {
            id: id,
            // Preserve original ID
            modelRef: templates[templateIndex].modelRef // Preserve content file reference
          });
          _context5.next = 5;
          return repository.updateMetadataAsync(accessToken, templates, sha);
        case 5:
          return _context5.abrupt("return", res.status(200).json({
            status: 200,
            message: "Template updated successfully"
          }));
        case 6:
          _context5.prev = 6;
          _t5 = _context5["catch"](2);
          logger.error(_t5);
          return _context5.abrupt("return", (0, _errors.serverError)(_t5.message || "Failed to update template", res, logger));
        case 7:
        case "end":
          return _context5.stop();
      }
    }, _callee5, null, [[2, 6]]);
  }));
  return function updateTemplate(_x7, _x8) {
    return _ref5.apply(this, arguments);
  };
}();

/**
 * Retrieves the full content of a specific template
 * Available to all authenticated users
 * 
 * @param {string} req.params.id - The unique ID of the template
 * @returns {Object} The template content/model
 */
var getTemplateContent = function getTemplateContent(req, res) {
  var repository = _repositories["default"].get();
  var accessToken = req.provider.access_token;
  var id = req.params.id;
  logger.debug("API getTemplateContent request: ".concat(logger.transformToString(req)));
  return _responseWrapper["default"].sendResponseAsync(/*#__PURE__*/(0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee6() {
    var _yield$fetchTemplateM5, templates, templateMetadata, contentResult, contentFile, decoded, templateContent, _t6;
    return _regenerator["default"].wrap(function (_context6) {
      while (1) switch (_context6.prev = _context6.next) {
        case 0:
          _context6.next = 1;
          return fetchTemplateMetadata(repository, accessToken);
        case 1:
          _yield$fetchTemplateM5 = _context6.sent;
          templates = _yield$fetchTemplateM5.templates;
          templateMetadata = templates.find(function (t) {
            return t.id === id;
          });
          if (templateMetadata) {
            _context6.next = 2;
            break;
          }
          return _context6.abrupt("return", (0, _errors.notFound)("Template with ID \"".concat(id, "\" not found"), res, logger));
        case 2:
          _context6.prev = 2;
          _context6.next = 3;
          return repository.getContentFileAsync(accessToken, templateMetadata.modelRef);
        case 3:
          contentResult = _context6.sent;
          contentFile = contentResult[0];
          decoded = Buffer.from(contentFile.content, "base64").toString("utf8");
          templateContent = JSON.parse(decoded);
          return _context6.abrupt("return", {
            content: templateContent
          });
        case 4:
          _context6.prev = 4;
          _t6 = _context6["catch"](2);
          if (!(_t6.statusCode === 404)) {
            _context6.next = 5;
            break;
          }
          return _context6.abrupt("return", (0, _errors.notFound)("Template content for \"".concat(templateMetadata.name, "\" not found"), res, logger));
        case 5:
          throw _t6;
        case 6:
        case "end":
          return _context6.stop();
      }
    }, _callee6, null, [[2, 4]]);
  })), req, res, logger);
};
var bootstrapTemplateRepository = /*#__PURE__*/function () {
  var _ref7 = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee7(req, res) {
    var _req$user9;
    var _req$user0, repository, accessToken, contentRepo, _t7, _t8;
    return _regenerator["default"].wrap(function (_context7) {
      while (1) switch (_context7.prev = _context7.next) {
        case 0:
          if ((_req$user9 = req.user) !== null && _req$user9 !== void 0 && _req$user9.isAdmin) {
            _context7.next = 1;
            break;
          }
          logger.warn("Non-admin user attempted to bootstrap template repository: ".concat((_req$user0 = req.user) === null || _req$user0 === void 0 ? void 0 : _req$user0.username));
          return _context7.abrupt("return", (0, _errors.forbidden)(res, logger));
        case 1:
          repository = _repositories["default"].get();
          accessToken = req.provider.access_token;
          contentRepo = _Env["default"].get().config.GITHUB_CONTENT_REPO;
          if (contentRepo) {
            _context7.next = 2;
            break;
          }
          return _context7.abrupt("return", (0, _errors.badRequest)("Template repository not configured. Set GITHUB_CONTENT_REPO environment variable.", res, logger));
        case 2:
          _context7.prev = 2;
          logger.debug("API bootstrapTemplateRepository request: ".concat(logger.transformToString(req)));

          // Check if already initialized - prevent accidental overwrites
          _context7.prev = 3;
          _context7.next = 4;
          return repository.listTemplatesAsync(accessToken);
        case 4:
          return _context7.abrupt("return", (0, _errors.badRequest)("Template repository already initialized", res, logger));
        case 5:
          _context7.prev = 5;
          _t7 = _context7["catch"](3);
          if (!(_t7.statusCode !== 404)) {
            _context7.next = 6;
            break;
          }
          throw _t7;
        case 6:
          _context7.next = 7;
          return repository.createMetadataAsync(accessToken);
        case 7:
          return _context7.abrupt("return", res.status(201).json({
            status: 201,
            message: "Template repository initialized successfully"
          }));
        case 8:
          _context7.prev = 8;
          _t8 = _context7["catch"](2);
          logger.error(_t8);
          return _context7.abrupt("return", (0, _errors.serverError)(_t8.message || "Failed to initialize template repository", res, logger));
        case 9:
        case "end":
          return _context7.stop();
      }
    }, _callee7, null, [[2, 8], [3, 5]]);
  }));
  return function bootstrapTemplateRepository(_x9, _x0) {
    return _ref7.apply(this, arguments);
  };
}();
var _default = exports["default"] = {
  listTemplates: listTemplates,
  importTemplate: importTemplate,
  deleteTemplate: deleteTemplate,
  updateTemplate: updateTemplate,
  getTemplateContent: getTemplateContent,
  bootstrapTemplateRepository: bootstrapTemplateRepository
};