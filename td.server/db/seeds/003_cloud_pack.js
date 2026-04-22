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
 * Seed 003 — Cloud Infrastructure domain pack
 * Idempotent: skips if 'cloud-infra' pack already exists.
 */

var seed = exports.seed = /*#__PURE__*/function () {
  var _ref = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(knex) {
    var existing, _yield$knex$insert$re, _yield$knex$insert$re2, cloudPack;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.next = 1;
          return knex('domain_packs').where({
            slug: 'cloud-infra'
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
            slug: 'cloud-infra',
            name: 'Cloud Infrastructure',
            description: 'Cloud-native components: Kubernetes, containers, registries, CDN, API gateways, service mesh, queues, caches, monitoring, secrets, IAM, and CI/CD',
            icon_manifest: JSON.stringify({
              nodeTypes: {
                'k8s-cluster': {
                  label: 'Kubernetes Cluster',
                  svgPath: 'M3 3h18v18H3z M7 3v18 M17 3v18 M3 7h18 M3 17h18 M12 7v10 M7 12h10',
                  color: '#326CE5',
                  viewBox: '0 0 24 24'
                },
                container: {
                  label: 'Container',
                  svgPath: 'M2 6h20v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z M6 6V3h12v3 M6 10h12 M6 14h8',
                  color: '#2496ED',
                  viewBox: '0 0 24 24'
                },
                registry: {
                  label: 'Container Registry',
                  svgPath: 'M4 20V4h4v16H4z M10 20V4h4v16h-4z M16 20V4h4v16h-4z M6 8h0 M6 12h0 M6 16h0 M12 8h0 M12 12h0 M12 16h0 M18 8h0 M18 12h0 M18 16h0',
                  color: '#2496ED',
                  viewBox: '0 0 24 24'
                },
                cdn: {
                  label: 'CDN',
                  svgPath: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2c-3 3-3 17 0 20 M12 2c3 3 3 17 0 20 M5 7h14 M5 17h14',
                  color: '#f97316',
                  viewBox: '0 0 24 24'
                },
                'api-gateway': {
                  label: 'API Gateway',
                  svgPath: 'M2 12h20 M12 2v20 M6 6l12 12 M18 6L6 18 M5 5l3 2 M16 5l3 2 M5 19l3-2 M16 19l3-2',
                  color: '#f59e0b',
                  viewBox: '0 0 24 24'
                },
                'service-mesh': {
                  label: 'Service Mesh',
                  svgPath: 'M12 2L2 7l10 5 10-5-10-5z M2 12l10 5 10-5 M2 17l10 5 10-5',
                  color: '#2dd4bf',
                  viewBox: '0 0 24 24'
                },
                queue: {
                  label: 'Message Queue',
                  svgPath: 'M3 5h4v14H3z M9 5h4v14H9z M15 5h4v14h-4z M5 8h0 M5 12h0 M5 16h0 M11 8h0 M11 12h0 M11 16h0 M17 8h0 M17 12h0 M17 16h0',
                  color: '#6366f1',
                  viewBox: '0 0 24 24'
                },
                cache: {
                  label: 'Cache Layer',
                  svgPath: 'M12 2a9 3 0 0 1 9 3v6a9 3 0 0 1-18 0V5a9 3 0 0 1 9-3z M21 12v6a9 3 0 0 1-18 0v-6 M12 8v4 M10 10h4',
                  color: '#dc2626',
                  viewBox: '0 0 24 24'
                },
                monitoring: {
                  label: 'Monitoring',
                  svgPath: 'M3 3h18v18H3z M7 16l3-5 3 3 4-6',
                  color: '#10b981',
                  viewBox: '0 0 24 24'
                },
                vault: {
                  label: 'Secrets Vault',
                  svgPath: 'M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z M9 12l2 2 4-4',
                  color: '#f59e0b',
                  viewBox: '0 0 24 24'
                },
                iam: {
                  label: 'IAM / Identity',
                  svgPath: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M4 21v-2a8 8 0 0 1 16 0v2 M12 14v4 M10 16h4',
                  color: '#8b5cf6',
                  viewBox: '0 0 24 24'
                },
                'waf-cloud': {
                  label: 'Cloud WAF',
                  svgPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
                  color: '#ef4444',
                  viewBox: '0 0 24 24'
                },
                'ddos-protection': {
                  label: 'DDoS Protection',
                  svgPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M8 12h8 M8 8h8 M8 16h8',
                  color: '#ef4444',
                  viewBox: '0 0 24 24'
                },
                backup: {
                  label: 'Backup Storage',
                  svgPath: 'M12 2a9 3 0 0 1 9 3v14a9 3 0 0 1-18 0V5a9 3 0 0 1 9-3z M3 5a9 3 0 0 0 18 0 M3 12a9 3 0 0 0 18 0 M12 8v6 M9 11l3 3 3-3',
                  color: '#64748b',
                  viewBox: '0 0 24 24'
                },
                gitops: {
                  label: 'GitOps / CI-CD',
                  svgPath: 'M4 12h4l3-4 3 8 3-4h5 M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0z M8 12h8 M12 8v8',
                  color: '#f97316',
                  viewBox: '0 0 24 24'
                }
              }
            }),
            threat_matrix: JSON.stringify({
              'api-gateway→k8s-cluster': ['rule-001-unauthenticated-cross-boundary'],
              'container→registry': ['rule-002-unencrypted-db-dataflow'],
              'k8s-cluster→vault': ['rule-002-unencrypted-db-dataflow'],
              'gitops→k8s-cluster': ['rule-001-unauthenticated-cross-boundary'],
              'cdn→api-gateway': ['rule-001-unauthenticated-cross-boundary']
            }),
            is_builtin: true
          }).returning('id');
        case 3:
          _yield$knex$insert$re = _context.sent;
          _yield$knex$insert$re2 = (0, _slicedToArray2["default"])(_yield$knex$insert$re, 1);
          cloudPack = _yield$knex$insert$re2[0];
          _context.next = 4;
          return knex('domain_templates').insert([{
            pack_id: cloudPack.id,
            name: 'Cloud-Native Microservices',
            description: 'CDN → WAF → API Gateway → K8s Cluster → Services with Service Mesh, Queue, Cache, Vault, and Monitoring',
            diagram_json: JSON.stringify({
              nodes: [{
                id: 'c1',
                type: 'cyber',
                position: { x: 300, y: 40 },
                data: { label: 'CDN', kind: 'cdn' }
              }, {
                id: 'c2',
                type: 'cyber',
                position: { x: 300, y: 160 },
                data: { label: 'Cloud WAF', kind: 'waf-cloud' }
              }, {
                id: 'c3',
                type: 'cyber',
                position: { x: 300, y: 280 },
                data: { label: 'API Gateway', kind: 'api-gateway' }
              }, {
                id: 'c4',
                type: 'cyber',
                position: { x: 300, y: 400 },
                data: { label: 'K8s Cluster', kind: 'k8s-cluster' }
              }, {
                id: 'c5',
                type: 'cyber',
                position: { x: 100, y: 400 },
                data: { label: 'Service Mesh', kind: 'service-mesh' }
              }, {
                id: 'c6',
                type: 'cyber',
                position: { x: 500, y: 280 },
                data: { label: 'IAM Provider', kind: 'iam' }
              }, {
                id: 'c7',
                type: 'cyber',
                position: { x: 100, y: 540 },
                data: { label: 'Redis Cache', kind: 'cache' }
              }, {
                id: 'c8',
                type: 'cyber',
                position: { x: 300, y: 540 },
                data: { label: 'PostgreSQL', kind: 'db' }
              }, {
                id: 'c9',
                type: 'cyber',
                position: { x: 500, y: 540 },
                data: { label: 'Message Queue', kind: 'queue' }
              }, {
                id: 'c10',
                type: 'cyber',
                position: { x: 500, y: 400 },
                data: { label: 'Vault', kind: 'vault' }
              }, {
                id: 'c11',
                type: 'cyber',
                position: { x: 500, y: 160 },
                data: { label: 'Monitoring', kind: 'monitoring' }
              }],
              edges: [{
                id: 'ce1',
                source: 'c1',
                target: 'c2',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#f97316', strokeWidth: 2 }
              }, {
                id: 'ce2',
                source: 'c2',
                target: 'c3',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#ef4444', strokeWidth: 2 }
              }, {
                id: 'ce3',
                source: 'c3',
                target: 'c4',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#f59e0b', strokeWidth: 2 }
              }, {
                id: 'ce4',
                source: 'c4',
                target: 'c7',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#dc2626', strokeWidth: 2 }
              }, {
                id: 'ce5',
                source: 'c4',
                target: 'c8',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#00f2ff', strokeWidth: 2 }
              }, {
                id: 'ce6',
                source: 'c4',
                target: 'c9',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#6366f1', strokeWidth: 2 }
              }, {
                id: 'ce7',
                source: 'c4',
                target: 'c5',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#2dd4bf', strokeWidth: 2 }
              }, {
                id: 'ce8',
                source: 'c4',
                target: 'c10',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#f59e0b', strokeWidth: 2 }
              }, {
                id: 'ce9',
                source: 'c3',
                target: 'c6',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#8b5cf6', strokeWidth: 2 }
              }, {
                id: 'ce10',
                source: 'c2',
                target: 'c11',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#10b981', strokeWidth: 2 }
              }]
            })
          }, {
            pack_id: cloudPack.id,
            name: 'CI/CD Pipeline',
            description: 'GitOps → Registry → K8s with secrets management and monitoring',
            diagram_json: JSON.stringify({
              nodes: [{
                id: 'p1',
                type: 'cyber',
                position: { x: 100, y: 100 },
                data: { label: 'Developer', kind: 'user' }
              }, {
                id: 'p2',
                type: 'cyber',
                position: { x: 300, y: 100 },
                data: { label: 'GitOps / CI-CD', kind: 'gitops' }
              }, {
                id: 'p3',
                type: 'cyber',
                position: { x: 500, y: 100 },
                data: { label: 'Container Registry', kind: 'registry' }
              }, {
                id: 'p4',
                type: 'cyber',
                position: { x: 300, y: 260 },
                data: { label: 'K8s Cluster', kind: 'k8s-cluster' }
              }, {
                id: 'p5',
                type: 'cyber',
                position: { x: 100, y: 260 },
                data: { label: 'Secrets Vault', kind: 'vault' }
              }, {
                id: 'p6',
                type: 'cyber',
                position: { x: 500, y: 260 },
                data: { label: 'Monitoring', kind: 'monitoring' }
              }, {
                id: 'p7',
                type: 'cyber',
                position: { x: 300, y: 420 },
                data: { label: 'Database', kind: 'db' }
              }],
              edges: [{
                id: 'pe1',
                source: 'p1',
                target: 'p2',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#f97316', strokeWidth: 2 }
              }, {
                id: 'pe2',
                source: 'p2',
                target: 'p3',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#2496ED', strokeWidth: 2 }
              }, {
                id: 'pe3',
                source: 'p3',
                target: 'p4',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#326CE5', strokeWidth: 2 }
              }, {
                id: 'pe4',
                source: 'p5',
                target: 'p4',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#f59e0b', strokeWidth: 2 }
              }, {
                id: 'pe5',
                source: 'p4',
                target: 'p6',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#10b981', strokeWidth: 2 }
              }, {
                id: 'pe6',
                source: 'p4',
                target: 'p7',
                type: 'smoothstep',
                animated: false,
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