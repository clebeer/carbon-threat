"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.STRIDE_OWASP_MAP = void 0;
/**
 * Static STRIDE → OWASP mappings.
 * Used to enrich rule-generated threats with authoritative references.
 */
var STRIDE_OWASP_MAP = exports.STRIDE_OWASP_MAP = {
  'Spoofing': [{
    type: 'OWASP_TOP10',
    ref: 'A07:2021',
    title: 'Identification and Authentication Failures',
    url: 'https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/'
  }, {
    type: 'CHEAT_SHEET',
    ref: 'Authentication_Cheat_Sheet',
    title: 'Authentication Cheat Sheet',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html'
  }, {
    type: 'CHEAT_SHEET',
    ref: 'Session_Management_Cheat_Sheet',
    title: 'Session Management Cheat Sheet',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html'
  }],
  'Tampering': [{
    type: 'OWASP_TOP10',
    ref: 'A03:2021',
    title: 'Injection',
    url: 'https://owasp.org/Top10/A03_2021-Injection/'
  }, {
    type: 'OWASP_TOP10',
    ref: 'A08:2021',
    title: 'Software and Data Integrity Failures',
    url: 'https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/'
  }, {
    type: 'CHEAT_SHEET',
    ref: 'Input_Validation_Cheat_Sheet',
    title: 'Input Validation Cheat Sheet',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html'
  }, {
    type: 'CHEAT_SHEET',
    ref: 'SQL_Injection_Prevention_Cheat_Sheet',
    title: 'SQL Injection Prevention',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html'
  }],
  'Repudiation': [{
    type: 'OWASP_TOP10',
    ref: 'A09:2021',
    title: 'Security Logging and Monitoring Failures',
    url: 'https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/'
  }, {
    type: 'CHEAT_SHEET',
    ref: 'Logging_Cheat_Sheet',
    title: 'Logging Cheat Sheet',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html'
  }],
  'Information Disclosure': [{
    type: 'OWASP_TOP10',
    ref: 'A02:2021',
    title: 'Cryptographic Failures',
    url: 'https://owasp.org/Top10/A02_2021-Cryptographic_Failures/'
  }, {
    type: 'OWASP_TOP10',
    ref: 'A01:2021',
    title: 'Broken Access Control',
    url: 'https://owasp.org/Top10/A01_2021-Broken_Access_Control/'
  }, {
    type: 'CHEAT_SHEET',
    ref: 'Transport_Layer_Security_Cheat_Sheet',
    title: 'TLS Cheat Sheet',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html'
  }, {
    type: 'CHEAT_SHEET',
    ref: 'Cryptographic_Storage_Cheat_Sheet',
    title: 'Cryptographic Storage Cheat Sheet',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html'
  }],
  'DoS': [{
    type: 'OWASP_TOP10',
    ref: 'A05:2021',
    title: 'Security Misconfiguration',
    url: 'https://owasp.org/Top10/A05_2021-Security_Misconfiguration/'
  }, {
    type: 'CHEAT_SHEET',
    ref: 'Denial_of_Service_Cheat_Sheet',
    title: 'Denial of Service Cheat Sheet',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html'
  }],
  'Elevation of Privilege': [{
    type: 'OWASP_TOP10',
    ref: 'A01:2021',
    title: 'Broken Access Control',
    url: 'https://owasp.org/Top10/A01_2021-Broken_Access_Control/'
  }, {
    type: 'OWASP_TOP10',
    ref: 'A04:2021',
    title: 'Insecure Design',
    url: 'https://owasp.org/Top10/A04_2021-Insecure_Design/'
  }, {
    type: 'CHEAT_SHEET',
    ref: 'Authorization_Cheat_Sheet',
    title: 'Authorization Cheat Sheet',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html'
  }]
};