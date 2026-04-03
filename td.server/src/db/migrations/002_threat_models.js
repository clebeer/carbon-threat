/**
 * Migration 002 — Threat models table
 *
 * Stores encrypted threat model JSON blobs in PostgreSQL.
 * content_encrypted contains the AES-256-GCM output from security/encryption.js.
 * The original file-based (GitHub/GitLab/Bitbucket/Google Drive) storage
 * is preserved and still functional — this table is additive.
 */

export const up = async (knex) => {
  await knex.schema.createTable('threat_models', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('owner_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.string('title', 255).notNullable();
    t.text('description');
    // Encrypted payload: { iv, encryptedData, authTag } serialised as JSON text
    t.text('content_encrypted').notNullable();
    t.integer('version').notNullable().defaultTo(1);
    t.boolean('is_archived').notNullable().defaultTo(false);
    t.timestamps(true, true);
  });

  await knex.schema.table('threat_models', (t) => {
    t.index(['org_id', 'is_archived']);
    t.index('owner_id');
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('threat_models');
};
