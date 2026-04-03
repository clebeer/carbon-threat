import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setInMemoryToken } from '../api/client';

export type UserRole = 'admin' | 'analyst' | 'viewer' | 'api_key';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
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
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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
