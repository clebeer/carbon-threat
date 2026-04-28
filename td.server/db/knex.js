"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _knex = _interopRequireDefault(require("knex"));
var _path = _interopRequireDefault(require("path"));
var _pathHelper = require("../helpers/path.helper.js");
/**
 * Resolves the database connection from environment variables.
 *
 * Priority:
 *   1. DATABASE_URL  — single connection string (Railway, Fly.io, Heroku, Docker Compose)
 *   2. DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME  — individual vars
 *
 * Neither fallback provides defaults for credentials — the server will fail
 * fast at startup if neither form is configured.
 */
function resolveConnection() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'carbonthreat'
  };
}
var knex = (0, _knex["default"])({
  client: 'postgresql',
  connection: resolveConnection(),
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    directory: _path["default"].join(__dirname, 'migrations'),
    tableName: 'knex_migrations'
  }
});
var _default = exports["default"] = knex;