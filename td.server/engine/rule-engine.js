"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generateThreats = generateThreats;
var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));
var _owaspMappings = require("./owasp-mappings.js");
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; } /**
 * Rule-based STRIDE threat generator for CarbonThreat.
 *
 * Each rule is a pure function: evaluate(nodes, edges) → ThreatCandidate[].
 * Nodes have: { id, data: { kind, label, ...attrs } }
 * Edges have: { id, source, target, data?: { authenticated, encrypted, protocol } }
 */
function nodeById(nodes, id) {
  return nodes.find(function (n) {
    return n.id === id;
  });
}
var EXTERNAL_KINDS = new Set(['user', 'browser']);
var INTERNAL_KINDS = new Set(['server', 'db', 'api', 'cloud']);
function makeThreat(ruleId, nodeIds, edgeIds, strideCategory, severity, title, description, mitigation) {
  return {
    rule_id: ruleId,
    node_ids: nodeIds,
    edge_ids: edgeIds,
    stride_category: strideCategory,
    severity: severity,
    title: title,
    description: description,
    mitigation: mitigation,
    owasp_refs: _owaspMappings.STRIDE_OWASP_MAP[strideCategory] || [],
    source: 'rule'
  };
}
var RULES = [{
  id: 'rule-001-unauthenticated-cross-boundary',
  evaluate: function evaluate(nodes, edges) {
    var results = [];
    var _iterator = _createForOfIteratorHelper(edges),
      _step;
    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var _src$data, _tgt$data, _edge$data, _edge$data2, _edge$data3, _edge$data4;
        var edge = _step.value;
        var src = nodeById(nodes, edge.source);
        var tgt = nodeById(nodes, edge.target);
        if (!src || !tgt) continue;
        var crossesBoundary = EXTERNAL_KINDS.has((_src$data = src.data) === null || _src$data === void 0 ? void 0 : _src$data.kind) && INTERNAL_KINDS.has((_tgt$data = tgt.data) === null || _tgt$data === void 0 ? void 0 : _tgt$data.kind);
        if (!crossesBoundary) continue;
        var isAuthed = ((_edge$data = edge.data) === null || _edge$data === void 0 ? void 0 : _edge$data.authenticated) || ((_edge$data2 = edge.data) === null || _edge$data2 === void 0 ? void 0 : _edge$data2.auth);
        if (!isAuthed && isFalse((_edge$data3 = edge.data) === null || _edge$data3 === void 0 ? void 0 : _edge$data3.authenticated) === false && ((_edge$data4 = edge.data) === null || _edge$data4 === void 0 ? void 0 : _edge$data4.authenticated) === undefined) {
          var _src$data2, _tgt$data2, _src$data3, _tgt$data3;
          results.push(makeThreat('rule-001', [src.id, tgt.id], [edge.id], 'Spoofing', 'High', "Unauthenticated data flow: ".concat((_src$data2 = src.data) === null || _src$data2 === void 0 ? void 0 : _src$data2.label, " \u2192 ").concat((_tgt$data2 = tgt.data) === null || _tgt$data2 === void 0 ? void 0 : _tgt$data2.label), "Data flow from ".concat((_src$data3 = src.data) === null || _src$data3 === void 0 ? void 0 : _src$data3.label, " to ").concat((_tgt$data3 = tgt.data) === null || _tgt$data3 === void 0 ? void 0 : _tgt$data3.label, " crosses a trust boundary without authentication configured."), 'Implement mutual authentication (e.g., OAuth 2.0, mTLS) on this data flow.'));
        }
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
    return results;
  }
}, {
  id: 'rule-002-unencrypted-db-dataflow',
  evaluate: function evaluate(nodes, edges) {
    var results = [];
    var _iterator2 = _createForOfIteratorHelper(edges),
      _step2;
    try {
      for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
        var _tgt$data4, _edge$data5;
        var edge = _step2.value;
        var tgt = nodeById(nodes, edge.target);
        if (!tgt || ((_tgt$data4 = tgt.data) === null || _tgt$data4 === void 0 ? void 0 : _tgt$data4.kind) !== 'db') continue;
        var isEncrypted = (_edge$data5 = edge.data) === null || _edge$data5 === void 0 ? void 0 : _edge$data5.encrypted;
        if (!isEncrypted) {
          var _src$data$label, _src$data4, _tgt$data5, _tgt$data6;
          var src = nodeById(nodes, edge.source);
          results.push(makeThreat('rule-002', [tgt.id].concat((0, _toConsumableArray2["default"])(src ? [src.id] : [])), [edge.id], 'Information Disclosure', 'High', "Unencrypted data flow to database: ".concat((_src$data$label = src === null || src === void 0 || (_src$data4 = src.data) === null || _src$data4 === void 0 ? void 0 : _src$data4.label) !== null && _src$data$label !== void 0 ? _src$data$label : edge.source, " \u2192 ").concat((_tgt$data5 = tgt.data) === null || _tgt$data5 === void 0 ? void 0 : _tgt$data5.label), "Data transmitted to the database (".concat((_tgt$data6 = tgt.data) === null || _tgt$data6 === void 0 ? void 0 : _tgt$data6.label, ") may not be encrypted in transit."), 'Enable TLS/SSL on the database connection. Use encrypted connection strings.'));
        }
      }
    } catch (err) {
      _iterator2.e(err);
    } finally {
      _iterator2.f();
    }
    return results;
  }
}, {
  id: 'rule-003-direct-external-to-db',
  evaluate: function evaluate(nodes, edges) {
    var results = [];
    var dbNodes = nodes.filter(function (n) {
      var _n$data;
      return ((_n$data = n.data) === null || _n$data === void 0 ? void 0 : _n$data.kind) === 'db';
    });
    var _iterator3 = _createForOfIteratorHelper(dbNodes),
      _step3;
    try {
      var _loop = function _loop() {
        var db = _step3.value;
        var incomingEdges = edges.filter(function (e) {
          return e.target === db.id;
        });
        var _iterator4 = _createForOfIteratorHelper(incomingEdges),
          _step4;
        try {
          for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
            var _src$data5;
            var edge = _step4.value;
            var src = nodeById(nodes, edge.source);
            if (!src) continue;
            if (EXTERNAL_KINDS.has((_src$data5 = src.data) === null || _src$data5 === void 0 ? void 0 : _src$data5.kind)) {
              var _src$data6, _db$data, _src$data7, _db$data2;
              results.push(makeThreat('rule-003', [src.id, db.id], [edge.id], 'Elevation of Privilege', 'Critical', "External actor direct database access: ".concat((_src$data6 = src.data) === null || _src$data6 === void 0 ? void 0 : _src$data6.label, " \u2192 ").concat((_db$data = db.data) === null || _db$data === void 0 ? void 0 : _db$data.label), "External actor (".concat((_src$data7 = src.data) === null || _src$data7 === void 0 ? void 0 : _src$data7.label, ") has a direct data flow to the database (").concat((_db$data2 = db.data) === null || _db$data2 === void 0 ? void 0 : _db$data2.label, ") without an intermediary server or API gateway."), 'Place an API layer or server between external actors and the database. Never expose the database directly to external actors.'));
            }
          }
        } catch (err) {
          _iterator4.e(err);
        } finally {
          _iterator4.f();
        }
      };
      for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
        _loop();
      }
    } catch (err) {
      _iterator3.e(err);
    } finally {
      _iterator3.f();
    }
    return results;
  }
}, {
  id: 'rule-004-server-no-logging',
  evaluate: function evaluate(nodes) {
    var results = [];
    var _iterator5 = _createForOfIteratorHelper(nodes),
      _step5;
    try {
      for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
        var _node$data, _node$data2, _node$data3, _node$data4;
        var node = _step5.value;
        if (((_node$data = node.data) === null || _node$data === void 0 ? void 0 : _node$data.kind) !== 'server' && ((_node$data2 = node.data) === null || _node$data2 === void 0 ? void 0 : _node$data2.kind) !== 'api') continue;
        if (!((_node$data3 = node.data) !== null && _node$data3 !== void 0 && _node$data3.logging) && ((_node$data4 = node.data) === null || _node$data4 === void 0 ? void 0 : _node$data4.logging) !== true) {
          var _node$data5, _node$data6;
          results.push(makeThreat('rule-004', [node.id], [], 'Repudiation', 'Medium', "Missing audit logging: ".concat((_node$data5 = node.data) === null || _node$data5 === void 0 ? void 0 : _node$data5.label), "Component \"".concat((_node$data6 = node.data) === null || _node$data6 === void 0 ? void 0 : _node$data6.label, "\" has no logging attribute configured, making it difficult to audit operations."), 'Enable structured logging with request IDs, timestamps, and user identifiers. Forward logs to a SIEM.'));
        }
      }
    } catch (err) {
      _iterator5.e(err);
    } finally {
      _iterator5.f();
    }
    return results;
  }
}, {
  id: 'rule-005-public-cloud-no-ratelimit',
  evaluate: function evaluate(nodes) {
    var results = [];
    var _iterator6 = _createForOfIteratorHelper(nodes),
      _step6;
    try {
      for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
        var _node$data7, _node$data8, _node$data9, _node$data0;
        var node = _step6.value;
        if (((_node$data7 = node.data) === null || _node$data7 === void 0 ? void 0 : _node$data7.kind) !== 'cloud' && ((_node$data8 = node.data) === null || _node$data8 === void 0 ? void 0 : _node$data8.kind) !== 'api') continue;
        if (((_node$data9 = node.data) === null || _node$data9 === void 0 ? void 0 : _node$data9["public"]) === true || ((_node$data0 = node.data) === null || _node$data0 === void 0 ? void 0 : _node$data0["public"]) === 'true') {
          var _node$data1, _node$data10;
          if (!((_node$data1 = node.data) !== null && _node$data1 !== void 0 && _node$data1.rateLimit) && !((_node$data10 = node.data) !== null && _node$data10 !== void 0 && _node$data10.rate_limit)) {
            var _node$data11, _node$data12;
            results.push(makeThreat('rule-005', [node.id], [], 'DoS', 'High', "Public endpoint without rate limiting: ".concat((_node$data11 = node.data) === null || _node$data11 === void 0 ? void 0 : _node$data11.label), "Component \"".concat((_node$data12 = node.data) === null || _node$data12 === void 0 ? void 0 : _node$data12.label, "\" is marked as public but has no rate limiting configured."), 'Implement rate limiting (e.g., API Gateway throttling, nginx rate_limit). Consider WAF in front of public endpoints.'));
          }
        }
      }
    } catch (err) {
      _iterator6.e(err);
    } finally {
      _iterator6.f();
    }
    return results;
  }
}, {
  id: 'rule-006-fw-bypassed',
  evaluate: function evaluate(nodes, edges) {
    var results = [];
    var fwNodes = nodes.filter(function (n) {
      var _n$data2;
      return ((_n$data2 = n.data) === null || _n$data2 === void 0 ? void 0 : _n$data2.kind) === 'fw';
    });
    if (fwNodes.length === 0) return results;
    var _iterator7 = _createForOfIteratorHelper(edges),
      _step7;
    try {
      var _loop2 = function _loop2() {
        var _src$data8, _tgt$data7, _tgt$data8;
        var edge = _step7.value;
        var src = nodeById(nodes, edge.source);
        var tgt = nodeById(nodes, edge.target);
        if (!src || !tgt) return 1; // continue
        if (EXTERNAL_KINDS.has((_src$data8 = src.data) === null || _src$data8 === void 0 ? void 0 : _src$data8.kind) && INTERNAL_KINDS.has((_tgt$data7 = tgt.data) === null || _tgt$data7 === void 0 ? void 0 : _tgt$data7.kind) && ((_tgt$data8 = tgt.data) === null || _tgt$data8 === void 0 ? void 0 : _tgt$data8.kind) !== 'db') {
          var hasFwPath = edges.some(function (e) {
            var _mid$data;
            if (e.source !== src.id) return false;
            var mid = nodeById(nodes, e.target);
            if (!mid || ((_mid$data = mid.data) === null || _mid$data === void 0 ? void 0 : _mid$data.kind) !== 'fw') return false;
            return edges.some(function (e2) {
              return e2.source === mid.id && e2.target === tgt.id;
            });
          });
          if (!hasFwPath) {
            var _src$data9, _tgt$data9, _src$data0, _tgt$data0;
            results.push(makeThreat('rule-006', [src.id, tgt.id], [edge.id], 'Tampering', 'Medium', "Firewall bypass possible: ".concat((_src$data9 = src.data) === null || _src$data9 === void 0 ? void 0 : _src$data9.label, " \u2192 ").concat((_tgt$data9 = tgt.data) === null || _tgt$data9 === void 0 ? void 0 : _tgt$data9.label), "Direct connection from ".concat((_src$data0 = src.data) === null || _src$data0 === void 0 ? void 0 : _src$data0.label, " to ").concat((_tgt$data0 = tgt.data) === null || _tgt$data0 === void 0 ? void 0 : _tgt$data0.label, " bypasses existing firewall(s) in the diagram."), 'Route all external traffic through the firewall. Remove direct connections that bypass security controls.'));
          }
        }
      };
      for (_iterator7.s(); !(_step7 = _iterator7.n()).done;) {
        if (_loop2()) continue;
      }
    } catch (err) {
      _iterator7.e(err);
    } finally {
      _iterator7.f();
    }
    return results;
  }
}, {
  id: 'rule-007-sensitive-data-no-encryption',
  evaluate: function evaluate(nodes, edges) {
    var results = [];
    var _iterator8 = _createForOfIteratorHelper(edges),
      _step8;
    try {
      for (_iterator8.s(); !(_step8 = _iterator8.n()).done;) {
        var edge = _step8.value;
        var data = edge.data || {};
        if (data.sensitive === true && !data.encrypted) {
          var _src$data$label2, _src$data1, _tgt$data$label, _tgt$data1;
          var src = nodeById(nodes, edge.source);
          var tgt = nodeById(nodes, edge.target);
          results.push(makeThreat('rule-007', [src === null || src === void 0 ? void 0 : src.id, tgt === null || tgt === void 0 ? void 0 : tgt.id].filter(Boolean), [edge.id], 'Information Disclosure', 'Critical', "Sensitive data in transit without encryption: ".concat((_src$data$label2 = src === null || src === void 0 || (_src$data1 = src.data) === null || _src$data1 === void 0 ? void 0 : _src$data1.label) !== null && _src$data$label2 !== void 0 ? _src$data$label2 : '?', " \u2192 ").concat((_tgt$data$label = tgt === null || tgt === void 0 || (_tgt$data1 = tgt.data) === null || _tgt$data1 === void 0 ? void 0 : _tgt$data1.label) !== null && _tgt$data$label !== void 0 ? _tgt$data$label : '?'), "This data flow is marked as carrying sensitive data but encryption is not enabled.", 'Enable TLS 1.3 minimum. Consider end-to-end encryption for PII or regulated data.'));
        }
      }
    } catch (err) {
      _iterator8.e(err);
    } finally {
      _iterator8.f();
    }
    return results;
  }
}];
function isFalse(val) {
  return val === false || val === 'false' || val === 0;
}
function generateThreats(nodes, edges) {
  var results = [];
  var seen = new Set();
  var _iterator9 = _createForOfIteratorHelper(RULES),
    _step9;
  try {
    for (_iterator9.s(); !(_step9 = _iterator9.n()).done;) {
      var rule = _step9.value;
      try {
        var threats = rule.evaluate(nodes || [], edges || []);
        var _iterator0 = _createForOfIteratorHelper(threats),
          _step0;
        try {
          for (_iterator0.s(); !(_step0 = _iterator0.n()).done;) {
            var t = _step0.value;
            var key = "".concat(t.rule_id, ":").concat(t.node_ids.sort().join(','));
            if (!seen.has(key)) {
              seen.add(key);
              results.push(t);
            }
          }
        } catch (err) {
          _iterator0.e(err);
        } finally {
          _iterator0.f();
        }
      } catch (_unused) {
        // individual rule failure should not abort the entire analysis
      }
    }
  } catch (err) {
    _iterator9.e(err);
  } finally {
    _iterator9.f();
  }
  return results;
}