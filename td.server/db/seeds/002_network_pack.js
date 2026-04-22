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
 * Seed 002 — Network Infrastructure domain pack
 * Idempotent: skips if 'network' pack already exists.
 */

var seed = exports.seed = /*#__PURE__*/function () {
  var _ref = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(knex) {
    var existing, _yield$knex$insert$re, _yield$knex$insert$re2, networkPack;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.next = 1;
          return knex('domain_packs').where({
            slug: 'network'
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
            slug: 'network',
            name: 'Network Infrastructure',
            description: 'Common network components: routers, switches, firewalls, load balancers, VPN, DNS, IDS/IPS, SIEM, endpoints, and IoT devices',
            icon_manifest: JSON.stringify({
              nodeTypes: {
                router: {
                  label: 'Router',
                  svgPath: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
                  color: '#22c55e',
                  viewBox: '0 0 24 24'
                },
                switch: {
                  label: 'Switch',
                  svgPath: 'M4 4h16v16H4z M4 9h16 M4 14h16 M8 4v5 M12 4v5 M16 4v5 M8 14v6 M12 14v6 M16 14v6',
                  color: '#22c55e',
                  viewBox: '0 0 24 24'
                },
                loadbalancer: {
                  label: 'Load Balancer',
                  svgPath: 'M12 2l8 4v4l-8 4-8-4V6l8-4z M4 14l8 4 8-4 M4 18l8 4 8-4',
                  color: '#3b82f6',
                  viewBox: '0 0 24 24'
                },
                vpn: {
                  label: 'VPN Gateway',
                  svgPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
                  color: '#f59e0b',
                  viewBox: '0 0 24 24'
                },
                dns: {
                  label: 'DNS Server',
                  svgPath: 'M12 2a9 3 0 0 1 9 3v14a9 3 0 0 1-18 0V5a9 3 0 0 1 9-3z M3 5a9 3 0 0 0 18 0 M3 12a9 3 0 0 0 18 0 M12 8v8 M9 11h6',
                  color: '#8b5cf6',
                  viewBox: '0 0 24 24'
                },
                proxy: {
                  label: 'Proxy Server',
                  svgPath: 'M2 12h6l3-4 3 8 3-4h5 M20 12l-3-3 M20 12l-3 3',
                  color: '#64748b',
                  viewBox: '0 0 24 24'
                },
                waf: {
                  label: 'Web App Firewall',
                  svgPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M8 12h8 M10 8h4 M10 16h4',
                  color: '#ef4444',
                  viewBox: '0 0 24 24'
                },
                ids: {
                  label: 'IDS / IPS',
                  svgPath: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2 M12 2v3 M12 19v3 M2 12h3 M19 12h3',
                  color: '#f97316',
                  viewBox: '0 0 24 24'
                },
                siem: {
                  label: 'SIEM',
                  svgPath: 'M3 3h18v18H3z M7 14l3-4 3 6 3-3 4 1 M7 17h10',
                  color: '#06b6d4',
                  viewBox: '0 0 24 24'
                },
                endpoint: {
                  label: 'Endpoint',
                  svgPath: 'M4 5h12v10H4z M8 15h4v3H8z M6 18h8',
                  color: '#94a3b8',
                  viewBox: '0 0 24 24'
                },
                mobile: {
                  label: 'Mobile Device',
                  svgPath: 'M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M10 18h4',
                  color: '#94a3b8',
                  viewBox: '0 0 24 24'
                },
                iot: {
                  label: 'IoT Device',
                  svgPath: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1l2.1-2.1 M17 7l2.1-2.1',
                  color: '#a855f7',
                  viewBox: '0 0 24 24'
                },
                printer: {
                  label: 'Network Printer',
                  svgPath: 'M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z',
                  color: '#64748b',
                  viewBox: '0 0 24 24'
                },
                bridge: {
                  label: 'Network Bridge',
                  svgPath: 'M2 12h5l2-4 2 8 2-4h7 M4 8v8 M20 8v8',
                  color: '#22c55e',
                  viewBox: '0 0 24 24'
                }
              }
            }),
            threat_matrix: JSON.stringify({
              'endpoint→router': ['rule-001-unauthenticated-cross-boundary'],
              'router→fw': ['rule-001-unauthenticated-cross-boundary'],
              'fw→ids': ['rule-001-unauthenticated-cross-boundary'],
              'endpoint→vpn': ['rule-001-unauthenticated-cross-boundary'],
              'vpn→router': ['rule-001-unauthenticated-cross-boundary']
            }),
            is_builtin: true
          }).returning('id');
        case 3:
          _yield$knex$insert$re = _context.sent;
          _yield$knex$insert$re2 = (0, _slicedToArray2["default"])(_yield$knex$insert$re, 1);
          networkPack = _yield$knex$insert$re2[0];
          _context.next = 4;
          return knex('domain_templates').insert([{
            pack_id: networkPack.id,
            name: 'Corporate Network',
            description: 'Standard corporate network: Internet → Firewall → IDS → Load Balancer → Servers with SIEM monitoring',
            diagram_json: JSON.stringify({
              nodes: [{
                id: 'n1',
                type: 'cyber',
                position: { x: 300, y: 40 },
                data: { label: 'Internet Users', kind: 'user' }
              }, {
                id: 'n2',
                type: 'cyber',
                position: { x: 300, y: 180 },
                data: { label: 'VPN Gateway', kind: 'vpn' }
              }, {
                id: 'n3',
                type: 'cyber',
                position: { x: 300, y: 320 },
                data: { label: 'Web App Firewall', kind: 'waf' }
              }, {
                id: 'n4',
                type: 'cyber',
                position: { x: 100, y: 460 },
                data: { label: 'IDS / IPS', kind: 'ids' }
              }, {
                id: 'n5',
                type: 'cyber',
                position: { x: 300, y: 460 },
                data: { label: 'Load Balancer', kind: 'loadbalancer' }
              }, {
                id: 'n6',
                type: 'cyber',
                position: { x: 200, y: 600 },
                data: { label: 'Web Server', kind: 'server' }
              }, {
                id: 'n7',
                type: 'cyber',
                position: { x: 400, y: 600 },
                data: { label: 'Database', kind: 'db' }
              }, {
                id: 'n8',
                type: 'cyber',
                position: { x: 500, y: 320 },
                data: { label: 'SIEM', kind: 'siem' }
              }],
              edges: [{
                id: 'ne1',
                source: 'n1',
                target: 'n2',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#f59e0b', strokeWidth: 2 }
              }, {
                id: 'ne2',
                source: 'n2',
                target: 'n3',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#ef4444', strokeWidth: 2 }
              }, {
                id: 'ne3',
                source: 'n3',
                target: 'n5',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#3b82f6', strokeWidth: 2 }
              }, {
                id: 'ne4',
                source: 'n5',
                target: 'n6',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#22c55e', strokeWidth: 2 }
              }, {
                id: 'ne5',
                source: 'n6',
                target: 'n7',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#00f2ff', strokeWidth: 2 }
              }, {
                id: 'ne6',
                source: 'n3',
                target: 'n4',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#f97316', strokeWidth: 2 }
              }, {
                id: 'ne7',
                source: 'n3',
                target: 'n8',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#06b6d4', strokeWidth: 2 }
              }]
            })
          }, {
            pack_id: networkPack.id,
            name: 'IoT Network',
            description: 'IoT devices connected through gateway, with monitoring and cloud uplink',
            diagram_json: JSON.stringify({
              nodes: [{
                id: 'i1',
                type: 'cyber',
                position: { x: 100, y: 80 },
                data: { label: 'Sensor Array', kind: 'iot' }
              }, {
                id: 'i2',
                type: 'cyber',
                position: { x: 300, y: 80 },
                data: { label: 'Smart Camera', kind: 'iot' }
              }, {
                id: 'i3',
                type: 'cyber',
                position: { x: 500, y: 80 },
                data: { label: 'Controller', kind: 'endpoint' }
              }, {
                id: 'i4',
                type: 'cyber',
                position: { x: 300, y: 220 },
                data: { label: 'IoT Gateway', kind: 'router' }
              }, {
                id: 'i5',
                type: 'cyber',
                position: { x: 300, y: 360 },
                data: { label: 'Firewall', kind: 'fw' }
              }, {
                id: 'i6',
                type: 'cyber',
                position: { x: 300, y: 500 },
                data: { label: 'Cloud Platform', kind: 'cloud' }
              }],
              edges: [{
                id: 'ie1',
                source: 'i1',
                target: 'i4',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#a855f7', strokeWidth: 2 }
              }, {
                id: 'ie2',
                source: 'i2',
                target: 'i4',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#a855f7', strokeWidth: 2 }
              }, {
                id: 'ie3',
                source: 'i3',
                target: 'i4',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#94a3b8', strokeWidth: 2 }
              }, {
                id: 'ie4',
                source: 'i4',
                target: 'i5',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#22c55e', strokeWidth: 2 }
              }, {
                id: 'ie5',
                source: 'i5',
                target: 'i6',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#00f2ff', strokeWidth: 2 }
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