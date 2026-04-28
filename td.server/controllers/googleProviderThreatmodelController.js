"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
var _repositories = _interopRequireDefault(require("../repositories"));
var _responseWrapper = _interopRequireDefault(require("./responseWrapper.js"));
var logger = _loggerHelper["default"].get('controllers/googleProviderThreatmodelController.js');
var folders = function folders(req, res) {
  return _responseWrapper["default"].sendResponseAsync(/*#__PURE__*/(0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee() {
    var _req$query, _req$query2;
    var googleDrive, pageToken, folderId, foldersResp, folders, parentId, pagination;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          googleDrive = _repositories["default"].getSpecific('googledrive');
          pageToken = (req === null || req === void 0 || (_req$query = req.query) === null || _req$query === void 0 ? void 0 : _req$query.page) || null;
          folderId = (req === null || req === void 0 || (_req$query2 = req.query) === null || _req$query2 === void 0 ? void 0 : _req$query2.folderId) || 'root';
          foldersResp = {};
          folders = [];
          parentId = '';
          _context.next = 1;
          return googleDrive.listFilesInFolderAsync(folderId, pageToken, req.provider.access_token);
        case 1:
          foldersResp = _context.sent;
          folders = foldersResp.folders;
          pagination = {
            nextPageToken: foldersResp.nextPageToken || null,
            currentPageToken: pageToken || null
          };
          if (!(folderId == 'root')) {
            _context.next = 2;
            break;
          }
          parentId = '';
          _context.next = 4;
          break;
        case 2:
          _context.next = 3;
          return googleDrive.getFolderParentIdAsync(folderId, req.provider.access_token);
        case 3:
          parentId = _context.sent;
        case 4:
          return _context.abrupt("return", {
            folders: folders.map(function (folder) {
              return {
                name: folder.name,
                id: folder.id,
                mimeType: folder.mimeType
              };
            }),
            pagination: pagination,
            parentId: parentId
          });
        case 5:
        case "end":
          return _context.stop();
      }
    }, _callee);
  })), req, res, logger);
};
var create = function create(req, res) {
  return _responseWrapper["default"].sendResponseAsync(/*#__PURE__*/(0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee2() {
    var googleDrive, folderId, _req$body, fileContent, fileName, resp;
    return _regenerator["default"].wrap(function (_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          googleDrive = _repositories["default"].getSpecific('googledrive');
          folderId = req.params.folder;
          _req$body = req.body, fileContent = _req$body.fileContent, fileName = _req$body.fileName;
          _context2.next = 1;
          return googleDrive.createFileInFolderAsync(folderId, fileName, fileContent, req.provider.access_token);
        case 1:
          resp = _context2.sent;
          return _context2.abrupt("return", {
            id: resp.id
          });
        case 2:
        case "end":
          return _context2.stop();
      }
    }, _callee2);
  })), req, res, logger);
};
var update = function update(req, res) {
  return _responseWrapper["default"].sendResponseAsync(/*#__PURE__*/(0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee3() {
    var googleDrive, fileId, fileContent, resp;
    return _regenerator["default"].wrap(function (_context3) {
      while (1) switch (_context3.prev = _context3.next) {
        case 0:
          googleDrive = _repositories["default"].getSpecific('googledrive');
          fileId = req.params.file;
          fileContent = req.body.fileContent;
          _context3.next = 1;
          return googleDrive.updateFileAsync(fileId, fileContent, req.provider.access_token);
        case 1:
          resp = _context3.sent;
          return _context3.abrupt("return", {
            id: resp.id
          });
        case 2:
        case "end":
          return _context3.stop();
      }
    }, _callee3);
  })), req, res, logger);
};
var model = function model(req, res) {
  return _responseWrapper["default"].sendResponseAsync(/*#__PURE__*/(0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee4() {
    var googleDrive, fileId, resp;
    return _regenerator["default"].wrap(function (_context4) {
      while (1) switch (_context4.prev = _context4.next) {
        case 0:
          googleDrive = _repositories["default"].getSpecific('googledrive');
          fileId = req.params.file;
          _context4.next = 1;
          return googleDrive.getFileContentAsync(fileId, req.provider.access_token);
        case 1:
          resp = _context4.sent;
          return _context4.abrupt("return", resp);
        case 2:
        case "end":
          return _context4.stop();
      }
    }, _callee4);
  })), req, res, logger);
};
var _default = exports["default"] = {
  folders: folders,
  create: create,
  update: update,
  model: model
};