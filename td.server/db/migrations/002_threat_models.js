"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.up = exports.down = void 0;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
/**
 * Migration 002 — Threat models table
 *
 * Stores encrypted threat model JSON blobs in PostgreSQL.
 * content_encrypted contains the AES-256-GCM output from security/encryption.js.
 * The original file-based (GitHub/GitLab/Bitbucket/Google Drive) storage
 * is preserved and still functional — this table is additive.
 */

var up = exports.up = /*#__PURE__*/function () {
  var _ref = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(knex) {
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.next = 1;
          return knex.schema.createTable('threat_models', function (t) {
            t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
            t.uuid('owner_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
            t.string('title', 255).notNullable();
            t.text('description');
            // Encrypted payload: { iv, encryptedData, authTag } serialised as JSON text
            t.text('content_encrypted').notNullable();
            t.integer('version').notNullable().defaultTo(1);
            t["boolean"]('is_archived').notNullable().defaultTo(false);
            t.timestamps(true, true);
          });
        case 1:
          _context.next = 2;
          return knex.schema.table('threat_models', function (t) {
            t.index(['org_id', 'is_archived']);
            t.index('owner_id');
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
          return knex.schema.dropTableIfExists('threat_models');
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