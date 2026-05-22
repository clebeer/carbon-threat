import { apiClient } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Role {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  permission_keys: string[];
  user_count?: number;
  created_at: string;
  updated_at: string;
}

export interface PermissionDomain {
  label: string;
  permissions: { key: string; label: string; description: string }[];
}

export type PermissionCatalog = Record<string, PermissionDomain>;

// ── API functions ──────────────────────────────────────────────────────────────

export async function listRoles(): Promise<Role[]> {
  const { data } = await apiClient.get<{ roles: Role[] }>('/roles');
  return data.roles;
}

export async function getRole(id: string): Promise<Role> {
  const { data } = await apiClient.get<{ role: Role }>(`/roles/${id}`);
  return data.role;
}

export async function createRole(payload: {
  name: string;
  description?: string;
  permission_keys: string[];
}): Promise<Role> {
  const { data } = await apiClient.post<{ role: Role }>('/roles', payload);
  return data.role;
}

export async function updateRole(
  id: string,
  payload: {
    name?: string;
    description?: string;
    permission_keys?: string[];
    is_active?: boolean;
  }
): Promise<Role> {
  const { data } = await apiClient.put<{ role: Role }>(`/roles/${id}`, payload);
  return data.role;
}

export async function deleteRole(id: string): Promise<void> {
  await apiClient.delete(`/roles/${id}`);
}

export async function listPermissions(): Promise<PermissionCatalog> {
  const { data } = await apiClient.get<{ permissions: PermissionCatalog }>('/permissions');
  return data.permissions;
}