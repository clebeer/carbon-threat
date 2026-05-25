/**
 * Migration 016 — Custom Role Profiles
 *
 * Creates:
 *   roles            — named roles (system built-ins + custom)
 *   role_permissions — permission grants per role (catalog lives in code)
 *
 * Alters:
 *   users.role       — ENUM → varchar(50) so custom role slugs are valid values
 *
 * NOTE: Permission keys are inlined here to keep the migration self-contained.
 *       The authoritative catalog is td.server/src/auth/permissions.catalog.js —
 *       keep them in sync when adding new permissions.
 */

// ── Permission keys (must stay in sync with permissions.catalog.js) ─────────

const ALL_PERMISSION_KEYS = [
  // threat models
  'threatmodel:create', 'threatmodel:update', 'threatmodel:delete',
  'threatmodel:read', 'threatmodel:analyze', 'threatmodel:import', 'threatmodel:export',
  // threats
  'threats:create', 'threats:update', 'threats:delete', 'threats:read',
  // users
  'users:read', 'users:manage',
  // roles
  'roles:manage',
  // scanner
  'scanner:read', 'scanner:run', 'scanner:policy',
  // ATT&CK
  'attack:read', 'attack:sync', 'attack:map',
  // templates
  'templates:import', 'templates:manage',
  // config
  'config:read', 'config:manage',
  // audit
  'audit:read',
  // backup
  'backup:manage',
  // AI
  'ai:suggest',
  // assets
  'assets:read', 'assets:manage',
  // domain packs
  'domain-packs:read', 'domain-packs:apply',
  // cloud storage
  'cloud-storage:read', 'cloud-storage:import', 'cloud-storage:export',
  // vuln feeds
  'vuln-feeds:read', 'vuln-feeds:manage',
  // Jules
  'jules:read', 'jules:create',
  // integrations
  'integrations:read', 'integrations:manage',
];

// Read-only subset (used for viewer role)
const VIEWER_KEYS = ALL_PERMISSION_KEYS.filter((k) => k.endsWith(':read'));

// Analyst subset: everything except user-manage, role-manage, config:manage,
// backup:manage, attack:sync, vuln-feeds:manage, integrations:manage
const ANALYST_DENY = new Set([
  'users:manage', 'roles:manage', 'config:manage',
  'backup:manage', 'attack:sync', 'vuln-feeds:manage', 'integrations:manage',
]);
const ANALYST_KEYS = ALL_PERMISSION_KEYS.filter((k) => !ANALYST_DENY.has(k));

// api_key ≡ analyst (preserves existing behavior)
const API_KEY_KEYS = ANALYST_KEYS;

// ── Migration ─────────────────────────────────────────────────────────────────

export async function up(knex) {
  // 1. roles table
  await knex.schema.createTable('roles', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.string('slug', 50).notNullable().
unique();
    t.string('name', 255).notNullable();
    t.text('description');
    t.boolean('is_system').notNullable().
defaultTo(false);
    t.boolean('is_active').notNullable().
defaultTo(true);
    t.timestamps(true, true);
  });
  await knex.schema.table('roles', (t) => {
    t.index('slug', 'idx_roles_slug');
    t.index('is_system', 'idx_roles_is_system');
  });

  // 2. role_permissions table
  await knex.schema.createTable('role_permissions', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('role_id').
      notNullable().
      references('id').
      inTable('roles').
      onDelete('CASCADE');
    t.string('permission_key', 100).notNullable();
    t.unique(['role_id', 'permission_key']);
  });
  await knex.schema.table('role_permissions', (t) => {
    t.index('role_id', 'idx_role_permissions_role_id');
  });

  // 3. Migrate users.role from ENUM → varchar(50)
  await knex.raw(`ALTER TABLE users ALTER COLUMN role TYPE varchar(50) USING role::text`);

  // 4. Seed system roles
  await knex('roles').insert([
    { slug: 'admin', name: 'Administrator', description: 'Full system access — manages users, config, and integrations', is_system: true },
    { slug: 'analyst', name: 'Security Architect', description: 'Can create and edit threat models and templates', is_system: true },
    { slug: 'viewer', name: 'Auditor / Viewer', description: 'Read-only access to models and reports', is_system: true },
    { slug: 'api_key', name: 'API Key', description: 'Machine-to-machine integrations via bearer token', is_system: true },
  ]);

  // 5. Seed permission grants
  const roles = await knex('roles').whereIn('slug', ['admin', 'analyst', 'viewer', 'api_key']).
select('id', 'slug');
  const bySlug = Object.fromEntries(roles.map((r) => [r.slug, r.id]));

  const grantRows = (slug, keys) => keys.map((permission_key) => ({ role_id: bySlug[slug], permission_key }));

  await knex('role_permissions').insert([
    ...grantRows('admin', ALL_PERMISSION_KEYS),
    ...grantRows('analyst', ANALYST_KEYS),
    ...grantRows('viewer', VIEWER_KEYS),
    ...grantRows('api_key', API_KEY_KEYS),
  ]);
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('role_permissions');
  await knex.schema.dropTableIfExists('roles');

  // Restore users.role as the original ENUM.
  // We recreate the type first in case it was already dropped by a prior rollback.
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_role_enum') THEN
        CREATE TYPE users_role_enum AS ENUM ('admin', 'analyst', 'viewer', 'api_key');
      END IF;
    END;
    $$;
    ALTER TABLE users ALTER COLUMN role TYPE users_role_enum USING role::users_role_enum;
    ALTER TABLE users ALTER COLUMN role SET DEFAULT 'analyst'::users_role_enum;
  `);
}
