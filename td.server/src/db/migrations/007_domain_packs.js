export const up = async (knex) => {
  await knex.schema.createTable('domain_packs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('slug', 50).notNullable().unique();
    t.string('name', 100).notNullable();
    t.text('description');
    t.jsonb('icon_manifest').notNullable().defaultTo('{}');
    t.jsonb('threat_matrix').notNullable().defaultTo('{}');
    t.boolean('is_builtin').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('domain_templates', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('pack_id').notNullable().references('id').inTable('domain_packs').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.text('description');
    t.jsonb('diagram_json').notNullable().defaultTo('{}');
    t.timestamps(true, true);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('domain_templates');
  await knex.schema.dropTableIfExists('domain_packs');
};
