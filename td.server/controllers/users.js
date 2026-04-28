"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createUser = createUser;
exports.deleteUser = deleteUser;
exports.getUser = getUser;
exports.listUsers = listUsers;
exports.updateUser = updateUser;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _bcrypt = _interopRequireDefault(require("bcrypt"));
var _knex = _interopRequireDefault(require("../db/knex.js"));
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
var logger = _loggerHelper["default"].get('controllers/users.js');
var ALLOWED_ROLES = ['admin', 'analyst', 'viewer', 'api_key'];
var SAFE_COLUMNS = ['id', 'org_id', 'email', 'display_name', 'role', 'is_active', 'last_login_at', 'created_at'];

/**
 * GET /api/users
 * Lists all users. Admin only.
 */
function listUsers(_x, _x2) {
  return _listUsers.apply(this, arguments);
}
/**
 * GET /api/users/:id
 * Gets a single user. Admin or self.
 */
function _listUsers() {
  _listUsers = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(req, res) {
    var users, _t;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 1;
          return (0, _knex["default"])('users').select(SAFE_COLUMNS).orderBy('created_at', 'desc');
        case 1:
          users = _context.sent;
          return _context.abrupt("return", res.json({
            users: users
          }));
        case 2:
          _context.prev = 2;
          _t = _context["catch"](0);
          logger.error('listUsers failed', _t);
          return _context.abrupt("return", res.status(500).json({
            error: 'Internal server error'
          }));
        case 3:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[0, 2]]);
  }));
  return _listUsers.apply(this, arguments);
}
function getUser(_x3, _x4) {
  return _getUser.apply(this, arguments);
}
/**
 * POST /api/users
 * Creates a new user. Admin only.
 */
function _getUser() {
  _getUser = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee2(req, res) {
    var id, user, _t2;
    return _regenerator["default"].wrap(function (_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          id = req.params.id;
          if (!(req.user.role !== 'admin' && req.user.id !== id)) {
            _context2.next = 1;
            break;
          }
          return _context2.abrupt("return", res.status(403).json({
            error: 'Forbidden'
          }));
        case 1:
          _context2.prev = 1;
          _context2.next = 2;
          return (0, _knex["default"])('users').select(SAFE_COLUMNS).where({
            id: id
          }).first();
        case 2:
          user = _context2.sent;
          if (user) {
            _context2.next = 3;
            break;
          }
          return _context2.abrupt("return", res.status(404).json({
            error: 'User not found'
          }));
        case 3:
          return _context2.abrupt("return", res.json({
            user: user
          }));
        case 4:
          _context2.prev = 4;
          _t2 = _context2["catch"](1);
          logger.error('getUser failed', _t2);
          return _context2.abrupt("return", res.status(500).json({
            error: 'Internal server error'
          }));
        case 5:
        case "end":
          return _context2.stop();
      }
    }, _callee2, null, [[1, 4]]);
  }));
  return _getUser.apply(this, arguments);
}
function createUser(_x5, _x6) {
  return _createUser.apply(this, arguments);
}
/**
 * PUT /api/users/:id
 * Updates a user. Admin can update any field; users can only update their own display_name.
 */
function _createUser() {
  _createUser = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee3(req, res) {
    var _ref, email, password, display_name, _ref$role, role, org_id, existing, password_hash, _yield$db$insert$retu, _yield$db$insert$retu2, user, _t3;
    return _regenerator["default"].wrap(function (_context3) {
      while (1) switch (_context3.prev = _context3.next) {
        case 0:
          _ref = req.body || {}, email = _ref.email, password = _ref.password, display_name = _ref.display_name, _ref$role = _ref.role, role = _ref$role === void 0 ? 'analyst' : _ref$role, org_id = _ref.org_id;
          if (!(!email || !password)) {
            _context3.next = 1;
            break;
          }
          return _context3.abrupt("return", res.status(400).json({
            error: 'email and password are required'
          }));
        case 1:
          if (ALLOWED_ROLES.includes(role)) {
            _context3.next = 2;
            break;
          }
          return _context3.abrupt("return", res.status(400).json({
            error: "role must be one of: ".concat(ALLOWED_ROLES.join(', '))
          }));
        case 2:
          if (!(password.length < 12)) {
            _context3.next = 3;
            break;
          }
          return _context3.abrupt("return", res.status(400).json({
            error: 'Password must be at least 12 characters'
          }));
        case 3:
          _context3.prev = 3;
          _context3.next = 4;
          return (0, _knex["default"])('users').where({
            email: email.toLowerCase().trim()
          }).first();
        case 4:
          existing = _context3.sent;
          if (!existing) {
            _context3.next = 5;
            break;
          }
          return _context3.abrupt("return", res.status(409).json({
            error: 'A user with this email already exists'
          }));
        case 5:
          _context3.next = 6;
          return _bcrypt["default"].hash(password, 12);
        case 6:
          password_hash = _context3.sent;
          _context3.next = 7;
          return (0, _knex["default"])('users').insert({
            email: email.toLowerCase().trim(),
            password_hash: password_hash,
            display_name: display_name || null,
            role: role,
            org_id: org_id || null
          }).returning(SAFE_COLUMNS);
        case 7:
          _yield$db$insert$retu = _context3.sent;
          _yield$db$insert$retu2 = (0, _slicedToArray2["default"])(_yield$db$insert$retu, 1);
          user = _yield$db$insert$retu2[0];
          logger.info("User created: ".concat(user.email, " (role=").concat(user.role, ") by admin ").concat(req.user.id));
          return _context3.abrupt("return", res.status(201).json({
            user: user
          }));
        case 8:
          _context3.prev = 8;
          _t3 = _context3["catch"](3);
          logger.error('createUser failed', _t3);
          return _context3.abrupt("return", res.status(500).json({
            error: 'Internal server error'
          }));
        case 9:
        case "end":
          return _context3.stop();
      }
    }, _callee3, null, [[3, 8]]);
  }));
  return _createUser.apply(this, arguments);
}
function updateUser(_x7, _x8) {
  return _updateUser.apply(this, arguments);
}
/**
 * DELETE /api/users/:id
 * Soft-deletes (deactivates) a user. Admin only.
 * Hard deletes are not permitted to preserve audit log referential integrity.
 */
