"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.listAuditLogs = listAuditLogs;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _knex = _interopRequireDefault(require("../db/knex.js"));
var _loggerHelper = _interopRequireDefault(require("../helpers/logger.helper.js"));
/**
 * Audit log controller.
 *
 * Routes (admin-only):
 *   GET /api/audit?page=1&limit=25   — paginated audit trail
 */

var logger = _loggerHelper["default"].get('controllers/auditController.js');
function listAuditLogs(_x, _x2) {
  return _listAuditLogs.apply(this, arguments);
}
function _listAuditLogs() {
  _listAuditLogs = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(req, res) {
    var page, limit, offset, _yield$Promise$all, _yield$Promise$all2, logs, countRow, _t;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          page = Math.max(1, parseInt(req.query.page || '1', 10));
          limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '25', 10)));
          offset = (page - 1) * limit;
          _context.prev = 1;
          _context.next = 2;
          return Promise.all([(0, _knex["default"])('audit_logs').select('id', 'action', 'entity_type', 'entity_id', 'user_id', 'ip_address', 'http_status', 'created_at').orderBy('created_at', 'desc').limit(limit).offset(offset), (0, _knex["default"])('audit_logs').count('id as n').first()]);
        case 2:
          _yield$Promise$all = _context.sent;
          _yield$Promise$all2 = (0, _slicedToArray2["default"])(_yield$Promise$all, 2);
          logs = _yield$Promise$all2[0];
          countRow = _yield$Promise$all2[1];
          return _context.abrupt("return", res.json({
            logs: logs,
            total: parseInt(countRow.n, 10),
            page: page,
            limit: limit
          }));
        case 3:
          _context.prev = 3;
          _t = _context["catch"](1);
          logger.error('listAuditLogs failed', _t);
          return _context.abrupt("return", res.status(500).json({
            error: 'Failed to load audit logs'
          }));
        case 4:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[1, 3]]);
  }));
  return _listAuditLogs.apply(this, arguments);
}