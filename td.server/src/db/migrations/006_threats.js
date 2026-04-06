export const up = async (knex) => {
  await knex.schema.createTable('threats', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('model_id').notNullable().references('id').inTable('threat_models').onDelete('CASCADE');
    t.uuid('org_id').nullable().references('id').inTable('organizations').onDelete('SET NULL');
    t.specificType('node_ids', 'text[]').nullable().defaultTo('{}');
    t.specificType('edge_ids', 'text[]').nullable().defaultTo('{}');
    t.string('title', 255).notNullable();
    t.text('description');
    t.string('stride_category', 30).notNullable().defaultTo('Tampering');
    t.string('severity', 10).notNullable().defaultTo('Medium');
    t.string('status', 30).notNullable().defaultTo('Open');
    t.string('source', 20).notNullable().defaultTo('manual');
    t.string('rule_id', 100).nullable();
    t.text('mitigation');
    t.jsonb('owasp_refs').notNullable().defaultTo('[]');
    t.timestamps(true, true);
  });
  await knex.schema.table('threats', (t) => {
    t.index(['model_id', 'status']);
    t.index(['model_id', 'stride_category']);
  });
  await knex.raw(`ALTER TABLE threats ADD CONSTRAINT threats_stride_category_check CHECK (stride_category IN ('Spoofing','Tampering','Repudiation','Information Disclosure','DoS','Elevation of Privilege'))`);
  await knex.raw(`ALTER TABLE threats ADD CONSTRAINT threats_severity_check CHECK (severity IN ('Critical','High','Medium','Low'))`);
  await knex.raw(`ALTER TABLE threats ADD CONSTRAINT threats_status_check CHECK (status IN ('Open','Mitigated','Investigating','Not Applicable'))`);
  await knex.raw(`ALTER TABLE threats ADD CONSTRAINT threats_source_check CHECK (source IN ('manual','rule','ai'))`);
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('threats');
};
