"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.up = exports.down = void 0;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
/**
 * Migration 004 — Refresh token persistence
 *
 * Moves refresh token storage from the in-memory array in repositories/token.js
 * to a proper database table so tokens survive server restarts.
 *
 * The `token` column is the raw JWT string (≤ 2048 chars).
 * Expired rows are cleaned up opportunistically on every verify() call.
 */

var up = exports.up = /*#__PURE__*/function () {
  var _ref = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(knex) {
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.next = 1;
          return knex.schema.createTable('refresh_tokens', function (t) {
            t.string('token', 2048).primary();
            t.timestamp('expires_at').notNullable();
            t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
          });
        case 1:
          _context.next = 2;
          return knex.schema.table('refresh_tokens', function (t) {
            t.index('expires_at');
          });
        case 2:
        case "end":
          return _context.stop();
      }
    }, _callee);
  }));
  return function up(_x) {
    return _ref.apply(this, arguments);
  };
}();
var down = exports.down = /*#__PURE__*/function () {
  var _ref2 = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee2(knex) {
    return _regenerator["default"].wrap(function (_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          _context2.next = 1;
          return knex.schema.dropTableIfExists('refresh_tokens');
        case 1:
        case "end":
          return _context2.stop();
      }
    }, _callee2);
  }));
  return function down(_x2) {
    return _ref2.apply(this, arguments);
  };
}();