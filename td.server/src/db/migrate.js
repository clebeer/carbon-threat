import knex from './knex.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('db/migrate.js');

/**
 * Runs all pending Knex migrations.
 * Called once at application startup before the HTTP server begins accepting requests.
 * Throws on failure so the process exits rather than serving with a broken schema.
 */
export async function runMigrations() {
  logger.info('Running database migrations...');

  const [batch, migrations] = await knex.migrate.latest();

  if (migrations.length === 0) {
    logger.info('Database schema is up to date — no migrations needed');
  } else {
    logger.info(
      `Batch ${batch}: applied ${migrations.length} migration(s): ` +
      migrations.join(', ')
    );
  }
}

/**
 * Destroys the Knex connection pool.
 * Call during graceful shutdown after the HTTP server has closed.
 */
export async function destroyDb() {
  await knex.destroy();
}
