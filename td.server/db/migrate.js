"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.destroyDb = destroyDb;
exports.runMigrations = runMigrations;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _knex = _interopRequireDefault(require("./knex.js"));
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
var logger = _loggerHelper["default"].get('db/migrate.js');

/**
 * Runs all pending Knex migrations.
 * Called once at application startup before the HTTP server begins accepting requests.
 * Throws on failure so the process exits rather than serving with a broken schema.
 */
function runMigrations() {
  return _runMigrations.apply(this, arguments);
}
/**
 * Destroys the Knex connection pool.
 * Call during graceful shutdown after the HTTP server has closed.
 */
function _runMigrations() {
  _runMigrations = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee() {
    var _yield$knex$migrate$l, _yield$knex$migrate$l2, batch, migrations;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          logger.info('Running database migrations...');
          _context.next = 1;
          return _knex["default"].migrate.latest();
        case 1:
          _yield$knex$migrate$l = _context.sent;
          _yield$knex$migrate$l2 = (0, _slicedToArray2["default"])(_yield$knex$migrate$l, 2);
          batch = _yield$knex$migrate$l2[0];
          migrations = _yield$knex$migrate$l2[1];
          if (migrations.length === 0) {
            logger.info('Database schema is up to date — no migrations needed');
          } else {
            logger.info("Batch ".concat(batch, ": applied ").concat(migrations.length, " migration(s): ") + migrations.join(', '));
          }
        case 2:
        case "end":
          return _context.stop();
      }
    }, _callee);
  }));
  return _runMigrations.apply(this, arguments);
}
function destroyDb() {
  return _destroyDb.apply(this, arguments);
}
function _destroyDb() {
  _destroyDb = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee2() {
    return _regenerator["default"].wrap(function (_context2) {
      while (1) switch (_context2.prev = _context2.next) {
        case 0:
          _context2.next = 1;
          return _knex["default"].destroy();
        case 1:
        case "end":
          return _context2.stop();
      }
    }, _callee2);
  }));
  return _destroyDb.apply(this, arguments);
}