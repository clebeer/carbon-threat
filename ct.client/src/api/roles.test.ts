/**
 * Unit tests — api/roles.ts
 *
 * MSW intercepts HTTP calls so tests run without a real server.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
} from './roles';

const MOCK_ROLE = {
  id: 'role-1',
  slug: 'custom-analyst',
  name: 'Custom Analyst',
  description: 'A custom role',
  is_system: false,
  is_active: true,
  permission_keys: ['scanner:read'],
  user_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_PERMISSIONS = [
  {
    domain: 'Scanner',
    permissions: [
      { key: 'scanner:read', label: 'View', description: 'View scan results' },
    ],
  },
];

describe('api/roles', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/roles',        () => HttpResponse.json({ roles: [MOCK_ROLE] })),
      http.get('/api/roles/:id',    () => HttpResponse.json({ role: MOCK_ROLE })),
      http.post('/api/roles',       () => HttpResponse.json({ role: MOCK_ROLE }, { status: 201 })),
      http.put('/api/roles/:id',    () => HttpResponse.json({ role: { ...MOCK_ROLE, name: 'Updated' } })),
      http.delete('/api/roles/:id', () => HttpResponse.json({ message: 'Role deleted' })),
      http.get('/api/permissions',  () => HttpResponse.json({ permissions: MOCK_PERMISSIONS })),
    );
  });

  it('listRoles returns array of roles', async () => {
    const roles = await listRoles();
    expect(roles).toHaveLength(1);
    expect(roles[0].slug).toBe('custom-analyst');
  });

  it('getRole returns a single role', async () => {
    const role = await getRole('role-1');
    expect(role.id).toBe('role-1');
  });

  it('createRole returns the created role', async () => {
    const role = await createRole({ name: 'Custom Analyst', permission_keys: ['scanner:read'] });
    expect(role.name).toBe('Custom Analyst');
  });

  it('updateRole returns the updated role', async () => {
    const role = await updateRole('role-1', { name: 'Updated' });
    expect(role.name).toBe('Updated');
  });

  it('deleteRole resolves without error', async () => {
    await expect(deleteRole('role-1')).resolves.toBeUndefined();
  });

  it('listPermissions returns grouped permissions', async () => {
    const groups = await listPermissions();
    expect(groups).toHaveLength(1);
    expect(groups[0].domain).toBe('Scanner');
    expect(groups[0].permissions[0].key).toBe('scanner:read');
  });
});
