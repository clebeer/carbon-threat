/**
 * Migration 018 — Carbon Dojo core hierarchy
 *
 * Vulnerability-management domain (SDD Phase 1):
 *   Organization → BusinessUnit → Product → Engagement → Assessment
 *
 * Every tenant-scoped table carries a non-null `org_id` (denormalized down the
 * hierarchy) so reads/writes can be scoped with a single predicate and never fall
 * back to "Global" (see ADR 0001, Decision 3). Also adds users.org_id.
 */

export async function up(knex) {
  // ── organizations ──────────────────────────────────────────────────────────
  await knex.schema.createTable('organizations', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('slug', 100).notNullable().
unique();
    t.timestamps(true, true);
  });

  // ── business_units ─────────────────────────────────────────────────────────
  await knex.schema.createTable('business_units', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().
references('id').
inTable('organizations').
onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.timestamps(true, true);
    t.index('org_id', 'idx_business_units_org_id');
  });

  // ── products (assets) ──────────────────────────────────────────────────────
  await knex.schema.createTable('products', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().
references('id').
inTable('organizations').
onDelete('CASCADE');
    t.uuid('business_unit_id').notNullable().
references('id').
inTable('business_units').
onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.timestamps(true, true);
    t.index('org_id', 'idx_products_org_id');
    t.index('business_unit_id', 'idx_products_business_unit_id');
  });

  // ── engagements ────────────────────────────────────────────────────────────
  await knex.schema.createTable('engagements', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().
references('id').
inTable('organizations').
onDelete('CASCADE');
    t.uuid('product_id').notNullable().
references('id').
inTable('products').
onDelete('CASCADE');
    t.string('name', 255).notNullable();
    // 'pentest' | 'scan' | 'bug bounty' | 'red team'
    t.string('type', 32).notNullable().
defaultTo('pentest');
    // 'planned' | 'active' | 'completed'
    t.string('status', 32).notNullable().
defaultTo('planned');
    t.string('jira_project', 64);
    t.timestamps(true, true);
    t.index('org_id', 'idx_engagements_org_id');
    t.index('product_id', 'idx_engagements_product_id');
  });

  // ── assessments ────────────────────────────────────────────────────────────
  await knex.schema.createTable('assessments', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().
references('id').
inTable('organizations').
onDelete('CASCADE');
    t.uuid('engagement_id').notNullable().
references('id').
inTable('engagements').
onDelete('CASCADE');
    t.string('name', 255).notNullable();
    // 'open' | 'closed'
    t.string('status', 32).notNullable().
defaultTo('open');
    t.timestamps(true, true);
    t.index('org_id', 'idx_assessments_org_id');
    t.index('engagement_id', 'idx_assessments_engagement_id');
  });

  // ── users.org_id (tenant membership) ───────────────────────────────────────
  const hasOrgId = await knex.schema.hasColumn('users', 'org_id');
  if (!hasOrgId) {
    await knex.schema.table('users', (t) => {
      t.uuid('org_id').references('id').
inTable('organizations').
onDelete('SET NULL');
      t.index('org_id', 'idx_users_org_id');
    });
  }
}

export async function down(knex) {
  const hasOrgId = await knex.schema.hasColumn('users', 'org_id');
  if (hasOrgId) {
    await knex.schema.table('users', (t) => {
      t.dropIndex('org_id', 'idx_users_org_id');
      t.dropColumn('org_id');
    });
  }
  await knex.schema.dropTableIfExists('assessments');
  await knex.schema.dropTableIfExists('engagements');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('business_units');
  await knex.schema.dropTableIfExists('organizations');
}
