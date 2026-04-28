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
 * Seed 005 — Amazon Web Services domain pack
 * Idempotent: skips if 'aws' pack already exists.
 */

var seed = exports.seed = /*#__PURE__*/function () {
  var _ref = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(knex) {
    var existing, _yield$knex$insert$re, _yield$knex$insert$re2, awsPack;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.next = 1;
          return knex('domain_packs').where({
            slug: 'aws'
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
            slug: 'aws',
            name: 'Amazon Web Services',
            description: 'AWS components: EC2, S3, RDS, Lambda, VPC, CloudFront, ALB, API Gateway, DynamoDB, SQS, SNS, EKS, ElastiCache, WAF, GuardDuty, CloudWatch, IAM',
            icon_manifest: JSON.stringify({
              nodeTypes: {
                'ec2': {
                  label: 'EC2 Instance',
                  svgPath: 'M4 4h16v16H4z M8 8h8v8H8z M8 1v3 M16 1v3 M8 20v3 M16 20v3',
                  color: '#FF9900',
                  viewBox: '0 0 24 24'
                },
                's3': {
                  label: 'S3 Bucket',
                  svgPath: 'M12 2a9 3 0 0 1 9 3v14a9 3 0 0 1-18 0V5a9 3 0 0 1 9-3z M3 5a9 3 0 0 0 18 0 M3 12a9 3 0 0 0 18 0',
                  color: '#3F8624',
                  viewBox: '0 0 24 24'
                },
                'rds': {
                  label: 'RDS Database',
                  svgPath: 'M12 3a10 2.5 0 0 1 10 2.5v13A10 2.5 0 0 1 2 18.5V5.5A10 2.5 0 0 1 12 3z M2 9a10 2.5 0 0 0 20 0 M2 14a10 2.5 0 0 0 20 0',
                  color: '#C925D1',
                  viewBox: '0 0 24 24'
                },
                'lambda': {
                  label: 'Lambda Function',
                  svgPath: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
                  color: '#FF9900',
                  viewBox: '0 0 24 24'
                },
                'vpc': {
                  label: 'VPC',
                  svgPath: 'M3 3h18v18H3z M6 6h12v12H6z',
                  color: '#DD344C',
                  viewBox: '0 0 24 24'
                },
                'cloudfront': {
                  label: 'CloudFront',
                  svgPath: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2c-4 4-4 16 0 20 M12 2c4 4 4 16 0 20',
                  color: '#8C4FFF',
                  viewBox: '0 0 24 24'
                },
                'alb': {
                  label: 'Application LB',
                  svgPath: 'M12 2l8 4v4l-8 4-8-4V6l8-4z M4 14l8 4 8-4 M4 18l8 4 8-4',
                  color: '#8C4FFF',
                  viewBox: '0 0 24 24'
                },
                'api-gw-aws': {
                  label: 'API Gateway',
                  svgPath: 'M2 12h6l3-4 3 8 3-4h5 M20 12l-3-3 M20 12l-3 3',
                  color: '#DD344C',
                  viewBox: '0 0 24 24'
                },
                'dynamodb': {
                  label: 'DynamoDB',
                  svgPath: 'M12 2a9 3 0 0 1 9 3v14a9 3 0 0 1-18 0V5a9 3 0 0 1 9-3z M3 5a9 3 0 0 0 18 0 M3 12a9 3 0 0 0 18 0',
                  color: '#4081D4',
                  viewBox: '0 0 24 24'
                },
                'sqs': {
                  label: 'SQS Queue',
                  svgPath: 'M3 5h4v14H3z M9 5h4v14H9z M15 5h4v14h-4z',
                  color: '#DD344C',
                  viewBox: '0 0 24 24'
                },
                'sns': {
                  label: 'SNS Topic',
                  svgPath: 'M12 2L5 9h4v6h6V9h4L12 2z M5 15h14v5H5z',
                  color: '#DD344C',
                  viewBox: '0 0 24 24'
                },
                'eks': {
                  label: 'EKS Cluster',
                  svgPath: 'M3 3h18v18H3z M7 3v18 M17 3v18 M3 7h18 M3 17h18',
                  color: '#FF9900',
                  viewBox: '0 0 24 24'
                },
                'elasticache': {
                  label: 'ElastiCache',
                  svgPath: 'M12 2a9 3 0 0 1 9 3v14a9 3 0 0 1-18 0V5a9 3 0 0 1 9-3z M12 8v4 M10 10h4',
                  color: '#DD344C',
                  viewBox: '0 0 24 24'
                },
                'waf-aws': {
                  label: 'WAF',
                  svgPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
                  color: '#DD344C',
                  viewBox: '0 0 24 24'
                },
                'guardduty': {
                  label: 'GuardDuty',
                  svgPath: 'M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z M12 8v4 M12 16h0',
                  color: '#DD344C',
                  viewBox: '0 0 24 24'
                },
                'cloudwatch': {
                  label: 'CloudWatch',
                  svgPath: 'M3 3h18v18H3z M7 14l3-5 3 3 4-6',
                  color: '#8C4FFF',
                  viewBox: '0 0 24 24'
                },
                'aws-iam': {
                  label: 'AWS IAM',
                  svgPath: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M4 21v-2a8 8 0 0 1 16 0v2',
                  color: '#DD344C',
                  viewBox: '0 0 24 24'
                },
                'secrets-manager': {
                  label: 'Secrets Manager',
                  svgPath: 'M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z M9 12l2 2 4-4',
                  color: '#DD344C',
                  viewBox: '0 0 24 24'
                }
              }
            }),
            threat_matrix: JSON.stringify({
              'ec2→rds': ['rule-002-unencrypted-db-dataflow'],
              'lambda→rds': ['rule-002-unencrypted-db-dataflow'],
              'eks→sqs': ['rule-001-unauthenticated-cross-boundary'],
              'lambda→s3': ['rule-002-unencrypted-db-dataflow'],
              'cloudfront→alb': ['rule-001-unauthenticated-cross-boundary'],
              'api-gw-aws→lambda': ['rule-001-unauthenticated-cross-boundary']
            }),
            is_builtin: true
          }).returning('id');
        case 3:
          _yield$knex$insert$re = _context.sent;
          _yield$knex$insert$re2 = (0, _slicedToArray2["default"])(_yield$knex$insert$re, 1);
          awsPack = _yield$knex$insert$re2[0];
          _context.next = 4;
          return knex('domain_templates').insert([{
            pack_id: awsPack.id,
            name: 'AWS Serverless API',
            description: 'CloudFront → WAF → ALB → Lambda → DynamoDB / RDS with SQS event queue',
            diagram_json: JSON.stringify({
              nodes: [{
                id: 'a1',
                type: 'cyber',
                position: { x: 300, y: 40 },
                data: { label: 'CloudFront', kind: 'cloudfront' }
              }, {
                id: 'a2',
                type: 'cyber',
                position: { x: 300, y: 160 },
                data: { label: 'WAF', kind: 'waf-aws' }
              }, {
                id: 'a3',
                type: 'cyber',
                position: { x: 300, y: 280 },
                data: { label: 'ALB', kind: 'alb' }
              }, {
                id: 'a4',
                type: 'cyber',
                position: { x: 300, y: 400 },
                data: { label: 'Lambda', kind: 'lambda' }
              }, {
                id: 'a5',
                type: 'cyber',
                position: { x: 150, y: 530 },
                data: { label: 'DynamoDB', kind: 'dynamodb' }
              }, {
                id: 'a6',
                type: 'cyber',
                position: { x: 450, y: 530 },
                data: { label: 'RDS', kind: 'rds' }
              }, {
                id: 'a7',
                type: 'cyber',
                position: { x: 500, y: 280 },
                data: { label: 'SQS', kind: 'sqs' }
              }, {
                id: 'a8',
                type: 'cyber',
                position: { x: 150, y: 280 },
                data: { label: 'IAM', kind: 'aws-iam' }
              }],
              edges: [{
                id: 'ae1',
                source: 'a1',
                target: 'a2',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#8C4FFF', strokeWidth: 2 }
              }, {
                id: 'ae2',
                source: 'a2',
                target: 'a3',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#DD344C', strokeWidth: 2 }
              }, {
                id: 'ae3',
                source: 'a3',
                target: 'a4',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#FF9900', strokeWidth: 2 }
              }, {
                id: 'ae4',
                source: 'a4',
                target: 'a5',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#4081D4', strokeWidth: 2 }
              }, {
                id: 'ae5',
                source: 'a4',
                target: 'a6',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#C925D1', strokeWidth: 2 }
              }, {
                id: 'ae6',
                source: 'a7',
                target: 'a4',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#DD344C', strokeWidth: 2 }
              }, {
                id: 'ae7',
                source: 'a8',
                target: 'a3',
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#DD344C', strokeWidth: 2 }
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