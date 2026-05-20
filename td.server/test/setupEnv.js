/**
 * Test setup — load .env from project root before any test imports.
 * Added via mocha --require in the test script.
 */
/* eslint-disable unicorn/prefer-module */
const { config } = require('dotenv');
const { resolve } = require('path');

// .env lives in the monorepo root (one level up from td.server)
config({ path: resolve(__dirname, '../../.env') });