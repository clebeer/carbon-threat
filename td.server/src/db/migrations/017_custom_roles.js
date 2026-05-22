/**
 * Migration 017 — Custom Role Profiles
 *
 * Creates roles + role_permissions tables, seeds 4 system roles,
 * and migrates users.role from ENUM to varchar(50).
 */

import { allPermissionKeys } from '../../auth/permissions.catalog.js';

const ANALYST_PERMISSIONS = [
  'threatmodel:read', 'threatmodel:create', 'threatmodel:update', 'threatmodel:delete',
  'threatmodel:analyze', 'threatmodel:import', 'threatmodel:export',
  'threats:read', 'threats:create', 'threats:update', 'threats:delete',
  'users:read',
  'scanner:read', 'scanner:run',
  'attack:read', 'attack:map',
  'templates:import',
  'ai:suggest',
  'assets:read', 'assets:manage',
  'domain-packs:apply',
  'cloud-storage:import', 'cloud-storage:export',
  'integrations:read', 'integrations:export',
  'jules:read', 'jules:manage',
];

const VIEWER_PERMISSIONS = [
  'threatmodel:read', 'threats:read', 'users:read', 'scanner:read',
  'attack:read', 'assets:read', 'integrations:read', 'jules:read',
];

const API_KEY_PERMISSIONS = [...ANALYST_PERMISSIONS];

export const up = async (knex) => {
  // 1. Create roles table
  await knex.schema.createTable('roles', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('slug', 100).notNullable().unique();
    t.string('name', 255).notNullable();
    t.text('description');
    t.boolean('is_system').notNullable().defaultTo(false);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // 2. Create role_permissions table
  await knex.schema.createTable('role_permissions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
    t.string('permission_key', 255).notNullable();
    t.unique(['role_id', 'permission_key']);
  });

  // 3. Seed system roles
  const allKeys = allPermissionKeys();

  const [adminRole] = await knex('roles').insert({
    slug: 'admin', name: 'Administrator',
    description: 'Full system access — manages users, config, and integrations',
    is_system: true,
  }).returning(['id']);

  const [analystRole] = await knex('roles').insert({
    slug: 'analyst', name: 'Security Architect',
    description: 'Can create and edit threat models and templates',
    is_system: true,
  }).returning(['id']);

  const [viewerRole] = await knex('roles').insert({
    slug: 'viewer', name: 'Auditor / Viewer',
    description: 'Read-only access to models and reports',
    is_system: true,
  }).returning(['id']);

  const [apiKeyRole] = await knex('roles').insert({
    slug: 'api_key', name: 'API Key',
    description: 'Machine-to-machine integrations via bearer token',
    is_system: true,
  }).returning(['id']);

  // 4. Seed permissions
  const makePerms = (roleId, keys) => keys.map((key) => ({ role_id: roleId, permission_key: key }));
  await knex('role_permissions').insert([
    ...makePerms(adminRole.id, allKeys),
    ...makePerms(analystRole.id, ANALYST_PERMISSIONS),
    ...makePerms(viewerRole.id, VIEWER_PERMISSIONS),
    ...makePerms(apiKeyRole.id, API_KEY_PERMISSIONS),
  ]);

  // 5. Migrate users.role from enum to varchar(50)
  await knex.raw('ALTER TABLE users ALTER COLUMN role TYPE varchar(50) USING role::text');
  await knex.raw('ALTER TABLE users ALTER COLUMN role SET DEFAULT \'analyst\'');
  await knex.raw('DROP TYPE IF EXISTS users_role_enum');
};

export const down = async (knex) => {
  // 1. Restore users.role as enum
  await knex.raw('CREATE TYPE users_role_enum AS ENUM (\'admin\', \'analyst\', \'viewer\', \'api_key\')');
  await knex.raw('ALTER TABLE users ALTER COLUMN role TYPE users_role_enum USING role::users_role_enum');
  await knex.raw('ALTER TABLE users ALTER COLUMN role SET DEFAULT \'analyst\'');

  // 2. Drop new tables
  await knex.schema.dropTableIfExists('role_permissions');
  await knex.schema.dropTableIfExists('roles');
};