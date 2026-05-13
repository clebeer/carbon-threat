/**
 * Migration 013 — Asset Library
 *
 * Creates:
 *   asset_library  — user-imported assets (JSON/CSV batch import)
 */

export const up = async (knex) => {
  await knex.schema.createTable('asset_library', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').references('id').
inTable('organizations').
onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.string('kind', 100).notNullable().
defaultTo('server');
    t.text('description');
    t.jsonb('properties').defaultTo('{}');
    t.uuid('created_by').references('id').
inTable('users').
onDelete('SET NULL');
    t.timestamps(true, true);
  });

  await knex.schema.table('asset_library', (t) => {
    t.index(['org_id', 'kind']);
    t.index('created_by');
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('asset_library');
};