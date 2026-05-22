import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setInMemoryToken } from '../api/client';

export type UserRole = 'admin' | 'analyst' | 'viewer' | 'api_key' | (string & {});

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  /** Fine-grained permission keys returned by the server on login. */
  permissions?: string[];
}

interface AuthState {
  user: AuthUser | null;
  /** Persisted so we can auto-refresh on page reload. */
  refreshToken: string | null;
  /** Derived flag — true when a user session is active. */
  isAuthenticated: boolean;

  /**
   * Called after a successful login or token refresh.
   * Access token is written to the in-memory singleton in api/client.ts
   * so it is never serialised to localStorage.
   */
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;

  /** Clears all auth state and wipes the in-memory token. */
  clearAuth: () => void;

  /**
   * Returns true if the current user has the given permission key.
   * admin role has implicit access to everything.
   */
  hasPermission: (key: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        setInMemoryToken(accessToken);
        set({ user, refreshToken, isAuthenticated: true });
      },

      clearAuth: () => {
        setInMemoryToken(null);
        set({ user: null, refreshToken: null, isAuthenticated: false });
      },

      hasPermission: (key: string): boolean => {
        const { user } = get();
        if (!user) return false;
        if (user.role === 'admin') return true;
        return user.permissions?.includes(key) ?? false;
      },
    }),
    {
      name: 'carbonthreat-auth',
      // Only persist the refresh token and user profile — never the access token.
      partialize: (state) => ({
        user: state.user,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
