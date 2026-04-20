export function up(knex) {
  return knex.schema.createTable('jules_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('jules_session_id', 255).nullable();
    t.string('finding_id', 255).notNullable();
    t.string('finding_type', 20).notNullable().defaultTo('osv');
    t.string('source_name', 500).notNullable();
    t.text('prompt').notNullable();
    t.string('automation_mode', 30).notNullable().defaultTo('AUTO_CREATE_PR');
    t.string('status', 30).notNullable().defaultTo('pending');
    t.text('plan_summary').nullable();
    t.string('pr_url', 500).nullable();
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.index('finding_id');
    t.index('status');
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('jules_sessions');
}
