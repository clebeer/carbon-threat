"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _errors = require("./errors.js");
var _Env = _interopRequireDefault(require("../env/Env.js"));
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
var _providers = _interopRequireDefault(require("../providers"));
var _repositories = _interopRequireDefault(require("../repositories"));
var _responseWrapper = _interopRequireDefault(require("./responseWrapper.js"));
var logger = _loggerHelper["default"].get('controllers/threatmodelcontroller.js');
var repos = function repos(req, res) {
  return _responseWrapper["default"].sendResponseAsync(/*#__PURE__*/(0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee() {
    var repository, page, searchQuerys, reposResp, repos, _env$get$config$REPO_, _reposResp$0$items, searchQuery, headers, pageLinks, pagination;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          repository = _repositories["default"].get();
          page = req.query.page || 1;
          searchQuerys = req.query.searchQuery || [];
          if (!(_Env["default"].get().config.REPO_USE_SEARCH === 'true' || _Env["default"].get().config.GITHUB_USE_SEARCH === 'true')) {
            _context.next = 2;
            break;
          }
          logger.debug('Using searchAsync');
          searchQuery = (_env$get$config$REPO_ = _Env["default"].get().config.REPO_SEARCH_QUERY) !== null && _env$get$config$REPO_ !== void 0 ? _env$get$config$REPO_ : _Env["default"].get().config.GITHUB_SEARCH_QUERY;
          _context.next = 1;
          return repository.searchAsync(page, req.provider.access_token, [searchQuery].concat((0, _toConsumableArray2["default"])(searchQuerys)));
        case 1:
          reposResp = _context.sent;
          repos = (_reposResp$0$items = reposResp[0].items) !== null && _reposResp$0$items !== void 0 ? _reposResp$0$items : reposResp[0];
          _context.next = 4;
          break;
        case 2:
          logger.debug('Using reposAsync');
          _context.next = 3;
          return repository.reposAsync(page, req.provider.access_token, [searchQuerys]);
        case 3:
          reposResp = _context.sent;
          repos = reposResp[0];
        case 4:
          headers = reposResp[1];
          pageLinks = reposResp[2];
          logger.debug("API repos request: ".concat(logger.transformToString(req)));
          pagination = getPagination(headers, pageLinks, page);
          return _context.abrupt("return", {
            repos: repos.map(function (x) {
              return x.full_name;
            }),
            pagination: pagination
          });
        case 5:
        case "end":
          return _context.stop();
      }
    }, _callee);
  })), req, res, logger);
};
var branches = function branches(req, res) {
  return _responseWrapper["default"].sendResponseAsync(/*#__PURE__*/(0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee2() {
    var repository, repoInfo, branchesResp, branches, headers, pageLinks, branchNames, pagination;
    return _regenerator["default"].wrap(function (_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          repository = _repositories["default"].get();
          repoInfo = {
            organisation: req.params.organisation,
            repo: req.params.repo,
            page: req.query.page || 1
          };
          logger.debug("API branches request: ".concat(logger.transformToString(req)));
          _context2.next = 1;
          return repository.branchesAsync(repoInfo, req.provider.access_token);
        case 1:
          branchesResp = _context2.sent;
          branches = branchesResp[0];
          headers = branchesResp[1];
          pageLinks = branchesResp[2];
          branchNames = branches.map(function (x) {
            return {
              name: x.name,
              // Protected branches are not so easy to determine from the API on Bitbucket
              "protected": x["protected"] || false
            };
          });
          pagination = getPagination(headers, pageLinks, repoInfo.page);
          return _context2.abrupt("return", {
            branches: branchNames,
            pagination: pagination
          });
        case 2:
        case "end":
          return _context2.stop();
      }
    }, _callee2);
  })), req, res, logger);
};
var models = function models(req, res) {
  return _responseWrapper["default"].sendResponseAsync(/*#__PURE__*/(0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee3() {
    var repository, branchInfo, modelsResp, _t;
    return _regenerator["default"].wrap(function (_context3) {
      while (1) switch (_context3.prev = _context3.next) {
        case 0:
          repository = _repositories["default"].get();
          branchInfo = {
            organisation: req.params.organisation,
            repo: req.params.repo,
            branch: req.params.branch
          };
          logger.debug("API models request: ".concat(logger.transformToString(req)));
          _context3.prev = 1;
          _context3.next = 2;
          return repository.modelsAsync(branchInfo, req.provider.access_token);
        case 2:
          modelsResp = _context3.sent;
          _context3.next = 5;
          break;
        case 3:
          _context3.prev = 3;
          _t = _context3["catch"](1);
          if (!(_t.statusCode === 404)) {
            _context3.next = 4;
            break;
          }
          return _context3.abrupt("return", []);
        case 4:
          throw _t;
        case 5:
          return _context3.abrupt("return", modelsResp[0].map(function (x) {
            return x.name;
          }));
        case 6:
        case "end":
          return _context3.stop();
      }
    }, _callee3, null, [[1, 3]]);
  })), req, res, logger);
};
var model = function model(req, res) {
  return _responseWrapper["default"].sendResponseAsync(/*#__PURE__*/(0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee4() {
    var repository, modelInfo, modelResp;
    return _regenerator["default"].wrap(function (_context4) {
      while (1) switch (_context4.prev = _context4.next) {
        case 0:
          repository = _repositories["default"].get();
          modelInfo = {
            organisation: req.params.organisation,
            repo: req.params.repo,
            branch: req.params.branch,
            model: req.params.model
          };
          logger.debug("API model request: ".concat(logger.transformToString(req)));
          _context4.next = 1;
          return repository.modelAsync(modelInfo, req.provider.access_token);
        case 1:
          modelResp = _context4.sent;
          return _context4.abrupt("return", JSON.parse(Buffer.from(modelResp[0].content, 'base64').toString('utf8')));
        case 2:
        case "end":
          return _context4.stop();
      }
    }, _callee4);
  })), req, res, logger);
};
var create = /*#__PURE__*/function () {
  var _ref5 = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee5(req, res) {
    var repository, modelBody, createResp, _err$response, _t2;
    return _regenerator["default"].wrap(function (_context5) {
      while (1) switch (_context5.prev = _context5.next) {
        case 0:
          repository = _repositories["default"].get();
          modelBody = {
            organisation: req.params.organisation,
            repo: req.params.repo,
            branch: req.params.branch,
            model: req.params.model,
            body: req.body
          };
          logger.debug("API create request: ".concat(logger.transformToString(req)));
          _context5.prev = 1;
          _context5.next = 2;
          return repository.createAsync(modelBody, req.provider.access_token);
        case 2:
          createResp = _context5.sent;
          return _context5.abrupt("return", res.status(201).send(createResp));
        case 3:
          _context5.prev = 3;
          _t2 = _context5["catch"](1);
          logger.error(_t2);

          // Check if the error is due to file already existing (422 status)
          if (!(_t2.statusCode === 422 || ((_err$response = _t2.response) === null || _err$response === void 0 ? void 0 : _err$response.status) === 422)) {
            _context5.next = 4;
            break;
          }
          return _context5.abrupt("return", (0, _errors.conflict)("A threat model with the name \"".concat(modelBody.model, "\" already exists. Please use a different name or update the existing model."), res, logger));
        case 4:
          return _context5.abrupt("return", (0, _errors.serverError)('Error creating model', res, logger));
        case 5:
        case "end":
          return _context5.stop();
      }
    }, _callee5, null, [[1, 3]]);
  }));
  return function create(_x, _x2) {
    return _ref5.apply(this, arguments);
  };
}();
var update = /*#__PURE__*/function () {
  var _ref6 = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee6(req, res) {
    var repository, modelBody, updateResp, _t3;
    return _regenerator["default"].wrap(function (_context6) {
      while (1) switch (_context6.prev = _context6.next) {
        case 0:
          repository = _repositories["default"].get();
          modelBody = {
            organisation: req.params.organisation,
            repo: req.params.repo,
            branch: req.params.branch,
            model: req.params.model,
            body: req.body
          };
          logger.debug("API update request: ".concat(logger.transformToString(req)));
          _context6.prev = 1;
          _context6.next = 2;
          return repository.updateAsync(modelBody, req.provider.access_token);
        case 2:
          updateResp = _context6.sent;
          return _context6.abrupt("return", res.send(updateResp));
        case 3:
          _context6.prev = 3;
          _t3 = _context6["catch"](1);
          logger.error(_t3);
          return _context6.abrupt("return", (0, _errors.serverError)('Error updating model', res, logger));
        case 4:
        case "end":
          return _context6.stop();
      }
    }, _callee6, null, [[1, 3]]);
  }));
  return function update(_x3, _x4) {
    return _ref6.apply(this, arguments);
  };
}();
var deleteModel = /*#__PURE__*/function () {
  var _ref7 = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee7(req, res) {
    var repository, modelInfo, deleteResp, _t4;
    return _regenerator["default"].wrap(function (_context7) {
      while (1) switch (_context7.prev = _context7.next) {
        case 0:
          repository = _repositories["default"].get();
          modelInfo = {
            organisation: req.params.organisation,
            repo: req.params.repo,
            branch: req.params.branch,
            model: req.params.model
          };
          logger.debug("API deleteModel request: ".concat(logger.transformToString(req)));
          _context7.prev = 1;
          _context7.next = 2;
          return repository.deleteAsync(modelInfo, req.provider.access_token);
        case 2:
          deleteResp = _context7.sent;
          return _context7.abrupt("return", res.send(deleteResp));
        case 3:
          _context7.prev = 3;
          _t4 = _context7["catch"](1);
          logger.error(_t4);
          return _context7.abrupt("return", (0, _errors.serverError)('Error deleting model', res, logger));
        case 4:
        case "end":
          return _context7.stop();
      }
    }, _callee7, null, [[1, 3]]);
  }));
  return function deleteModel(_x5, _x6) {
    return _ref7.apply(this, arguments);
  };
}();
var getPagination = function getPagination(headers, pageLinks, page) {
  if (headers === undefined || headers === null || Object.keys(headers).length === 0 || (headers === null || headers === void 0 ? void 0 : headers.link) === null) {
    if (pageLinks === undefined || pageLinks === null || Object.keys(pageLinks).length === 0) {
      return {
        page: page,
        next: false,
        prev: false
      };
    }
    return getPaginationFromPageLinks(pageLinks, page);
  }
  return getPaginationFromHeaders(headers, page);
};
var getPaginationFromPageLinks = function getPaginationFromPageLinks(pageLinks, page) {
  var pagination = {
    page: page,
    next: false,
    prev: false
  };
  pagination.next = pageLinks.next;
  pagination.prev = pageLinks.prev;
  return pagination;
};
var getPaginationFromHeaders = function getPaginationFromHeaders(headers, page) {
  var pagination = {
    page: page,
    next: false,
    prev: false
  };
  var linkHeader = headers.link;
  if (linkHeader) {
    linkHeader.split(',').forEach(function (link) {
      var isLinkType = function isLinkType(type) {
        return link.split(';')[1].split('=')[1] === type;
      };
      if (isLinkType('"next"')) {
        pagination.next = true;
      }
      if (isLinkType('"prev"')) {
        pagination.prev = true;
      }
    });
  }
  return pagination;
};
var organisation = function organisation(req, res) {
  var provider = _providers["default"].get(req.query.provider);
  var fullUrl;
  switch (provider.name) {
    case 'github':
      fullUrl = provider.getGithubUrl();
      break;
    case 'gitlab':
      fullUrl = provider.getGitlabUrl();
      break;
    case 'bitbucket':
      fullUrl = provider.getBitbucketUrl();
      break;
    default:
      return (0, _errors.notFound)("Unknown provider", res, logger);
  }
  var parsed = new URL(fullUrl);
  var organisation = {
    protocol: parsed.protocol.replace(':', ''),
    hostname: parsed.hostname,
    port: parsed.port || ''
  };
  logger.debug("API organisation request: ".concat(logger.transformToString(req)));
  return res.status(200).send(organisation);
};
var createBranch = /*#__PURE__*/function () {
  var _ref8 = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee8(req, res) {
    var repository, branchInfo, createBranchResp, _t5;
    return _regenerator["default"].wrap(function (_context8) {
      while (1) switch (_context8.prev = _context8.next) {
        case 0:
          repository = _repositories["default"].get();
          branchInfo = {
            organisation: req.params.organisation,
            repo: req.params.repo,
            branch: req.params.branch,
            ref: req.body.refBranch
          };
          logger.debug("API createBranch request: ".concat(logger.transformToString(req)));
          _context8.prev = 1;
          _context8.next = 2;
          return repository.createBranchAsync(branchInfo, req.provider.access_token);
        case 2:
          createBranchResp = _context8.sent;
          return _context8.abrupt("return", res.status(201).send(createBranchResp));
        case 3:
          _context8.prev = 3;
          _t5 = _context8["catch"](1);
          logger.error(_t5);
          return _context8.abrupt("return", (0, _errors.serverError)('Error creating branch', res, logger));
        case 4:
        case "end":
          return _context8.stop();
      }
    }, _callee8, null, [[1, 3]]);
  }));
  return function createBranch(_x7, _x8) {
    return _ref8.apply(this, arguments);
  };
}();
var _default = exports["default"] = {
  branches: branches,
  create: create,
  deleteModel: deleteModel,
  model: model,
  models: models,
  organisation: organisation,
  repos: repos,
  update: update,
  createBranch: createBranch
};