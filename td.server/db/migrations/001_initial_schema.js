"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.up = exports.down = void 0;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
/**
 * Migration 001 — Initial schema
 *
 * Creates:
 *   organizations  — tenant root; all data is scoped to an org
 *   users          — application users with bcrypt-hashed passwords
 *   audit_logs     — immutable record of every write action
 *   app_config     — key/value configuration store (replaces inline CREATE TABLE)
 */

var up = exports.up = /*#__PURE__*/function () {
  var _ref = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(knex) {
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.next = 1;
          return knex.schema.createTable('organizations', function (t) {
            t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            t.string('name', 255).notNullable();
            t.string('slug', 100).notNullable().unique();
            t.jsonb('settings').defaultTo('{}');
            t["boolean"]('is_active').defaultTo(true);
            t.timestamps(true, true); // created_at, updated_at
          });
        case 1:
          _context.next = 2;
          return knex.schema.createTable('users', function (t) {
            t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            t.uuid('org_id').references('id').inTable('organizations').onDelete('CASCADE');
            t.string('email', 255).notNullable().unique();
            t.string('password_hash', 255); // null for SSO-only users
            t.string('display_name', 255);
            t.enu('role', ['admin', 'analyst', 'viewer', 'api_key']).notNullable().defaultTo('analyst');
            t["boolean"]('is_active').notNullable().defaultTo(true);
            t.timestamp('last_login_at');
            t.timestamps(true, true);
          });
        case 2:
          _context.next = 3;
          return knex.schema.table('users', function (t) {
            t.index('email');
            t.index(['org_id', 'is_active']);
          });
        case 3:
          _context.next = 4;
          return knex.schema.createTable('audit_logs', function (t) {
            t.bigIncrements('id');
            t.uuid('user_id'); // null for anonymous/system actions
            t.string('action', 100).notNullable(); // e.g. 'CREATE', 'UPDATE', 'DELETE'
            t.string('entity_type', 100); // e.g. 'threat_model', 'user'
            t.string('entity_id', 255);
            t.jsonb('diff'); // before/after or request body snapshot
            t.string('ip_address', 45);
            t.integer('http_status');
            t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            // No updated_at — audit rows are immutable
          });
        case 4:
          _context.next = 5;
          return knex.schema.table('audit_logs', function (t) {
            t.index(['entity_type', 'entity_id']);
            t.index('user_id');
            t.index('created_at');
          });
        case 5:
          _context.next = 6;
          return knex.schema.createTable('app_config', function (t) {
            t.string('key', 255).primary();
            t.jsonb('value');
            t.timestamps(true, true);
          });
        case 6:
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
          return knex.schema.dropTableIfExists('app_config');
        case 1:
          _context2.next = 2;
          return knex.schema.dropTableIfExists('audit_logs');
        case 2:
          _context2.next = 3;
          return knex.schema.dropTableIfExists('users');
        case 3:
          _context2.next = 4;
          return knex.schema.dropTableIfExists('organizations');
        case 4:
        case "end":
          return _context2.stop();
      }
    }, _callee2);
  }));
  return function down(_x2) {
    return _ref2.apply(this, arguments);
  };
}();