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
 * Seed 001 — Built-in domain packs
 * Idempotent: skips if 'generic' pack already exists.
 */

var seed = exports.seed = /*#__PURE__*/function () {
  var _ref = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(knex) {
    var existing, _yield$knex$insert$re, _yield$knex$insert$re2, genericPack, _yield$knex$insert$re3, _yield$knex$insert$re4, awsPack, _yield$knex$insert$re5, _yield$knex$insert$re6, azurePack;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.next = 1;
          return knex('domain_packs').where({
            slug: 'generic'
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
            slug: 'generic',
            name: 'Generic',
            description: 'Standard components for any architecture diagram',
            icon_manifest: JSON.stringify({
              nodeTypes: {
                server: {
                  label: 'Server',
                  svgPath: 'M4 4h16v16H4z M9 9h6v6H9z M9 1v3 M15 1v3 M9 20v3 M15 20v3',
                  color: '#00f2ff',
                  viewBox: '0 0 24 24'
                },
                db: {
                  label: 'Database',
                  svgPath: 'M12 2a9 3 0 0 1 9 3v14a9 3 0 0 1-18 0V5a9 3 0 0 1 9-3z M3 5a9 3 0 0 0 18 0 M3 12a9 3 0 0 0 18 0',
                  color: '#00f2ff',
                  viewBox: '0 0 24 24'
                },
                fw: {
                  label: 'Firewall',
                  svgPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
                  color: '#22c55e',
                  viewBox: '0 0 24 24'
                },
                user: {
                  label: 'User/Actor',
                  svgPath: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M4 21v-2a8 8 0 0 1 16 0v2',
                  color: '#b366ff',
                  viewBox: '0 0 24 24'
                },
                api: {
                  label: 'API Gateway',
                  svgPath: 'M2 7h20v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z M16 2l-4 5-4-5 M12 12v5',
                  color: '#f59e0b',
                  viewBox: '0 0 24 24'
                },
                cloud: {
                  label: 'Cloud',
                  svgPath: 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
                  color: '#00f2ff',
                  viewBox: '0 0 24 24'
                },
                browser: {
                  label: 'Web Client',
                  svgPath: 'M2 3h20v18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V3z M2 9h20 M8 3v6',
                  color: '#94a3b8',
                  viewBox: '0 0 24 24'
                }
              }
            }),
            threat_matrix: JSON.stringify({}),
            is_builtin: true
          }).returning('id');
        case 3:
          _yield$knex$insert$re = _context.sent;
          _yield$knex$insert$re2 = (0, _slicedToArray2["default"])(_yield$knex$insert$re, 1);
          genericPack = _yield$knex$insert$re2[0];
          _context.next = 4;
          return knex('domain_templates').insert([{
            pack_id: genericPack.id,
            name: 'Basic Web Application',
            description: '3-tier web app: client, server, database with firewall',
            diagram_json: JSON.stringify({
              nodes: [{
                id: 't1',
                type: 'cyber',
                position: {
                  x: 300,
                  y: 80
                },
                data: {
                  label: 'Web Client',
                  kind: 'browser'
                }
              }, {
                id: 't2',
                type: 'cyber',
                position: {
                  x: 150,
                  y: 240
                },
                data: {
                  label: 'Firewall',
                  kind: 'fw'
                }
              }, {
                id: 't3',
                type: 'cyber',
                position: {
                  x: 300,
                  y: 240
                },
                data: {
                  label: 'Web Server',
                  kind: 'server'
                }
              }, {
                id: 't4',
                type: 'cyber',
                position: {
                  x: 300,
                  y: 400
                },
                data: {
                  label: 'Database',
                  kind: 'db'
                }
              }],
              edges: [{
                id: 'te1',
                source: 't1',
                target: 't2',
                type: 'smoothstep',
                animated: true,
                style: {
                  stroke: 'var(--primary)',
                  strokeWidth: 2
                }
              }, {
                id: 'te2',
                source: 't2',
                target: 't3',
                type: 'smoothstep',
                animated: false,
                style: {
                  stroke: 'var(--secondary)',
                  strokeWidth: 2
                }
              }, {
                id: 'te3',
                source: 't3',
                target: 't4',
                type: 'smoothstep',
                animated: true,
                style: {
                  stroke: 'var(--primary)',
                  strokeWidth: 2
                }
              }]
            })
          }]);
        case 4:
          _context.next = 5;
          return knex('domain_packs').insert({
            slug: 'aws',
            name: 'Amazon Web Services',
            description: 'AWS-specific components: EC2, RDS, Lambda, S3, API Gateway',
            icon_manifest: JSON.stringify({
              nodeTypes: {
                ec2: {
                  label: 'EC2 Instance',
                  svgPath: 'M4 4h16v16H4z M8 8h8v8H8z',
                  color: '#FF9900',
                  viewBox: '0 0 24 24'
                },
                rds: {
                  label: 'RDS Database',
                  svgPath: 'M12 3a10 2.5 0 0 1 10 2.5v13A10 2.5 0 0 1 2 18.5V5.5A10 2.5 0 0 1 12 3z M2 9a10 2.5 0 0 0 20 0 M2 14a10 2.5 0 0 0 20 0',
                  color: '#FF9900',
                  viewBox: '0 0 24 24'
                },
                lambda: {
                  label: 'Lambda',
                  svgPath: 'M4 20L9 4h3l2 6 4-6h3L15 20h-3l-1-4-4 4z',
                  color: '#FF9900',
                  viewBox: '0 0 24 24'
                },
                s3: {
                  label: 'S3 Bucket',
                  svgPath: 'M12 2a10 3 0 0 1 10 3v14a10 3 0 0 1-20 0V5a10 3 0 0 1 10-3z M2 9a10 3 0 0 0 20 0',
                  color: '#FF9900',
                  viewBox: '0 0 24 24'
                },
                'api-gw': {
                  label: 'API Gateway',
                  svgPath: 'M2 12h20 M12 2v20 M6 6l12 12 M18 6L6 18',
                  color: '#FF4F8B',
                  viewBox: '0 0 24 24'
                },
                cloudfront: {
                  label: 'CloudFront',
                  svgPath: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z M2 12h20 M12 2a15 15 0 0 1 0 20 M12 2a15 15 0 0 0 0 20',
                  color: '#8C4FFF',
                  viewBox: '0 0 24 24'
                },
                vpc: {
                  label: 'VPC',
                  svgPath: 'M3 3h18v18H3z M7 3v18 M17 3v18 M3 7h18 M3 17h18',
                  color: '#FF9900',
                  viewBox: '0 0 24 24'
                }
              }
            }),
            threat_matrix: JSON.stringify({
              'ec2→rds': ['rule-002-unencrypted-db-dataflow', 'rule-003-direct-external-to-db'],
              'lambda→rds': ['rule-002-unencrypted-db-dataflow'],
              'cloudfront→api-gw': ['rule-001-unauthenticated-cross-boundary']
            }),
            is_builtin: true
          }).returning('id');
        case 5:
          _yield$knex$insert$re3 = _context.sent;
          _yield$knex$insert$re4 = (0, _slicedToArray2["default"])(_yield$knex$insert$re3, 1);
          awsPack = _yield$knex$insert$re4[0];
          _context.next = 6;
          return knex('domain_templates').insert([{
            pack_id: awsPack.id,
            name: 'AWS 3-Tier Web App',
            description: 'CloudFront → API Gateway → Lambda → RDS',
            diagram_json: JSON.stringify({
              nodes: [{
                id: 'a1',
                type: 'cyber',
                position: {
                  x: 300,
                  y: 80
                },
                data: {
                  label: 'CloudFront CDN',
                  kind: 'cloudfront'
                }
              }, {
                id: 'a2',
                type: 'cyber',
                position: {
                  x: 300,
                  y: 220
                },
                data: {
                  label: 'API Gateway',
                  kind: 'api-gw'
                }
              }, {
                id: 'a3',
                type: 'cyber',
                position: {
                  x: 300,
                  y: 360
                },
                data: {
                  label: 'Lambda Function',
                  kind: 'lambda'
                }
              }, {
                id: 'a4',
                type: 'cyber',
                position: {
                  x: 300,
                  y: 500
                },
                data: {
                  label: 'RDS PostgreSQL',
                  kind: 'rds'
                }
              }, {
                id: 'a5',
                type: 'cyber',
                position: {
                  x: 100,
                  y: 360
                },
                data: {
                  label: 'S3 Bucket',
                  kind: 's3'
                }
              }],
              edges: [{
                id: 'ae1',
                source: 'a1',
                target: 'a2',
                type: 'smoothstep',
                animated: true,
                style: {
                  stroke: '#FF9900',
                  strokeWidth: 2
                }
              }, {
                id: 'ae2',
                source: 'a2',
                target: 'a3',
                type: 'smoothstep',
                animated: true,
                style: {
                  stroke: '#FF9900',
                  strokeWidth: 2
                }
              }, {
                id: 'ae3',
                source: 'a3',
                target: 'a4',
                type: 'smoothstep',
                animated: false,
                style: {
                  stroke: '#FF4F8B',
                  strokeWidth: 2
                }
              }, {
                id: 'ae4',
                source: 'a3',
                target: 'a5',
                type: 'smoothstep',
                animated: false,
                style: {
                  stroke: '#8C4FFF',
                  strokeWidth: 2
                }
              }]
            })
          }]);
        case 6:
          _context.next = 7;
          return knex('domain_packs').insert({
            slug: 'azure',
            name: 'Microsoft Azure',
            description: 'Azure components: VM, SQL, Functions, Storage, APIM',
            icon_manifest: JSON.stringify({
              nodeTypes: {
                vm: {
                  label: 'Virtual Machine',
                  svgPath: 'M2 6h20v12H2z M6 6V2h12v4 M6 18v4h12v-4',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                'sql-db': {
                  label: 'Azure SQL',
                  svgPath: 'M12 2a10 2.5 0 0 1 10 2.5v15A10 2.5 0 0 1 2 19.5V4.5A10 2.5 0 0 1 12 2z M2 8a10 2.5 0 0 0 20 0 M2 13a10 2.5 0 0 0 20 0',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                "function": {
                  label: 'Azure Function',
                  svgPath: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                storage: {
                  label: 'Storage Account',
                  svgPath: 'M4 20V4h16v16H4z M8 4v16 M16 4v16 M4 12h16',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                },
                apim: {
                  label: 'API Management',
                  svgPath: 'M2 12h20 M12 2v20 M5 5l14 14 M19 5L5 19',
                  color: '#68217A',
                  viewBox: '0 0 24 24'
                },
                cdn: {
                  label: 'Azure CDN',
                  svgPath: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2c-4 4-4 16 0 20 M12 2c4 4 4 16 0 20',
                  color: '#0078D4',
                  viewBox: '0 0 24 24'
                }
              }
            }),
            threat_matrix: JSON.stringify({
              'vm→sql-db': ['rule-002-unencrypted-db-dataflow'],
              'function→sql-db': ['rule-002-unencrypted-db-dataflow'],
              'apim→function': ['rule-001-unauthenticated-cross-boundary']
            }),
            is_builtin: true
          }).returning('id');
        case 7:
          _yield$knex$insert$re5 = _context.sent;
          _yield$knex$insert$re6 = (0, _slicedToArray2["default"])(_yield$knex$insert$re5, 1);
          azurePack = _yield$knex$insert$re6[0];
          _context.next = 8;
          return knex('domain_templates').insert([{
            pack_id: azurePack.id,
            name: 'Azure API Backend',
            description: 'CDN → APIM → Function → SQL Database',
            diagram_json: JSON.stringify({
              nodes: [{
                id: 'z1',
                type: 'cyber',
                position: {
                  x: 300,
                  y: 80
                },
                data: {
                  label: 'Azure CDN',
                  kind: 'cdn'
                }
              }, {
                id: 'z2',
                type: 'cyber',
                position: {
                  x: 300,
                  y: 220
                },
                data: {
                  label: 'API Management',
                  kind: 'apim'
                }
              }, {
                id: 'z3',
                type: 'cyber',
                position: {
                  x: 300,
                  y: 360
                },
                data: {
                  label: 'Azure Function',
                  kind: 'function'
                }
              }, {
                id: 'z4',
                type: 'cyber',
                position: {
                  x: 300,
                  y: 500
                },
                data: {
                  label: 'Azure SQL DB',
                  kind: 'sql-db'
                }
              }, {
                id: 'z5',
                type: 'cyber',
                position: {
                  x: 100,
                  y: 360
                },
                data: {
                  label: 'Storage Account',
                  kind: 'storage'
                }
              }],
              edges: [{
                id: 'ze1',
                source: 'z1',
                target: 'z2',
                type: 'smoothstep',
                animated: true,
                style: {
                  stroke: '#0078D4',
                  strokeWidth: 2
                }
              }, {
                id: 'ze2',
                source: 'z2',
                target: 'z3',
                type: 'smoothstep',
                animated: true,
                style: {
                  stroke: '#0078D4',
                  strokeWidth: 2
                }
              }, {
                id: 'ze3',
                source: 'z3',
                target: 'z4',
                type: 'smoothstep',
                animated: false,
                style: {
                  stroke: '#68217A',
                  strokeWidth: 2
                }
              }, {
                id: 'ze4',
                source: 'z3',
                target: 'z5',
                type: 'smoothstep',
                animated: false,
                style: {
                  stroke: '#0078D4',
                  strokeWidth: 2
                }
              }]
            })
          }]);
        case 8:
        case "end":
          return _context.stop();
      }
    }, _callee);
  }));
  return function seed(_x) {
    return _ref.apply(this, arguments);
  };
}();