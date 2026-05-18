/* eslint-disable max-lines, max-lines-per-function, complexity, no-await-in-loop, require-unicode-regexp, no-mixed-operators, no-continue, prefer-named-capture-group, no-useless-escape, max-depth, no-empty-function, sort-imports, no-bitwise, no-promise-executor-return, require-await, no-console, no-inner-declarations, no-invalid-this, radix, no-new, no-nested-ternary, no-unused-vars, no-eq-null, no-control-regex */
/**
 * Migration 015 — Backups
 *
 * Creates:
 *   backups            — backup records with metadata and storage info
 *   backup_schedules   — recurring backup schedule configuration
 */

export const up = async (knex) => {
  await knex.schema.createTable('backups', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').references('id').
inTable('organizations').
onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.enu('status', ['pending', 'running', 'complete', 'error']).notNullable().
defaultTo('pending');
    t.enu('storage_type', ['local', 'sftp', 'gdrive']).notNullable().
defaultTo('local');
    t.string('file_path', 500);
    t.bigInteger('file_size');
    t.jsonb('metadata').defaultTo('{}');
    t.text('error_message');
    t.uuid('created_by').references('id').
inTable('users').
onDelete('SET NULL');
    t.timestamp('started_at');
    t.timestamp('finished_at');
    t.timestamps(true, true);
  });

  await knex.schema.table('backups', (t) => {
    t.index(['org_id', 'status']);
    t.index('created_by');
    t.index('created_at');
  });

  await knex.schema.createTable('backup_schedules', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').references('id').
inTable('organizations').
onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.enu('frequency', ['daily', 'weekly', 'monthly']).notNullable().
defaultTo('daily');
    t.string('cron_expression', 100);
    t.enu('storage_type', ['local', 'sftp', 'gdrive']).notNullable().
defaultTo('local');
    t.jsonb('storage_config').defaultTo('{}');
    t.boolean('is_active').notNullable().
defaultTo(true);
    t.uuid('created_by').references('id').
inTable('users').
onDelete('SET NULL');
    t.timestamp('last_run_at');
    t.timestamps(true, true);
  });

  await knex.schema.table('backup_schedules', (t) => {
    t.index(['org_id', 'is_active']);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('backup_schedules');
  await knex.schema.dropTableIfExists('backups');
};