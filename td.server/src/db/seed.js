import knex from './knex.js';
import loggerHelper from '../helpers/logger.helper.js';

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
    // Dynamically import all seed files from db/seeds/
    const seedDir = new URL('../../db/seeds/', import.meta.url);

    // Use fs to list seed files
    const fs = await import('fs');
    const path = await import('path');

    let files = [];
    try {
      files = (await fs.promises.readdir(seedDir))
        .filter((f) => f.endsWith('.js'))
        .sort();
    } catch {
      logger.info('No seed directory found — skipping seeds');
      return;
    }

    if (files.length === 0) {
      logger.info('No seed files found — skipping');
      return;
    }

    for (const file of files) {
      const mod = await import(path.join(seedDir.href, file));
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