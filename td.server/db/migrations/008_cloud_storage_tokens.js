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
          return knex.schema.createTable('cloud_storage_tokens', function (t) {
            t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            t.string('provider', 20).notNullable();
            t.text('access_token_enc').nullable();
            t.text('refresh_token_enc').nullable();
            t.timestamp('expires_at').nullable();
            t.text('scope').nullable();
            t.timestamps(true, true);
            t.unique(['user_id', 'provider']);
          });
        case 1:
          _context.next = 2;
          return knex.raw("ALTER TABLE cloud_storage_tokens ADD CONSTRAINT cst_provider_check CHECK (provider IN ('google_drive','onedrive'))");
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
          return knex.schema.dropTableIfExists('cloud_storage_tokens');
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