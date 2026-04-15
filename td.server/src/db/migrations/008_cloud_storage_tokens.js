export const up = async (knex) => {
  await knex.schema.createTable('cloud_storage_tokens', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().
references('id').
inTable('users').
onDelete('CASCADE');
    t.string('provider', 20).notNullable();
    t.text('access_token_enc').nullable();
    t.text('refresh_token_enc').nullable();
    t.timestamp('expires_at').nullable();
    t.text('scope').nullable();
    t.timestamps(true, true);
    t.unique(['user_id', 'provider']);
  });
  await knex.raw(`ALTER TABLE cloud_storage_tokens ADD CONSTRAINT cst_provider_check CHECK (provider IN ('google_drive','onedrive'))`);
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('cloud_storage_tokens');
};
