"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.up = exports.down = void 0;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var up = exports.up = /*#__PURE__*/function () {
  var _ref = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(knex) {
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.next = 1;
          return knex.schema.createTable('domain_packs', function (t) {
            t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            t.string('slug', 50).notNullable().unique();
            t.string('name', 100).notNullable();
            t.text('description');
            t.jsonb('icon_manifest').notNullable().defaultTo('{}');
            t.jsonb('threat_matrix').notNullable().defaultTo('{}');
            t["boolean"]('is_builtin').notNullable().defaultTo(true);
            t.timestamps(true, true);
          });
        case 1:
          _context.next = 2;
          return knex.schema.createTable('domain_templates', function (t) {
            t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            t.uuid('pack_id').notNullable().references('id').inTable('domain_packs').onDelete('CASCADE');
            t.string('name', 255).notNullable();
            t.text('description');
            t.jsonb('diagram_json').notNullable().defaultTo('{}');
            t.timestamps(true, true);
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
          return knex.schema.dropTableIfExists('domain_templates');
        case 1:
          _context2.next = 2;
          return knex.schema.dropTableIfExists('domain_packs');
        case 2:
        case "end":
          return _context2.stop();
      }
    }, _callee2);
  }));
  return function down(_x2) {
    return _ref2.apply(this, arguments);
  };
}();