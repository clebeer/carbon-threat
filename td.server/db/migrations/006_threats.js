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
          return knex.schema.createTable('threats', function (t) {
            t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            t.uuid('model_id').notNullable().references('id').inTable('threat_models').onDelete('CASCADE');
            t.uuid('org_id').nullable().references('id').inTable('organizations').onDelete('SET NULL');
            t.specificType('node_ids', 'text[]').nullable().defaultTo('{}');
            t.specificType('edge_ids', 'text[]').nullable().defaultTo('{}');
            t.string('title', 255).notNullable();
            t.text('description');
            t.string('stride_category', 30).notNullable().defaultTo('Tampering');
            t.string('severity', 10).notNullable().defaultTo('Medium');
            t.string('status', 30).notNullable().defaultTo('Open');
            t.string('source', 20).notNullable().defaultTo('manual');
            t.string('rule_id', 100).nullable();
            t.text('mitigation');
            t.jsonb('owasp_refs').notNullable().defaultTo('[]');
            t.timestamps(true, true);
          });
        case 1:
          _context.next = 2;
          return knex.schema.table('threats', function (t) {
            t.index(['model_id', 'status']);
            t.index(['model_id', 'stride_category']);
          });
        case 2:
          _context.next = 3;
          return knex.raw("ALTER TABLE threats ADD CONSTRAINT threats_stride_category_check CHECK (stride_category IN ('Spoofing','Tampering','Repudiation','Information Disclosure','DoS','Elevation of Privilege'))");
        case 3:
          _context.next = 4;
          return knex.raw("ALTER TABLE threats ADD CONSTRAINT threats_severity_check CHECK (severity IN ('Critical','High','Medium','Low'))");
        case 4:
          _context.next = 5;
          return knex.raw("ALTER TABLE threats ADD CONSTRAINT threats_status_check CHECK (status IN ('Open','Mitigated','Investigating','Not Applicable'))");
        case 5:
          _context.next = 6;
          return knex.raw("ALTER TABLE threats ADD CONSTRAINT threats_source_check CHECK (source IN ('manual','rule','ai'))");
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
          return knex.schema.dropTableIfExists('threats');
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