/* eslint-disable max-lines, max-lines-per-function, complexity, no-await-in-loop, require-unicode-regexp, no-mixed-operators, no-continue, prefer-named-capture-group, no-useless-escape, max-depth, no-empty-function, sort-imports, no-bitwise, no-promise-executor-return, require-await, no-console, no-inner-declarations, no-invalid-this, radix, no-new, no-nested-ternary, no-unused-vars, no-eq-null */
import knex from './knex.js';
import loggerHelper from '../helpers/logger.helper.js';
import path from 'path';
import { upDir } from '../helpers/path.helper.js';

const logger = loggerHelper.get('db/seed.js');

/**
 * Run all domain-pack seed files from db/seeds/.
 *
 * Each seed exports an async `seed(knex)` function that upserts
 * domain packs and templates.  Uses ON CONFLICT DO UPDATE so the
 * seeds are idempotent — safe to re-run on every startup.
 *
 * Seed files are loaded from the compiled `db/seeds/` directory
 * (babel output), NOT from `src/db/seeds/`.
 */
export async function runSeeds() {
  logger.info('Running database seeds...');

  try {
    // Resolve seed directory relative to this compiled file.
    // In dist/db/seed.js, __dirname is dist/db/, so we go up two levels to td.server/
    // then into db/seeds/.
    // In src/db/seed.js (babel-node dev), __dirname is src/db/, so we go up two levels
    // to td.server/ then into db/seeds/.
    const seedDir = path.join(__dirname, upDir, upDir, 'db', 'seeds');

    const fs = await import('fs');

    let files = [];
    try {
      files = (await fs.promises.readdir(seedDir)).
        filter((f) => f.endsWith('.js')).
        sort();
    } catch {
      logger.info('No seed directory found — skipping seeds');
      return;
    }

    if (files.length === 0) {
      logger.info('No seed files found — skipping');
      return;
    }

    for (const file of files) {
      const filePath = path.join(seedDir, file);
      // Use require() for CJS seed files (already compiled by babel)
      let mod;
      try {
        mod = await import(filePath);
      } catch {
        // Fallback: try require for CJS compatibility
        mod = require(filePath);
      }
      const seedFn = mod.seed || mod.default?.seed;
      if (typeof seedFn === 'function') {
        logger.info(`Running seed: ${file}`);
        await seedFn(knex);
      } else {
        logger.warn(`Skipping ${file} — no exported \`seed(knex)\` function`);
      }
    }

    logger.info(`Completed ${files.length} seed(s)`);
  } catch (err) {
    logger.warn(`Seed runner encountered an error: ${err.message}`);
    // Don't throw — seeds are non-critical; the app can still start
  }
}