/**
 * Migration 011 — MITRE ATT&CK Framework
 *
 * Tables for the integrated ATT&CK framework modules:
 * Analysis, Techniques Browser, Threat Modeling, and Reporting.
 *
 *  attack_objects          — ATT&CK entities: tactics, techniques, sub-techniques,
 *                            groups, mitigations, software
 *  attack_relationships    — Source→target edges (mitigates, subtechnique-of, uses)
 *  attack_threat_mappings  — User-created threat→technique associations
 *  attack_sync_log         — History of STIX data synchronisation runs
 */

export async function up(knex) {
  // ── ATT&CK Objects ────────────────────────────────────────────────────────
  // Stores all ATT&CK entity types in a single table (discriminated by `type`).
  await knex.schema.createTable('attack_objects', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // External ATT&CK identifier e.g. TA0001, T1059, T1059.003, M1027, G0007, S0001
    t.string('attack_id').notNullable();

    // tactic | technique | sub-technique | group | mitigation | software
    t.string('type').notNullable();

    t.string('name').notNullable();
    t.text('description');

    // Technique/sub-technique only: operating systems, cloud, etc.
    t.specificType('platforms', 'TEXT[]').defaultTo('{}');

    // Technique only: kill-chain phase objects from STIX
    // [ { kill_chain_name, phase_name } ]
    t.jsonb('kill_chain_phases').defaultTo('[]');

    // Sub-technique only: parent technique UUID (attack_objects.id)
    t.uuid('parent_id').references('id').inTable('attack_objects').onDelete('SET NULL');

    // Group/Software: alternative names
    t.specificType('aliases', 'TEXT[]').defaultTo('{}');

    // Canonical ATT&CK URL (e.g. https://attack.mitre.org/techniques/T1059/)
    t.text('url');

    // Original STIX 2.1 identifier (bundle-scoped — unique per object)
    t.string('stix_id').unique();

    t.boolean('is_deprecated').notNullable().defaultTo(false);
    t.boolean('is_revoked').notNullable().defaultTo(false);

    // Free-form extra metadata from STIX (detection, data sources, etc.)
    t.jsonb('extra').defaultTo('{}');

    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.unique(['attack_id'], { indexName: 'uq_attack_objects_attack_id' });
    t.index('type',        'idx_attack_objects_type');
    t.index('name',        'idx_attack_objects_name');
    t.index('parent_id',   'idx_attack_objects_parent_id');
  });

  // ── ATT&CK Relationships ──────────────────────────────────────────────────
  // Directed edges between ATT&CK objects.
  //   mitigates       : mitigation → technique
  //   subtechnique-of : sub-technique → technique (parent)
  //   uses            : group/software → technique
  await knex.schema.createTable('attack_relationships', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    t.uuid('source_id')
      .notNullable()
      .references('id').inTable('attack_objects').onDelete('CASCADE');
    t.uuid('target_id')
      .notNullable()
      .references('id').inTable('attack_objects').onDelete('CASCADE');

    // mitigates | subtechnique-of | uses | attributed-to | detects
    t.string('relationship_type').notNullable();

    t.string('stix_id').unique();

    t.index(['source_id', 'relationship_type'], 'idx_atk_rel_source_type');
    t.index(['target_id', 'relationship_type'], 'idx_atk_rel_target_type');
  });

  // ── Threat → ATT&CK Technique Mappings ───────────────────────────────────
  // User-curated associations between Carbon Threat STRIDE threats and
  // MITRE ATT&CK techniques.  Also supports model-level (no threat_id) mappings.
  await knex.schema.createTable('attack_threat_mappings', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Optional: link to a specific STRIDE threat record
    t.uuid('threat_id')
      .references('id').inTable('threats').onDelete('CASCADE');

    // Required: the ATT&CK technique being mapped
    t.uuid('technique_id')
      .notNullable()
      .references('id').inTable('attack_objects').onDelete('CASCADE');

    // Optional: scope to a threat model
    t.uuid('model_id')
      .references('id').inTable('threat_models').onDelete('CASCADE');

    t.uuid('created_by')
      .references('id').inTable('users').onDelete('SET NULL');

    // high | medium | low
    t.string('confidence').defaultTo('medium');
    t.text('notes');

    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.index('threat_id',    'idx_atm_threat_id');
    t.index('technique_id', 'idx_atm_technique_id');
    t.index('model_id',     'idx_atm_model_id');
  });

  // ── ATT&CK Sync Log ───────────────────────────────────────────────────────
  // One row per synchronisation run.  Last row with status='complete' drives
  // the "last synced" display in the UI.
  await knex.schema.createTable('attack_sync_log', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // e.g. enterprise-attack, mobile-attack, ics-attack
    t.string('domain').notNullable().defaultTo('enterprise-attack');

    // ATT&CK version string embedded in the bundle (x-mitre-collection)
    t.string('attack_version');

    t.integer('objects_synced').defaultTo(0);
    t.integer('relationships_synced').defaultTo(0);

    // pending | running | complete | error
    t.string('status').notNullable().defaultTo('pending');
    t.text('error_message');

    t.uuid('triggered_by').references('id').inTable('users').onDelete('SET NULL');

    t.timestamp('started_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('finished_at');

    t.index('status',     'idx_sync_log_status');
    t.index('started_at', 'idx_sync_log_started_at');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('attack_threat_mappings');
  await knex.schema.dropTableIfExists('attack_relationships');
  await knex.schema.dropTableIfExists('attack_sync_log');
  await knex.schema.dropTableIfExists('attack_objects');
}
