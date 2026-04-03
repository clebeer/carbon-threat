/**
 * Migration 004 — Refresh token persistence
 *
 * Moves refresh token storage from the in-memory array in repositories/token.js
 * to a proper database table so tokens survive server restarts.
 *
 * The `token` column is the raw JWT string (≤ 2048 chars).
 * Expired rows are cleaned up opportunistically on every verify() call.
 */

export const up = async (knex) => {
  await knex.schema.createTable('refresh_tokens', (t) => {
    t.string('token', 2048).primary();
    t.timestamp('expires_at').notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.table('refresh_tokens', (t) => {
    t.index('expires_at');
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('refresh_tokens');
};
