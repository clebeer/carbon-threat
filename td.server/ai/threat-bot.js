"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.suggestThreats = suggestThreats;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _axios = _interopRequireDefault(require("axios"));
var _pgConfig = require("../config/pg.config.js");
function suggestThreats(_x) {
  return _suggestThreats.apply(this, arguments);
}
function _suggestThreats() {
  _suggestThreats = (0, _asyncToGenerator2["default"])(/*#__PURE__*/_regenerator["default"].mark(function _callee(nodeData) {
    var _result$rows$, result, providerConfig, prompt, url, response, rawContent, jsonStr, _response, _t;
    return _regenerator["default"].wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 1;
          return (0, _pgConfig.query)("SELECT value FROM app_config WHERE key = 'llm_provider'");
        case 1:
          result = _context.sent;
          providerConfig = ((_result$rows$ = result.rows[0]) === null || _result$rows$ === void 0 ? void 0 : _result$rows$.value) || {
            provider: 'openai'
          };
          prompt = "\n      Analyze the following architecture component and suggest potential STRIDE threats:\n      Component Name: ".concat(nodeData.label, "\n      Component Type: ").concat(nodeData.type || 'Custom', "\n  \n      Ensure output is valid JSON formatting an array of objects: \n      { \"title\": string, \"severity\": \"High\"|\"Medium\"|\"Low\", \"mitigation\": string, \"strideCategory\": string }\n    ");
          if (!(providerConfig.provider === 'local')) {
            _context.next = 3;
            break;
          }
          // LM Studio or Ollama (OpenAI compatible endpoint schema)
          url = providerConfig.url || 'http://localhost:1234/v1/chat/completions';
          _context.next = 2;
          return _axios["default"].post(url, {
            model: providerConfig.model || 'local-model',
            messages: [{
              role: 'user',
              content: prompt
            }],
            temperature: 0.2
          });
        case 2:
          response = _context.sent;
          // Extract from markdown if local model ignores format
          rawContent = response.data.choices[0].message.content;
          jsonStr = rawContent.replace(/```json|```/g, '').trim();
          return _context.abrupt("return", JSON.parse(jsonStr));
        case 3:
          _context.next = 4;
          return _axios["default"].post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4-turbo-preview',
            response_format: {
              type: "json_object"
            },
            messages: [{
              role: 'system',
              content: 'You are a cybersecurity expert.'
            }, {
              role: 'user',
              content: prompt
            }]
          }, {
            headers: {
              Authorization: "Bearer ".concat(process.env.OPENAI_API_KEY)
            }
          });
        case 4:
          _response = _context.sent;
          return _context.abrupt("return", JSON.parse(_response.data.choices[0].message.content));
        case 5:
          _context.next = 7;
          break;
        case 6:
          _context.prev = 6;
          _t = _context["catch"](0);
          console.error('Threat Bot AI Failed:', _t);
          return _context.abrupt("return", []);
        case 7:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[0, 6]]);
  }));
  return _suggestThreats.apply(this, arguments);
}