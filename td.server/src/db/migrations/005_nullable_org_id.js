/**
 * Migration 005 — Make org_id and content_encrypted nullable on threat_models
 *
 * org_id can be null for users not belonging to an organization (local/standalone mode).
 * content_encrypted defaults to empty string when a model has no saved content yet.
 *
 * This formalises the DDL change applied directly in production on 2026-04-01.
 */

export const up = async (knex) => {
  await knex.schema.alterTable('threat_models', (t) => {
    t.uuid('org_id').nullable().alter();
    t.text('content_encrypted').nullable().defaultTo('').alter();
  });
};

export const down = async (knex) => {
  // Reversing: set org_id back to NOT NULL requires all rows to have a value
  // This migration is intentionally irreversible in practice — only reverse on a clean DB
  await knex.schema.alterTable('threat_models', (t) => {
    t.uuid('org_id').notNullable().alter();
  });
};
