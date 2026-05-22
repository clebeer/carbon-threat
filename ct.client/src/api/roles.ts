/**
 * Roles API client
 *
 * Typed wrappers around the /roles and /api/permissions endpoints.
 * All requests are authenticated via the shared apiClient (Bearer injected by
 * the request interceptor in client.ts).
 */

import { apiClient } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Role {
  id: string;
  slug: string;
  name: string;
  description: string;
  is_system: boolean;
  is_active: boolean;
  permission_keys: string[];
  user_count: number;
  created_at: string;
  updated_at: string;
}

export interface PermissionEntry {
  key: string;
  label: string;
  description: string;
}

export interface PermissionGroup {
  domain: string;
  permissions: PermissionEntry[];
}

export interface CreateRolePayload {
  name: string;
  description?: string;
  permission_keys?: string[];
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
  permission_keys?: string[];
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function listRoles(): Promise<Role[]> {
  const { data } = await apiClient.get<{ roles: Role[] }>('/roles');
  return data.roles;
}

export async function getRole(id: string): Promise<Role> {
  const { data } = await apiClient.get<{ role: Role }>(`/roles/${id}`);
  return data.role;
}

export async function createRole(payload: CreateRolePayload): Promise<Role> {
  const { data } = await apiClient.post<{ role: Role }>('/roles', payload);
  return data.role;
}

export async function updateRole(id: string, payload: UpdateRolePayload): Promise<Role> {
  const { data } = await apiClient.put<{ role: Role }>(`/roles/${id}`, payload);
  return data.role;
}

export async function deleteRole(id: string): Promise<void> {
  await apiClient.delete(`/roles/${id}`);
}

export async function listPermissions(): Promise<PermissionGroup[]> {
  const { data } = await apiClient.get<{ permissions: PermissionGroup[] }>('/permissions');
  return data.permissions;
}
