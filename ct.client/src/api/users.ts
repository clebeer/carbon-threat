import { apiClient } from './client';

export type UserRole = 'admin' | 'analyst' | 'viewer' | 'api_key';

export interface User {
  id: string;
  org_id?: string;
  email: string;
  display_name?: string;
  role: UserRole;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

export async function listUsers(): Promise<User[]> {
  const { data } = await apiClient.get<{ users: User[] }>('/users');
  return data.users;
}

export async function getUser(id: string): Promise<User> {
  const { data } = await apiClient.get<{ user: User }>(`/users/${id}`);
  return data.user;
}

export async function createUser(payload: {
  email: string;
  password: string;
  display_name?: string;
  role?: UserRole;
  org_id?: string;
}): Promise<User> {
  const { data } = await apiClient.post<{ user: User }>('/users', payload);
  return data.user;
}

export async function updateUser(
  id: string,
  payload: { email?: string; display_name?: string; role?: UserRole; is_active?: boolean; password?: string }
): Promise<User> {
  const { data } = await apiClient.put<{ user: User }>(`/users/${id}`, payload);
  return data.user;
}

export async function deactivateUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}
