"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.disconnect = disconnect;
exports.exportModel = exportModel;
exports.getAuthUrl = getAuthUrl;
exports.getStatus = getStatus;
exports.importFile = importFile;
exports.listFiles = listFiles;
exports.oauthCallback = oauthCallback;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _axios = _interopRequireDefault(require("axios"));
var _knex = _interopRequireDefault(require("../db/knex.js"));
var _encryption = require("../security/encryption.js");
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { (0, _defineProperty2["default"])(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function _interopRequireWildcard(e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, "default": e }; if (null === e || "object" != _typeof(e) && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (var _t9 in e) "default" !== _t9 && {}.hasOwnProperty.call(e, _t9) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, _t9)) && (i.get || i.set) ? o(f, _t9, i) : f[_t9] = e[_t9]); return f; })(e, t); }
var logger = _loggerHelper["default"].get('controllers/cloudStorageController.js');
var PROVIDERS = {
  google_drive: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    secretEnv: 'GOOGLE_CLIENT_SECRET',
    scopes: ['https://www.googleapis.com/auth/drive.file']
  },
  onedrive: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientIdEnv: 'MICROSOFT_CLIENT_ID',
    secretEnv: 'MICROSOFT_CLIENT_SECRET',
    scopes: ['Files.ReadWrite', 'offline_access']
  }
};
function getCallbackUrl() {
  return process.env.CLOUD_STORAGE_CALLBACK_URL || 'http://localhost:3000/api/cloud-storage/callback';
}
function encryptToken(token) {
  return JSON.stringify((0, _encryption.encryptModel)({
    token: token
  }));
}
function decryptToken(enc) {
  try {
    return (0, _encryption.decryptModel)(JSON.parse(enc)).token;
  } catch (_unused) {
    return null;
  }
}
function getStoredToken(_x, _x2) {
  return _getStoredToken.apply(this, arguments);
}
function _getStoredToken() {
  _getStoredToken = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(userId, provider) {
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          return _context.abrupt("return", (0, _knex["default"])('cloud_storage_tokens').where({
            user_id: userId,
            provider: provider
          }).first());
        case 1:
        case "end":
          return _context.stop();
      }
    }, _callee);
  }));
  return _getStoredToken.apply(this, arguments);
}
function refreshAccessToken(_x3, _x4) {
  return _refreshAccessToken.apply(this, arguments);
}
function _refreshAccessToken() {
  _refreshAccessToken = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee2(row, providerConfig) {
    var refreshToken, params, _yield$axios$post, data, expiresAt;
    return _regenerator["default"].wrap(function (_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          refreshToken = decryptToken(row.refresh_token_enc);
          if (refreshToken) {
            _context2.next = 1;
            break;
          }
          return _context2.abrupt("return", null);
        case 1:
          params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: process.env[providerConfig.clientIdEnv] || '',
            client_secret: process.env[providerConfig.secretEnv] || ''
          });
          _context2.next = 2;
          return _axios["default"].post(providerConfig.tokenUrl, params.toString(), {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });
        case 2:
          _yield$axios$post = _context2.sent;
          data = _yield$axios$post.data;
          expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
          _context2.next = 3;
          return (0, _knex["default"])('cloud_storage_tokens').where({
            id: row.id
          }).update({
            access_token_enc: encryptToken(data.access_token),
            expires_at: expiresAt,
            updated_at: _knex["default"].fn.now()
          });
        case 3:
          return _context2.abrupt("return", data.access_token);
        case 4:
        case "end":
          return _context2.stop();
      }
    }, _callee2);
  }));
  return _refreshAccessToken.apply(this, arguments);
}
function getValidAccessToken(_x5, _x6) {
  return _getValidAccessToken.apply(this, arguments);
}
function _getValidAccessToken() {
  _getValidAccessToken = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee3(userId, provider) {
    var row, isExpired;
    return _regenerator["default"].wrap(function (_context3) {
      while (1) switch (_context3.prev = _context3.next) {
        case 0:
          _context3.next = 1;
          return getStoredToken(userId, provider);
        case 1:
          row = _context3.sent;
          if (row) {
            _context3.next = 2;
            break;
          }
          return _context3.abrupt("return", null);
        case 2:
          isExpired = row.expires_at && new Date(row.expires_at) <= new Date(Date.now() + 60000);
          if (!(isExpired && row.refresh_token_enc)) {
            _context3.next = 3;
            break;
          }
          return _context3.abrupt("return", refreshAccessToken(row, PROVIDERS[provider]));
        case 3:
          return _context3.abrupt("return", decryptToken(row.access_token_enc));
        case 4:
        case "end":
          return _context3.stop();
      }
    }, _callee3);
  }));
  return _getValidAccessToken.apply(this, arguments);
}
function getAuthUrl(_x7, _x8) {
  return _getAuthUrl.apply(this, arguments);
}
function _getAuthUrl() {
  _getAuthUrl = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee4(req, res) {
    var provider, providerConfig, clientId, state, callbackUrl, params, authUrl;
    return _regenerator["default"].wrap(function (_context4) {
      while (1) switch (_context4.prev = _context4.next) {
        case 0:
          provider = req.params.provider;
          providerConfig = PROVIDERS[provider];
          if (providerConfig) {
            _context4.next = 1;
            break;
          }
          return _context4.abrupt("return", res.status(400).json({
            error: 'Unsupported provider'
          }));
        case 1:
          clientId = process.env[providerConfig.clientIdEnv];
          if (clientId) {
            _context4.next = 2;
            break;
          }
          return _context4.abrupt("return", res.status(500).json({
            error: "".concat(providerConfig.clientIdEnv, " not configured")
          }));
        case 2:
          state = Buffer.from(JSON.stringify({
            userId: req.user.id,
            provider: provider
          })).toString('base64');
          callbackUrl = getCallbackUrl();
          params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: callbackUrl,
            response_type: 'code',
            scope: providerConfig.scopes.join(' '),
            state: state,
            access_type: 'offline',
            prompt: 'consent'
          });
          authUrl = "".concat(providerConfig.authUrl, "?").concat(params.toString());
          return _context4.abrupt("return", res.json({
            authUrl: authUrl,
            provider: provider
          }));
        case 3:
        case "end":
          return _context4.stop();
      }
    }, _callee4);
  }));
  return _getAuthUrl.apply(this, arguments);
}
function oauthCallback(_x9, _x0) {
  return _oauthCallback.apply(this, arguments);
}
function _oauthCallback() {
  _oauthCallback = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee5(req, res) {
    var _req$query, code, state, error, userId, provider, _JSON$parse, providerConfig, callbackUrl, params, _yield$axios$post2, data, expiresAt, _t, _t2;
    return _regenerator["default"].wrap(function (_context5) {
      while (1) switch (_context5.prev = _context5.next) {
        case 0:
          _req$query = req.query, code = _req$query.code, state = _req$query.state, error = _req$query.error;
          if (!error) {
            _context5.next = 1;
            break;
          }
          return _context5.abrupt("return", res.status(400).send("<html><body><p>Auth error: ".concat(error, "</p></body></html>")));
        case 1:
          if (!(!code || !state)) {
            _context5.next = 2;
            break;
          }
          return _context5.abrupt("return", res.status(400).send('<html><body><p>Missing code or state</p></body></html>'));
        case 2:
          _context5.prev = 2;
          _JSON$parse = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
          userId = _JSON$parse.userId;
          provider = _JSON$parse.provider;
          _context5.next = 4;
          break;
        case 3:
          _context5.prev = 3;
          _t = _context5["catch"](2);
          return _context5.abrupt("return", res.status(400).send('<html><body><p>Invalid state</p></body></html>'));
        case 4:
          providerConfig = PROVIDERS[provider];
          if (providerConfig) {
            _context5.next = 5;
            break;
          }
          return _context5.abrupt("return", res.status(400).send('<html><body><p>Unknown provider</p></body></html>'));
        case 5:
          _context5.prev = 5;
          callbackUrl = getCallbackUrl();
          params = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: callbackUrl,
            client_id: process.env[providerConfig.clientIdEnv] || '',
            client_secret: process.env[providerConfig.secretEnv] || ''
          });
          _context5.next = 6;
          return _axios["default"].post(providerConfig.tokenUrl, params.toString(), {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });
        case 6:
          _yield$axios$post2 = _context5.sent;
          data = _yield$axios$post2.data;
          expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
          _context5.next = 7;
          return (0, _knex["default"])('cloud_storage_tokens').insert({
            user_id: userId,
            provider: provider,
            access_token_enc: encryptToken(data.access_token),
            refresh_token_enc: data.refresh_token ? encryptToken(data.refresh_token) : null,
            expires_at: expiresAt,
            scope: data.scope || null
          }).onConflict(['user_id', 'provider']).merge(['access_token_enc', 'refresh_token_enc', 'expires_at', 'scope', 'updated_at']);
        case 7:
          logger.info("Cloud storage connected: user ".concat(userId, " provider ").concat(provider));
          return _context5.abrupt("return", res.send("<html><body><script>window.opener?.postMessage({type:'CLOUD_AUTH_SUCCESS',provider:'".concat(provider, "'},'*');window.close();</script></body></html>")));
        case 8:
          _context5.prev = 8;
          _t2 = _context5["catch"](5);
          logger.error('oauthCallback failed', _t2);
          return _context5.abrupt("return", res.status(500).send('<html><body><p>Token exchange failed</p></body></html>'));
        case 9:
        case "end":
          return _context5.stop();
      }
    }, _callee5, null, [[2, 3], [5, 8]]);
  }));
  return _oauthCallback.apply(this, arguments);
}
function listFiles(_x1, _x10) {
  return _listFiles.apply(this, arguments);
}
function _listFiles() {
  _listFiles = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee6(req, res) {
    var provider, folderId, accessToken, files, q, _yield$axios$get, data, url, _yield$axios$get2, _data, _t3;
    return _regenerator["default"].wrap(function (_context6) {
      while (1) switch (_context6.prev = _context6.next) {
        case 0:
          provider = req.params.provider;
          folderId = req.query.folderId;
          if (PROVIDERS[provider]) {
            _context6.next = 1;
            break;
          }
          return _context6.abrupt("return", res.status(400).json({
            error: 'Unsupported provider'
          }));
        case 1:
          _context6.prev = 1;
          _context6.next = 2;
          return getValidAccessToken(req.user.id, provider);
        case 2:
          accessToken = _context6.sent;
          if (accessToken) {
            _context6.next = 3;
            break;
          }
          return _context6.abrupt("return", res.status(401).json({
            error: 'Not connected to provider'
          }));
        case 3:
          files = [];
          if (!(provider === 'google_drive')) {
            _context6.next = 5;
            break;
          }
          q = folderId ? "'".concat(folderId, "' in parents and trashed=false") : "mimeType='application/json' and trashed=false";
          _context6.next = 4;
          return _axios["default"].get('https://www.googleapis.com/drive/v3/files', {
            headers: {
              Authorization: "Bearer ".concat(accessToken)
            },
            params: {
              q: q,
              fields: 'files(id,name,mimeType,modifiedTime)',
              pageSize: 100
            }
          });
        case 4:
          _yield$axios$get = _context6.sent;
          data = _yield$axios$get.data;
          files = (data.files || []).map(function (f) {
            return {
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              modifiedTime: f.modifiedTime
            };
          });
          _context6.next = 7;
          break;
        case 5:
          url = folderId ? "https://graph.microsoft.com/v1.0/me/drive/items/".concat(folderId, "/children") : 'https://graph.microsoft.com/v1.0/me/drive/root/children';
          _context6.next = 6;
          return _axios["default"].get(url, {
            headers: {
              Authorization: "Bearer ".concat(accessToken)
            },
            params: {
              $top: 100
            }
          });
        case 6:
          _yield$axios$get2 = _context6.sent;
          _data = _yield$axios$get2.data;
          files = (_data.value || []).map(function (f) {
            var _f$file;
            return {
              id: f.id,
              name: f.name,
              mimeType: ((_f$file = f.file) === null || _f$file === void 0 ? void 0 : _f$file.mimeType) || 'application/octet-stream',
              modifiedTime: f.lastModifiedDateTime
            };
          });
        case 7:
          return _context6.abrupt("return", res.json({
            files: files
          }));
        case 8:
          _context6.prev = 8;
          _t3 = _context6["catch"](1);
          logger.error('listFiles failed', _t3);
          return _context6.abrupt("return", res.status(500).json({
            error: 'Failed to list files'
          }));
        case 9:
        case "end":
          return _context6.stop();
      }
    }, _callee6, null, [[1, 8]]);
  }));
  return _listFiles.apply(this, arguments);
}
function importFile(_x11, _x12) {
  return _importFile.apply(this, arguments);
}
function _importFile() {
  _importFile = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee7(req, res) {
    var _req$user, _ref2, _req$user$orgId, _req$user2, _req$provider;
    var provider, _ref, fileId, title, userId, orgId, accessToken, content, _yield$axios$get3, data, _yield$axios$get4, _data2, encrypted, _yield$db$insert$retu, _yield$db$insert$retu2, model, _t4;
    return _regenerator["default"].wrap(function (_context7) {
      while (1) switch (_context7.prev = _context7.next) {
        case 0:
          provider = req.params.provider;
          _ref = req.body || {}, fileId = _ref.fileId, title = _ref.title;
          if (PROVIDERS[provider]) {
            _context7.next = 1;
            break;
          }
          return _context7.abrupt("return", res.status(400).json({
            error: 'Unsupported provider'
          }));
        case 1:
          if (fileId) {
            _context7.next = 2;
            break;
          }
          return _context7.abrupt("return", res.status(400).json({
            error: 'fileId is required'
          }));
        case 2:
          if (!(!title || !title.trim())) {
            _context7.next = 3;
            break;
          }
          return _context7.abrupt("return", res.status(400).json({
            error: 'title is required'
          }));
        case 3:
          userId = (_req$user = req.user) === null || _req$user === void 0 ? void 0 : _req$user.id;
          orgId = (_ref2 = (_req$user$orgId = (_req$user2 = req.user) === null || _req$user2 === void 0 ? void 0 : _req$user2.orgId) !== null && _req$user$orgId !== void 0 ? _req$user$orgId : (_req$provider = req.provider) === null || _req$provider === void 0 ? void 0 : _req$provider.orgId) !== null && _ref2 !== void 0 ? _ref2 : null;
          _context7.prev = 4;
          _context7.next = 5;
          return getValidAccessToken(userId, provider);
        case 5:
          accessToken = _context7.sent;
          if (accessToken) {
            _context7.next = 6;
            break;
          }
          return _context7.abrupt("return", res.status(401).json({
            error: 'Not connected to provider'
          }));
        case 6:
          if (!(provider === 'google_drive')) {
            _context7.next = 8;
            break;
          }
          _context7.next = 7;
          return _axios["default"].get("https://www.googleapis.com/drive/v3/files/".concat(fileId), {
            headers: {
              Authorization: "Bearer ".concat(accessToken)
            },
            params: {
              alt: 'media'
            },
            responseType: 'text'
          });
        case 7:
          _yield$axios$get3 = _context7.sent;
          data = _yield$axios$get3.data;
          content = typeof data === 'string' ? JSON.parse(data) : data;
          _context7.next = 10;
          break;
        case 8:
          _context7.next = 9;
          return _axios["default"].get("https://graph.microsoft.com/v1.0/me/drive/items/".concat(fileId, "/content"), {
            headers: {
              Authorization: "Bearer ".concat(accessToken)
            },
            responseType: 'text'
          });
        case 9:
          _yield$axios$get4 = _context7.sent;
          _data2 = _yield$axios$get4.data;
          content = typeof _data2 === 'string' ? JSON.parse(_data2) : _data2;
        case 10:
          encrypted = (0, _encryption.encryptModel)(content);
          _context7.next = 11;
          return (0, _knex["default"])('threat_models').insert({
            title: title.trim(),
            description: "Imported from ".concat(provider),
            content_encrypted: JSON.stringify(encrypted),
            owner_id: userId,
            org_id: orgId || null,
            version: 1
          }).returning(['id', 'title', 'description', 'version', 'is_archived', 'created_at', 'updated_at', 'owner_id', 'org_id']);
        case 11:
          _yield$db$insert$retu = _context7.sent;
          _yield$db$insert$retu2 = (0, _slicedToArray2["default"])(_yield$db$insert$retu, 1);
          model = _yield$db$insert$retu2[0];
          logger.info("Model imported from ".concat(provider, " file ").concat(fileId, " by user ").concat(userId));
          return _context7.abrupt("return", res.status(201).json({
            model: model
          }));
        case 12:
          _context7.prev = 12;
          _t4 = _context7["catch"](4);
          logger.error('importFile failed', _t4);
          return _context7.abrupt("return", res.status(500).json({
            error: 'Failed to import file'
          }));
        case 13:
        case "end":
          return _context7.stop();
      }
    }, _callee7, null, [[4, 12]]);
  }));
  return _importFile.apply(this, arguments);
}
function exportModel(_x13, _x14) {
  return _exportModel.apply(this, arguments);
}
function _exportModel() {
  _exportModel = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee8(req, res) {
    var _req$user3, _ref4, _req$user$orgId2, _req$user4, _req$provider2;
    var provider, _ref3, modelId, folderId, userId, orgId, accessToken, q, row, content, fileName, fileBody, fileId, fileUrl, metadata, FormData, form, _yield$axios$post3, data, uploadUrl, _yield$axios$put, _data3, _t5, _t6;
    return _regenerator["default"].wrap(function (_context8) {
      while (1) switch (_context8.prev = _context8.next) {
        case 0:
          provider = req.params.provider;
          _ref3 = req.body || {}, modelId = _ref3.modelId, folderId = _ref3.folderId;
          if (PROVIDERS[provider]) {
            _context8.next = 1;
            break;
          }
          return _context8.abrupt("return", res.status(400).json({
            error: 'Unsupported provider'
          }));
        case 1:
          if (modelId) {
            _context8.next = 2;
            break;
          }
          return _context8.abrupt("return", res.status(400).json({
            error: 'modelId is required'
          }));
        case 2:
          userId = (_req$user3 = req.user) === null || _req$user3 === void 0 ? void 0 : _req$user3.id;
          orgId = (_ref4 = (_req$user$orgId2 = (_req$user4 = req.user) === null || _req$user4 === void 0 ? void 0 : _req$user4.orgId) !== null && _req$user$orgId2 !== void 0 ? _req$user$orgId2 : (_req$provider2 = req.provider) === null || _req$provider2 === void 0 ? void 0 : _req$provider2.orgId) !== null && _ref4 !== void 0 ? _ref4 : null;
          _context8.prev = 3;
          _context8.next = 4;
          return getValidAccessToken(userId, provider);
        case 4:
          accessToken = _context8.sent;
          if (accessToken) {
            _context8.next = 5;
            break;
          }
          return _context8.abrupt("return", res.status(401).json({
            error: 'Not connected to provider'
          }));
        case 5:
          q = (0, _knex["default"])('threat_models').where({
            is_archived: false,
            id: modelId
          });
          if (!orgId) {
            _context8.next = 7;
            break;
          }
          _context8.next = 6;
          return q.where({
            org_id: orgId
          }).first();
        case 6:
          _t5 = _context8.sent;
          _context8.next = 9;
          break;
        case 7:
          _context8.next = 8;
          return q.where({
            owner_id: userId
          }).first();
        case 8:
          _t5 = _context8.sent;
        case 9:
          row = _t5;
          if (row) {
            _context8.next = 10;
            break;
          }
          return _context8.abrupt("return", res.status(404).json({
            error: 'Threat model not found'
          }));
        case 10:
          content = {};
          if (row.content_encrypted) {
            content = (0, _encryption.decryptModel)(JSON.parse(row.content_encrypted));
          }
          fileName = "".concat(row.title.replace(/[^a-z0-9_-]/gi, '_'), ".json");
          fileBody = JSON.stringify({
            title: row.title,
            description: row.description,
            content: content
          }, null, 2);
          if (!(provider === 'google_drive')) {
            _context8.next = 13;
            break;
          }
          metadata = {
            name: fileName,
            mimeType: 'application/json'
          };
          if (folderId) metadata.parents = [folderId];
          _context8.next = 11;
          return Promise.resolve().then(function () {
            return _interopRequireWildcard(require('form-data'));
          });
        case 11:
          FormData = _context8.sent["default"];
          form = new FormData();
          form.append('metadata', JSON.stringify(metadata), {
            contentType: 'application/json'
          });
          form.append('file', Buffer.from(fileBody), {
            contentType: 'application/json',
            filename: fileName
          });
          _context8.next = 12;
          return _axios["default"].post('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', form, {
            headers: _objectSpread({
              Authorization: "Bearer ".concat(accessToken)
            }, form.getHeaders())
          });
        case 12:
          _yield$axios$post3 = _context8.sent;
          data = _yield$axios$post3.data;
          fileId = data.id;
          fileUrl = data.webViewLink;
          _context8.next = 15;
          break;
        case 13:
          uploadUrl = folderId ? "https://graph.microsoft.com/v1.0/me/drive/items/".concat(folderId, ":/").concat(fileName, ":/content") : "https://graph.microsoft.com/v1.0/me/drive/root:/".concat(fileName, ":/content");
          _context8.next = 14;
          return _axios["default"].put(uploadUrl, fileBody, {
            headers: {
              Authorization: "Bearer ".concat(accessToken),
              'Content-Type': 'application/json'
            }
          });
        case 14:
          _yield$axios$put = _context8.sent;
          _data3 = _yield$axios$put.data;
          fileId = _data3.id;
          fileUrl = _data3.webUrl;
        case 15:
          logger.info("Model ".concat(modelId, " exported to ").concat(provider, " as ").concat(fileName));
          return _context8.abrupt("return", res.json({
            fileId: fileId,
            fileName: fileName,
            url: fileUrl
          }));
        case 16:
          _context8.prev = 16;
          _t6 = _context8["catch"](3);
          logger.error('exportModel failed', _t6);
          return _context8.abrupt("return", res.status(500).json({
            error: 'Failed to export model'
          }));
        case 17:
        case "end":
          return _context8.stop();
      }
    }, _callee8, null, [[3, 16]]);
  }));
  return _exportModel.apply(this, arguments);
}
function disconnect(_x15, _x16) {
  return _disconnect.apply(this, arguments);
}
function _disconnect() {
  _disconnect = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee9(req, res) {
    var provider, _t7;
    return _regenerator["default"].wrap(function (_context9) {
      while (1) switch (_context9.prev = _context9.next) {
        case 0:
          provider = req.params.provider;
          if (PROVIDERS[provider]) {
            _context9.next = 1;
            break;
          }
          return _context9.abrupt("return", res.status(400).json({
            error: 'Unsupported provider'
          }));
        case 1:
          _context9.prev = 1;
          _context9.next = 2;
          return (0, _knex["default"])('cloud_storage_tokens').where({
            user_id: req.user.id,
            provider: provider
          }).del();
        case 2:
          logger.info("Cloud storage disconnected: user ".concat(req.user.id, " provider ").concat(provider));
          return _context9.abrupt("return", res.json({
            message: 'Disconnected'
          }));
        case 3:
          _context9.prev = 3;
          _t7 = _context9["catch"](1);
          logger.error('disconnect failed', _t7);
          return _context9.abrupt("return", res.status(500).json({
            error: 'Failed to disconnect'
          }));
        case 4:
        case "end":
          return _context9.stop();
      }
    }, _callee9, null, [[1, 3]]);
  }));
  return _disconnect.apply(this, arguments);
}
function getStatus(_x17, _x18) {
  return _getStatus.apply(this, arguments);
}
function _getStatus() {
  _getStatus = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee0(req, res) {
    var provider, row, isExpired, hasRefresh, _t8;
    return _regenerator["default"].wrap(function (_context0) {
      while (1) switch (_context0.prev = _context0.next) {
        case 0:
          provider = req.params.provider;
          if (PROVIDERS[provider]) {
            _context0.next = 1;
            break;
          }
          return _context0.abrupt("return", res.status(400).json({
            error: 'Unsupported provider'
          }));
        case 1:
          _context0.prev = 1;
          _context0.next = 2;
          return getStoredToken(req.user.id, provider);
        case 2:
          row = _context0.sent;
          if (row) {
            _context0.next = 3;
            break;
          }
          return _context0.abrupt("return", res.json({
            connected: false
          }));
        case 3:
          isExpired = row.expires_at && new Date(row.expires_at) <= new Date();
          hasRefresh = !!row.refresh_token_enc;
          if (!(isExpired && !hasRefresh)) {
            _context0.next = 4;
            break;
          }
          return _context0.abrupt("return", res.json({
            connected: false
          }));
        case 4:
          return _context0.abrupt("return", res.json({
            connected: true
          }));
        case 5:
          _context0.prev = 5;
          _t8 = _context0["catch"](1);
          logger.error('getStatus failed', _t8);
          return _context0.abrupt("return", res.status(500).json({
            error: 'Failed to check status'
          }));
        case 6:
        case "end":
          return _context0.stop();
      }
    }, _callee0, null, [[1, 5]]);
  }));
  return _getStatus.apply(this, arguments);
}