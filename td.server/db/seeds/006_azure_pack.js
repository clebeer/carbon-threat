"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.seed = void 0;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
/**
 * Seed 006 — Microsoft Azure domain pack
 * Idempotent: skips if 'azure' pack already exists.
 */

var seed = exports.seed = /*#__PURE__*/function () {
  var _ref = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(knex) {
    var existing, _yield$knex$insert$re, _yield$knex$insert$re2, azurePack;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.next = 1;
          return knex('domain_packs').where({
            slug: 'azure'
          }).first();
        case 1:
          existing = _context.sent;
          if (!existing) {
            _context.next = 2;
            break;
          }
          return _context.abrupt("return");
        case 2:
          _context.next = 3;
          return knex('domain_packs').insert({
            slug: 'azure',
            name: 'Microsoft Azure',
            description: 'Azure components: VM, Blob Storage, SQL Database, Functions, VNet, App Gateway, API Management, Cosmos DB, Service Bus, AKS, Redis Cache, Firewall, Sentinel, Monitor, Entra ID',
            icon_manifest: JSON.stringify({
              nodeTypes: {
                'vm': {
                  label: 'Virtual Machine',
                  svgPath: 'M4 4h16v16H4z M8 8h8v8H8z M8 1v3 M16 1v3 M8 20v3 M16 20v3',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                'blob-storage': {
                  label: 'Blob Storage',
                  svgPath: 'M12 2a9 3 0 0 1 9 3v14a9 3 0 0 1-18 0V5a9 3 0 0 1 9-3z M3 5a9 3 0 0 0 18 0 M3 12a9 3 0 0 0 18 0',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                'sql-database': {
                  label: 'SQL Database',
                  svgPath: 'M12 3a10 2.5 0 0 1 10 2.5v13A10 2.5 0 0 1 2 18.5V5.5A10 2.5 0 0 1 12 3z M2 9a10 2.5 0 0 0 20 0 M2 14a10 2.5 0 0 0 20 0',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                'azure-functions': {
                  label: 'Azure Functions',
                  svgPath: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                'vnet': {
                  label: 'Virtual Network',
                  svgPath: 'M3 3h18v18H3z M6 6h12v12H6z',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                'app-gateway': {
                  label: 'App Gateway',
                  svgPath: 'M12 2l8 4v4l-8 4-8-4V6l8-4z M4 14l8 4 8-4 M4 18l8 4 8-4',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                'api-management': {
                  label: 'API Management',
                  svgPath: 'M2 12h6l3-4 3 8 3-4h5 M20 12l-3-3 M20 12l-3 3',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                'cosmos-db': {
                  label: 'Cosmos DB',
                  svgPath: 'M12 2a9 3 0 0 1 9 3v14a9 3 0 0 1-18 0V5a9 3 0 0 1 9-3z M3 5a9 3 0 0 0 18 0 M3 12a9 3 0 0 0 18 0',
                  color: '#50B7E0',
                  viewBox: '0 0 24 24'
                },
                'service-bus': {
                  label: 'Service Bus',
                  svgPath: 'M3 5h4v14H3z M9 5h4v14H9z M15 5h4v14h-4z',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                'aks': {
                  label: 'AKS Cluster',
                  svgPath: 'M3 3h18v18H3z M7 3v18 M17 3v18 M3 7h18 M3 17h18',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                'redis-cache': {
                  label: 'Azure Cache',
                  svgPath: 'M12 2a9 3 0 0 1 9 3v14a9 3 0 0 1-18 0V5a9 3 0 0 1 9-3z M12 8v4 M10 10h4',
                  color: '#DD344C',
                  viewBox: '0 0 24 24'
                },
                'azure-firewall': {
                  label: 'Azure Firewall',
                  svgPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                'sentinel': {
                  label: 'Azure Sentinel',
                  svgPath: 'M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z M9 12l2 2 4-4',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                'azure-monitor': {
                  label: 'Azure Monitor',
                  svgPath: 'M3 3h18v18H3z M7 14l3-5 3 3 4-6',
                  color: '#50B7E0',
                  viewBox: '0 0 24 24'
                },
                'entra-id': {
                  label: 'Entra ID',
                  svgPath: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M4 21v-2a8 8 0 0 1 16 0v2',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                'key-vault': {
                  label: 'Key Vault',
                  svgPath: 'M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z M9 12l2 2 4-4',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                'front-door': {
                  label: 'Front Door',
                  svgPath: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2c-4 4-4 16 0 20 M12 2c4 4 4 16 0 20',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                }
              }
            }),
            threat_matrix: JSON.stringify({
              'vm→sql-database': ['rule-002-unencrypted-db-dataflow'],
              'azure-functions→sql-database': ['rule-002-unencrypted-db-dataflow'],
              'aks→service-bus': ['rule-001-unauthenticated-cross-boundary'],
              'azure-functions→blob-storage': ['rule-002-unencrypted-db-dataflow'],
              'front-door→app-gateway': ['rule-001-unauthenticated-cross-boundary'],
              'api-management→azure-functions': ['rule-001-unauthenticated-cross-boundary']
            }),
            is_builtin: true
          }).returning('id');
        case 3:
          _yield$knex$insert$re = _context.sent;
          _yield$knex$insert$re2 = (0, _slicedToArray2["default"])(_yield$knex$insert$re, 1);
          azurePack = _yield$knex$insert$re2[0];
          _context.next = 4;
          return knex('domain_templates').insert([{
            pack_id: azurePack.id,
            name: 'Azure Serverless API',
            description: 'Front Door → Firewall → App Gateway → Functions → Cosmos DB / SQL Database with Service Bus',
            diagram_json: JSON.stringify({
              nodes: [{
                id: 'z1',
                type: 'cyber',
                position: { x: 300, y: 40 },
                data: { label: 'Front Door', kind: 'front-door' }
              }, {
                id: 'z2',
                type: 'cyber',
                position: { x: 300, y: 160 },
                data: { label: 'Azure Firewall', kind: 'azure-firewall' }
              }, {
                id: 'z3',
                type: 'cyber',
                position: { x: 300, y: 280 },
                data: { label: 'App Gateway', kind: 'app-gateway' }
              }, {
                id: 'z4',
                type: 'cyber',
                position: { x: 300, y: 400 },
                data: { label: 'Functions', kind: 'azure-functions' }
              }, {
                id: 'z5',
                type: 'cyber',
                position: { x: 150, y: 530 },
                data: { label: 'Cosmos DB', kind: 'cosmos-db' }
              }, {
                id: 'z6',
                type: 'cyber',
                position: { x: 450, y: 530 },
                data: { label: 'SQL Database', kind: 'sql-database' }
              }, {
                id: 'z7',
                type: 'cyber',
                position: { x: 500, y: 280 },
                data: { label: 'Service Bus', kind: 'service-bus' }
              }, {
                id: 'z8',
                type: 'cyber',
                position: { x: 150, y: 280 },
                data: { label: 'Entra ID', kind: 'entra-id' }
              }],
              edges: [{
                id: 'ze1',
                source: 'z1',
                target: 'z2',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#0078D4', strokeWidth: 2 }
              }, {
                id: 'ze2',
                source: 'z2',
                target: 'z3',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#0078D4', strokeWidth: 2 }
              }, {
                id: 'ze3',
                source: 'z3',
                target: 'z4',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#0078D4', strokeWidth: 2 }
              }, {
                id: 'ze4',
                source: 'z4',
                target: 'z5',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#50B7E0', strokeWidth: 2 }
              }, {
                id: 'ze5',
                source: 'z4',
                target: 'z6',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#0078D4', strokeWidth: 2 }
              }, {
                id: 'ze6',
                source: 'z7',
                target: 'z4',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#0078D4', strokeWidth: 2 }
              }, {
                id: 'ze7',
                source: 'z8',
                target: 'z3',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#0078D4', strokeWidth: 2 }
              }]
            })
          }]);
        case 4:
        case "end":
          return _context.stop();
      }
    }, _callee);
  }));
  return function seed(_x) {
    return _ref.apply(this, arguments);
  };
}();