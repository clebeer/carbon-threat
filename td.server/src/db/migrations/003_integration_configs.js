/**
 * Migration 003 — Integration configurations
 *
 * Stores encrypted credentials for third-party integrations
 * (GitHub, Jira, ServiceNow, OpenAI, Ollama).
 *
 * The `config_encrypted` column holds the AES-256-GCM ciphertext
 * produced by encryption.js — secrets never appear in plaintext in the DB.
 *
 * One row per platform per org.
 */
export function up(knex) {
  return knex.schema.createTable('integration_configs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').references('id').inTable('organizations').onDelete('CASCADE').nullable();

    // Platform identifier — must match the switch cases in third-party.js
    t.string('platform', 40).notNullable();

    // AES-256-GCM payload: JSON-serialised { iv, encryptedData, authTag }
    t.text('config_encrypted').notNullable();

    t.boolean('is_enabled').notNullable().defaultTo(false);

    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.unique(['org_id', 'platform']);
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('integration_configs');
}