function _updateUser() {
  _updateUser = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee4(req, res) {
    var id, isAdmin, isSelf, allowedFields, updates, _i, _allowedFields, field, _yield$db$where$updat, _yield$db$where$updat2, user, _t4;
    return _regenerator["default"].wrap(function (_context4) {
      while (1) switch (_context4.prev = _context4.next) {
        case 0:
          id = req.params.id;
          isAdmin = req.user.role === 'admin';
          isSelf = req.user.id === id;
          if (!(!isAdmin && !isSelf)) {
            _context4.next = 1;
            break;
          }
          return _context4.abrupt("return", res.status(403).json({
            error: 'Forbidden'
          }));
        case 1:
          allowedFields = isAdmin ? ['email', 'display_name', 'role', 'is_active', 'org_id'] : ['display_name'];
          updates = {};
          for (_i = 0, _allowedFields = allowedFields; _i < _allowedFields.length; _i++) {
            field = _allowedFields[_i];
            if (req.body[field] !== undefined) updates[field] = req.body[field];
          }
          if (!(req.body.password && (isAdmin || isSelf))) {
            _context4.next = 4;
            break;
          }
          if (!(req.body.password.length < 12)) {
            _context4.next = 2;
            break;
          }
          return _context4.abrupt("return", res.status(400).json({
            error: 'Password must be at least 12 characters'
          }));
        case 2:
          _context4.next = 3;
          return _bcrypt["default"].hash(req.body.password, 12);
        case 3:
          updates.password_hash = _context4.sent;
        case 4:
          if (!(updates.role && !ALLOWED_ROLES.includes(updates.role))) {
            _context4.next = 5;
            break;
          }
          return _context4.abrupt("return", res.status(400).json({
            error: "role must be one of: ".concat(ALLOWED_ROLES.join(', '))
          }));
        case 5:
          if (updates.email) {
            updates.email = updates.email.toLowerCase().trim();
          }
          if (!(Object.keys(updates).length === 0)) {
            _context4.next = 6;
            break;
          }
          return _context4.abrupt("return", res.status(400).json({
            error: 'No valid fields to update'
          }));
        case 6:
          updates.updated_at = _knex["default"].fn.now();
          _context4.prev = 7;
          _context4.next = 8;
          return (0, _knex["default"])('users').where({
            id: id
          }).update(updates).returning(SAFE_COLUMNS);
        case 8:
          _yield$db$where$updat = _context4.sent;
          _yield$db$where$updat2 = (0, _slicedToArray2["default"])(_yield$db$where$updat, 1);
          user = _yield$db$where$updat2[0];
          if (user) {
            _context4.next = 9;
            break;
          }
          return _context4.abrupt("return", res.status(404).json({
            error: 'User not found'
          }));
        case 9:
          logger.info("User updated: ".concat(user.email, " by ").concat(req.user.id));
          return _context4.abrupt("return", res.json({
            user: user
          }));
        case 10:
          _context4.prev = 10;
          _t4 = _context4["catch"](7);
          logger.error('updateUser failed', _t4);
          return _context4.abrupt("return", res.status(500).json({
            error: 'Internal server error'
          }));
        case 11:
        case "end":
          return _context4.stop();
      }
    }, _callee4, null, [[7, 10]]);
  }));
  return _updateUser.apply(this, arguments);
}
function deleteUser(_x9, _x0) {
  return _deleteUser.apply(this, arguments);
}
function _deleteUser() {
  _deleteUser = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee5(req, res) {
    var id, _yield$db$where$updat3, _yield$db$where$updat4, user, _t5;
    return _regenerator["default"].wrap(function (_context5) {
      while (1) switch (_context5.prev = _context5.next) {
        case 0:
          id = req.params.id;
          if (!(req.user.id === id)) {
            _context5.next = 1;
            break;
          }
          return _context5.abrupt("return", res.status(400).json({
            error: 'You cannot deactivate your own account'
          }));
        case 1:
          _context5.prev = 1;
          _context5.next = 2;
          return (0, _knex["default"])('users').where({
            id: id
          }).update({
            is_active: false,
            updated_at: _knex["default"].fn.now()
          }).returning(['id', 'email']);
        case 2:
          _yield$db$where$updat3 = _context5.sent;
          _yield$db$where$updat4 = (0, _slicedToArray2["default"])(_yield$db$where$updat3, 1);
          user = _yield$db$where$updat4[0];
          if (user) {
            _context5.next = 3;
            break;
          }
          return _context5.abrupt("return", res.status(404).json({
            error: 'User not found'
          }));
        case 3:
          logger.info("User deactivated: ".concat(user.email, " by admin ").concat(req.user.id));
          return _context5.abrupt("return", res.json({
            message: 'User deactivated',
            user: user
          }));
        case 4:
          _context5.prev = 4;
          _t5 = _context5["catch"](1);
          logger.error('deleteUser failed', _t5);
          return _context5.abrupt("return", res.status(500).json({
            error: 'Internal server error'
          }));
        case 5:
        case "end":
          return _context5.stop();
      }
    }, _callee5, null, [[1, 4]]);
  }));
  return _deleteUser.apply(this, arguments);
}