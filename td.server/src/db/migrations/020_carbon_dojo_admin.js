/**
 * Migration 020 — Carbon Dojo connectors & admin
 *
 *   connectors            — Jira integration (token stored encrypted, write-only)
 *   service_accounts      — machine identities (org-scoped, never global by default)
 *   api_keys              — hashed bearer tokens for a service account
 *   identity_providers    — OIDC/SAML providers (secrets encrypted)
 *   idp_role_mappings     — group → role slug mappings
 *   notification_channels — SMTP / Teams delivery
 *   policies              — SLA per severity + data retention
 *
 * Secrets live in `*_ciphertext` columns (AES-256-GCM) and are never returned by the
 * API — callers see only a boolean "set/unset" (ADR 0001, Decision 5).
 */

export async function up(knex) {
  await knex.schema.createTable('connectors', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().
references('id').
inTable('organizations').
onDelete('CASCADE');
    t.string('type', 32).notNullable().
defaultTo('jira');
    t.string('name', 255).notNullable();
    // 'cloud' | 'data center'
    t.string('edition', 32).notNullable().
defaultTo('cloud');
    t.string('base_url', 512).notNullable();
    t.string('email', 320);
    // Encrypted API token — write-only; API exposes only secret_set.
    t.text('secret_ciphertext');
    t.string('project_key', 64);
    t.string('issue_type', 64).defaultTo('Task');
    // 'enabled' | 'disabled'
    t.string('status', 16).notNullable().
defaultTo('enabled');
    t.uuid('created_by').references('id').
inTable('users').
onDelete('SET NULL');
    t.timestamps(true, true);
    t.index('org_id', 'idx_connectors_org_id');
  });

  await knex.schema.createTable('service_accounts', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    // org_id is NOT NULL: service accounts are always tenant-scoped, never global.
    t.uuid('org_id').notNullable().
references('id').
inTable('organizations').
onDelete('CASCADE');
    t.string('name', 255).notNullable();
    // Explicit permission scopes (least privilege) — evaluated before any grant check.
    t.jsonb('scopes').notNullable().
defaultTo('[]');
    t.boolean('is_active').notNullable().
defaultTo(true);
    t.timestamps(true, true);
    t.index('org_id', 'idx_service_accounts_org_id');
  });

  await knex.schema.createTable('api_keys', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('service_account_id').notNullable().
references('id').
inTable('service_accounts').
onDelete('CASCADE');
    // Only a hash of the token is stored; the plaintext is shown once at creation.
    t.string('token_hash', 128).notNullable();
    t.string('prefix', 16).notNullable();
    t.timestamp('last_used_at');
    t.timestamp('revoked_at');
    t.timestamp('created_at').notNullable().
defaultTo(knex.fn.now());
    t.index('service_account_id', 'idx_api_keys_service_account_id');
    t.index('prefix', 'idx_api_keys_prefix');
  });

  await knex.schema.createTable('identity_providers', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().
references('id').
inTable('organizations').
onDelete('CASCADE');
    // 'oidc' | 'saml'
    t.string('kind', 16).notNullable();
    t.string('name', 255).notNullable();
    t.jsonb('config').notNullable().
defaultTo('{}');
    // Encrypted client secret / signing material — write-only.
    t.text('secret_ciphertext');
    t.boolean('is_active').notNullable().
defaultTo(true);
    t.timestamps(true, true);
    t.index('org_id', 'idx_identity_providers_org_id');
  });

  await knex.schema.createTable('idp_role_mappings', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('identity_provider_id').notNullable().
references('id').
inTable('identity_providers').
onDelete('CASCADE');
    t.string('group_name', 255).notNullable();
    t.string('role_slug', 50).notNullable();
    t.unique(['identity_provider_id', 'group_name']);
    t.index('identity_provider_id', 'idx_idp_role_mappings_idp_id');
  });

  await knex.schema.createTable('notification_channels', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().
references('id').
inTable('organizations').
onDelete('CASCADE');
    // 'smtp' | 'teams'
    t.string('kind', 16).notNullable();
    t.string('name', 255).notNullable();
    t.jsonb('config').notNullable().
defaultTo('{}');
    // Encrypted webhook secret — fail-closed when unset (ADR 0001).
    t.text('secret_ciphertext');
    t.boolean('is_active').notNullable().
defaultTo(true);
    t.timestamps(true, true);
    t.index('org_id', 'idx_notification_channels_org_id');
  });

  await knex.schema.createTable('policies', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().
references('id').
inTable('organizations').
onDelete('CASCADE');
    // 'sla' | 'retention'
    t.string('kind', 16).notNullable();
    // e.g. 'critical' | 'high' | 'audit_days' | 'session_days'
    t.string('key', 64).notNullable();
    t.jsonb('value').notNullable().
defaultTo('{}');
    t.timestamps(true, true);
    t.unique(['org_id', 'kind', 'key']);
    t.index('org_id', 'idx_policies_org_id');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('policies');
  await knex.schema.dropTableIfExists('notification_channels');
  await knex.schema.dropTableIfExists('idp_role_mappings');
  await knex.schema.dropTableIfExists('identity_providers');
  await knex.schema.dropTableIfExists('api_keys');
  await knex.schema.dropTableIfExists('service_accounts');
  await knex.schema.dropTableIfExists('connectors');
}
