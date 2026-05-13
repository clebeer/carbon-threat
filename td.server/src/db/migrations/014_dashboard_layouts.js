/**
 * Migration 014 — Dashboard Layouts
 *
 * Creates:
 *   dashboard_layouts  — per-user customizable dashboard widget layout
 */

export const up = async (knex) => {
  await knex.schema.createTable('dashboard_layouts', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').references('id').
inTable('users').
onDelete('CASCADE').
notNullable().
unique();
    t.jsonb('layout_config').notNullable().
defaultTo('[]');
    t.timestamp('updated_at').notNullable().
defaultTo(knex.fn.now());
  });

  await knex.schema.table('dashboard_layouts', (t) => {
    t.index('user_id');
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('dashboard_layouts');
};