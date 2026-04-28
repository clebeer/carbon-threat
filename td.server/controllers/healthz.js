"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
// health-check endpoint for applications

var healthz = function healthz(req, res) {
  var data = {
    uptime: process.uptime(),
    message: 'OK',
    date: new Date()
  };
  return res.status(200).send(data);
};
var _default = exports["default"] = {
  healthz: healthz
};