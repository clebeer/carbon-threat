import { apiClient } from './client';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string };
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/local/login', { email, password });
  return data;
}

export async function logout(): Promise<void> {
  const { useAuthStore } = await import('../store/authStore');
  const { refreshToken } = useAuthStore.getState();
  await apiClient.post('/logout', refreshToken ? { refreshToken } : {}).catch(() => {
    // Best-effort; always clear local state regardless of server response.
  });
}

/**
 * Uses the stored refresh token to obtain a new access token.
 * Returns the new access token string.
 */
export async function refreshSession(): Promise<string> {
  const { useAuthStore } = await import('../store/authStore');
  const refreshToken = useAuthStore.getState().refreshToken;

  if (!refreshToken) throw new Error('No refresh token available');

  const { data } = await apiClient.post<{ accessToken: string }>('/token/refresh', { refreshToken });
  return data.accessToken;
}
