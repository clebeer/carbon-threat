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
 * Seed 004 — Google Cloud Platform domain pack
 * Idempotent: skips if 'gcp' pack already exists.
 */

var seed = exports.seed = /*#__PURE__*/function () {
  var _ref = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(knex) {
    var existing, _yield$knex$insert$re, _yield$knex$insert$re2, gcpPack;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.next = 1;
          return knex('domain_packs').where({
            slug: 'gcp'
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
            slug: 'gcp',
            name: 'Google Cloud Platform',
            description: 'GCP components: Compute Engine, Cloud Storage, Cloud SQL, Cloud Run, GKE, Cloud Functions, Pub/Sub, BigQuery, Cloud IAM',
            icon_manifest: JSON.stringify({
              nodeTypes: {
                'gce': {
                  label: 'Compute Engine',
                  svgPath: 'M4 4h16v16H4z M8 8h8v8H8z M8 1v3 M16 1v3 M8 20v3 M16 20v3',
                  color: '#4285F4',
                  viewBox: '0 0 24 24'
                },
                'gcs': {
                  label: 'Cloud Storage',
                  svgPath: 'M12 2a9 3 0 0 1 9 3v14a9 3 0 0 1-18 0V5a9 3 0 0 1 9-3z M3 5a9 3 0 0 0 18 0 M3 12a9 3 0 0 0 18 0',
                  color: '#4285F4',
                  viewBox: '0 0 24 24'
                },
                'cloud-sql': {
                  label: 'Cloud SQL',
                  svgPath: 'M12 3a10 2.5 0 0 1 10 2.5v13A10 2.5 0 0 1 2 18.5V5.5A10 2.5 0 0 1 12 3z M2 9a10 2.5 0 0 0 20 0 M2 14a10 2.5 0 0 0 20 0',
                  color: '#4285F4',
                  viewBox: '0 0 24 24'
                },
                'cloud-run': {
                  label: 'Cloud Run',
                  svgPath: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
                  color: '#4285F4',
                  viewBox: '0 0 24 24'
                },
                'gke': {
                  label: 'GKE Cluster',
                  svgPath: 'M3 3h18v18H3z M7 3v18 M17 3v18 M3 7h18 M3 17h18',
                  color: '#4285F4',
                  viewBox: '0 0 24 24'
                },
                'cloud-functions': {
                  label: 'Cloud Functions',
                  svgPath: 'M12 2L5 9h4v6h6V9h4L12 2z M5 15h14v5H5z M9 15v5 M15 15v5',
                  color: '#34A853',
                  viewBox: '0 0 24 24'
                },
                'pubsub': {
                  label: 'Pub/Sub',
                  svgPath: 'M3 5h4v14H3z M9 5h4v14H9z M15 5h4v14h-4z M5 8h0 M5 12h0 M5 16h0 M11 8h0 M11 12h0 M11 16h0 M17 8h0 M17 12h0',
                  color: '#EA4335',
                  viewBox: '0 0 24 24'
                },
                'bigquery': {
                  label: 'BigQuery',
                  svgPath: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M7 12h10 M12 7v10 M8 8l8 8 M16 8l-8 8',
                  color: '#4285F4',
                  viewBox: '0 0 24 24'
                },
                'cloud-iam': {
                  label: 'Cloud IAM',
                  svgPath: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M4 21v-2a8 8 0 0 1 16 0v2 M12 14v4 M10 16h4',
                  color: '#34A853',
                  viewBox: '0 0 24 24'
                },
                'firestore': {
                  label: 'Firestore',
                  svgPath: 'M4 20V4h4l4 8-4 8H4z M10 20l4-8-4-8h10v16H10z',
                  color: '#FBBC04',
                  viewBox: '0 0 24 24'
                },
                'cloud-armor': {
                  label: 'Cloud Armor',
                  svgPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
                  color: '#EA4335',
                  viewBox: '0 0 24 24'
                },
                'cloud-cdn': {
                  label: 'Cloud CDN',
                  svgPath: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2c-4 4-4 16 0 20 M12 2c4 4 4 16 0 20',
                  color: '#4285F4',
                  viewBox: '0 0 24 24'
                }
              }
            }),
            threat_matrix: JSON.stringify({
              'gce→cloud-sql': ['rule-002-unencrypted-db-dataflow'],
              'cloud-run→cloud-sql': ['rule-002-unencrypted-db-dataflow'],
              'gke→pubsub': ['rule-001-unauthenticated-cross-boundary'],
              'cloud-functions→gcs': ['rule-002-unencrypted-db-dataflow'],
              'cloud-cdn→cloud-run': ['rule-001-unauthenticated-cross-boundary']
            }),
            is_builtin: true
          }).returning('id');
        case 3:
          _yield$knex$insert$re = _context.sent;
          _yield$knex$insert$re2 = (0, _slicedToArray2["default"])(_yield$knex$insert$re, 1);
          gcpPack = _yield$knex$insert$re2[0];
          _context.next = 4;
          return knex('domain_templates').insert([{
            pack_id: gcpPack.id,
            name: 'GCP Serverless API',
            description: 'Cloud CDN → Cloud Armor → Cloud Run → Cloud SQL / Firestore with Pub/Sub events',
            diagram_json: JSON.stringify({
              nodes: [{
                id: 'g1',
                type: 'cyber',
                position: { x: 300, y: 40 },
                data: { label: 'Cloud CDN', kind: 'cloud-cdn' }
              }, {
                id: 'g2',
                type: 'cyber',
                position: { x: 300, y: 170 },
                data: { label: 'Cloud Armor', kind: 'cloud-armor' }
              }, {
                id: 'g3',
                type: 'cyber',
                position: { x: 300, y: 300 },
                data: { label: 'Cloud Run', kind: 'cloud-run' }
              }, {
                id: 'g4',
                type: 'cyber',
                position: { x: 150, y: 440 },
                data: { label: 'Cloud SQL', kind: 'cloud-sql' }
              }, {
                id: 'g5',
                type: 'cyber',
                position: { x: 450, y: 440 },
                data: { label: 'Firestore', kind: 'firestore' }
              }, {
                id: 'g6',
                type: 'cyber',
                position: { x: 500, y: 170 },
                data: { label: 'Cloud IAM', kind: 'cloud-iam' }
              }, {
                id: 'g7',
                type: 'cyber',
                position: { x: 150, y: 170 },
                data: { label: 'Pub/Sub', kind: 'pubsub' }
              }],
              edges: [{
                id: 'ge1',
                source: 'g1',
                target: 'g2',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#4285F4', strokeWidth: 2 }
              }, {
                id: 'ge2',
                source: 'g2',
                target: 'g3',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#EA4335', strokeWidth: 2 }
              }, {
                id: 'ge3',
                source: 'g3',
                target: 'g4',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#4285F4', strokeWidth: 2 }
              }, {
                id: 'ge4',
                source: 'g3',
                target: 'g5',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#FBBC04', strokeWidth: 2 }
              }, {
                id: 'ge5',
                source: 'g2',
                target: 'g6',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#34A853', strokeWidth: 2 }
              }, {
                id: 'ge6',
                source: 'g7',
                target: 'g3',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#EA4335', strokeWidth: 2 }
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