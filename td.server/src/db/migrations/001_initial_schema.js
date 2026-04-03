/**
 * Migration 001 — Initial schema
 *
 * Creates:
 *   organizations  — tenant root; all data is scoped to an org
 *   users          — application users with bcrypt-hashed passwords
 *   audit_logs     — immutable record of every write action
 *   app_config     — key/value configuration store (replaces inline CREATE TABLE)
 */

export const up = async (knex) => {
  // ----- organizations -------------------------------------------------------
  await knex.schema.createTable('organizations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('slug', 100).notNullable().unique();
    t.jsonb('settings').defaultTo('{}');
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);   // created_at, updated_at
  });

  // ----- users ---------------------------------------------------------------
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').references('id').inTable('organizations').onDelete('CASCADE');
    t.string('email', 255).notNullable().unique();
    t.string('password_hash', 255);          // null for SSO-only users
    t.string('display_name', 255);
    t.enu('role', ['admin', 'analyst', 'viewer', 'api_key']).notNullable().defaultTo('analyst');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('last_login_at');
    t.timestamps(true, true);
  });

  await knex.schema.table('users', (t) => {
    t.index('email');
    t.index(['org_id', 'is_active']);
  });

  // ----- audit_logs ----------------------------------------------------------
  // Append-only; no UPDATE/DELETE granted to the app role in production.
  await knex.schema.createTable('audit_logs', (t) => {
    t.bigIncrements('id');
    t.uuid('user_id');                       // null for anonymous/system actions
    t.string('action', 100).notNullable();   // e.g. 'CREATE', 'UPDATE', 'DELETE'
    t.string('entity_type', 100);            // e.g. 'threat_model', 'user'
    t.string('entity_id', 255);
    t.jsonb('diff');                         // before/after or request body snapshot
    t.string('ip_address', 45);
    t.integer('http_status');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    // No updated_at — audit rows are immutable
  });

  await knex.schema.table('audit_logs', (t) => {
    t.index(['entity_type', 'entity_id']);
    t.index('user_id');
    t.index('created_at');
  });

  // ----- app_config ----------------------------------------------------------
  // Replaces the inline CREATE TABLE in controllers/config.js
  await knex.schema.createTable('app_config', (t) => {
    t.string('key', 255).primary();
    t.jsonb('value');
    t.timestamps(true, true);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('app_config');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('organizations');
};
