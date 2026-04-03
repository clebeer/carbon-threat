import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// The access token lives in memory only — never persisted to localStorage.
// The auth store sets/clears this via setInMemoryToken().
let _accessToken: string | null = null;

export function setInMemoryToken(token: string | null) {
  _accessToken = token;
}

export function getInMemoryToken(): string | null {
  return _accessToken;
}

export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// ── Request interceptor: attach Bearer token ───────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

// ── Response interceptor: handle 401 → try refresh once ───────────────────
let _isRefreshing = false;
let _refreshQueue: Array<(token: string | null) => void> = [];

function drainQueue(token: string | null) {
  _refreshQueue.forEach((cb) => cb(token));
  _refreshQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

    if (
      error.response?.status !== 401 ||
      original._retried ||
      original.url?.includes('/token/refresh') ||
      original.url?.includes('/login') ||
      original.url?.includes('/logout')
    ) {
      return Promise.reject(error);
    }

    original._retried = true;

    if (_isRefreshing) {
      // Queue the request until the ongoing refresh completes
      return new Promise((resolve, reject) => {
        _refreshQueue.push((newToken) => {
          if (!newToken) return reject(error);
          original.headers.Authorization = `Bearer ${newToken}`;
          resolve(apiClient(original));
        });
      });
    }

    _isRefreshing = true;

    try {
      // Import lazily to avoid circular dependency
      const { refreshSession } = await import('./auth');
      const newToken = await refreshSession();

      setInMemoryToken(newToken);
      drainQueue(newToken);

      original.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(original);
    } catch {
      drainQueue(null);
      // Signal the auth store to clear session
      const { useAuthStore } = await import('../store/authStore');
      useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    } finally {
      _isRefreshing = false;
    }
  }
);
