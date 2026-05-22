export const up = async (knex) => {
  // Add DREAD and test_cases columns to threats table
  await knex.schema.alterTable('threats', (t) => {
    t.jsonb('dread').nullable();
    t.text('test_cases').nullable();
  });

  // Create ai_analyses table
  await knex.schema.createTable('ai_analyses', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('model_id').notNullable().
references('id').
inTable('threat_models').
onDelete('CASCADE');
    t.uuid('org_id').nullable();
    t.string('app_type').defaultTo('Traditional application');
    t.jsonb('inputs').nullable();
    t.string('provider').notNullable();
    t.string('model').notNullable();
    t.jsonb('improvement_suggestions').nullable();
    t.jsonb('raw_output').nullable();
    t.uuid('created_by').nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Index for fast lookups by model
  await knex.raw('CREATE INDEX idx_ai_analyses_model_id ON ai_analyses(model_id)');
};

export const down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS idx_ai_analyses_model_id');
  await knex.schema.dropTableIfExists('ai_analyses');
  await knex.schema.alterTable('threats', (t) => {
    t.dropColumn('dread');
    t.dropColumn('test_cases');
  });
};