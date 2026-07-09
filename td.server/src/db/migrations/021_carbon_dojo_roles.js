/**
 * Migration 021 — Carbon Dojo roles & permission grants
 *
 * Adds the vuln-management roles alongside `admin`:
 *   rt_manager  — Red Team Manager
 *   rt_analyst  — Red Team Analyst
 *   dev_owner   — Dev Owner
 *   reader      — Reader (read-only)
 *
 * Permission keys MUST stay in sync with src/auth/permissions.catalog.js.
 * Legacy roles (analyst/viewer/api_key) and legacy keys are untouched here; they are
 * removed per-vertical in Phase 2 (ADR 0001, Decision 2).
 */

// ── Carbon Dojo permission keys (sync with permissions.catalog.js) ────────────
const CARBON_KEYS = [
  'products:read', 'products:write',
  'engagements:read', 'engagements:write',
  'assessments:read', 'assessments:write',
  'findings:read', 'findings:write', 'findings:triage', 'findings:comment', 'findings:export',
  'risk:request', 'risk:approve',
  'imports:read', 'imports:write',
  'connectors:read', 'connectors:write', 'connectors:test',
  'reports:read', 'reports:generate',
  'policies:read', 'policies:manage',
  'service-accounts:read', 'service-accounts:manage',
  'identity-providers:read', 'identity-providers:manage',
  'notifications:read', 'notifications:manage',
  // reused existing keys that are also part of the Carbon Dojo Admin surface
  'users:read', 'users:manage', 'roles:manage', 'audit:read',
];

const READ_KEYS = CARBON_KEYS.filter((k) => k.endsWith(':read'));

const RT_MANAGER_KEYS = [
  'products:read', 'products:write',
  'engagements:read', 'engagements:write',
  'assessments:read', 'assessments:write',
  'findings:read', 'findings:write', 'findings:triage', 'findings:comment', 'findings:export',
  'risk:request', 'risk:approve',
  'imports:read', 'imports:write',
  'connectors:read', 'connectors:write', 'connectors:test',
  'reports:read', 'reports:generate',
  'audit:read',
];

const RT_ANALYST_KEYS = [
  'products:read',
  'engagements:read',
  'assessments:read', 'assessments:write',
  'findings:read', 'findings:write', 'findings:triage', 'findings:comment', 'findings:export',
  'risk:request',
  'imports:read', 'imports:write',
  'connectors:read',
  'reports:read', 'reports:generate',
];

const DEV_OWNER_KEYS = ['products:read', 'findings:read', 'findings:comment', 'reports:read'];

const ROLES = [
  { slug: 'rt_manager', name: 'Red Team Manager', description: 'Runs engagements/assessments; triages, exports and approves risk', keys: RT_MANAGER_KEYS },
  { slug: 'rt_analyst', name: 'Red Team Analyst', description: 'Triages findings, imports scans, requests risk acceptance', keys: RT_ANALYST_KEYS },
  { slug: 'dev_owner', name: 'Dev Owner', description: 'Views and comments on findings for owned products', keys: DEV_OWNER_KEYS },
  { slug: 'reader', name: 'Reader', description: 'Read-only access', keys: READ_KEYS },
];

export async function up(knex) {
  // Seed the new roles (skip any that already exist to keep this idempotent).
  const existing = await knex('roles').whereIn('slug', ROLES.map((r) => r.slug)).
select('slug');
  const existingSlugs = new Set(existing.map((r) => r.slug));
  const toInsert = ROLES.filter((r) => !existingSlugs.has(r.slug)).
    map((r) => ({ slug: r.slug, name: r.name, description: r.description, is_system: true }));
  if (toInsert.length > 0) {
    await knex('roles').insert(toInsert);
  }

  // Resolve ids and seed grants for the Carbon Dojo roles.
  const roleRows = await knex('roles').whereIn('slug', ROLES.map((r) => r.slug)).
select('id', 'slug');
  const idBySlug = Object.fromEntries(roleRows.map((r) => [r.slug, r.id]));

  const grantRows = ROLES.flatMap((r) => r.keys.map((permission_key) => ({ role_id: idBySlug[r.slug], permission_key })),
  );

  // Also grant the new Carbon Dojo keys to the existing admin role (admin already has
  // a full bypass in code, but we keep role_permissions consistent for the roles UI).
  const admin = await knex('roles').where({ slug: 'admin' }).
first('id');
  if (admin) {
    grantRows.push(...CARBON_KEYS.map((permission_key) => ({ role_id: admin.id, permission_key })));
  }

  if (grantRows.length > 0) {
    await knex('role_permissions').
      insert(grantRows).
      onConflict(['role_id', 'permission_key']).
      ignore();
  }
}

export async function down(knex) {
  const slugs = ROLES.map((r) => r.slug);
  const roleRows = await knex('roles').whereIn('slug', slugs).
select('id');
  const ids = roleRows.map((r) => r.id);
  if (ids.length > 0) {
    await knex('role_permissions').whereIn('role_id', ids).
del();
  }
  // Remove the Carbon Dojo grants added to admin.
  const admin = await knex('roles').where({ slug: 'admin' }).
first('id');
  if (admin) {
    await knex('role_permissions').where({ role_id: admin.id }).
whereIn('permission_key', CARBON_KEYS).
del();
  }
  await knex('roles').whereIn('slug', slugs).
del();
}
