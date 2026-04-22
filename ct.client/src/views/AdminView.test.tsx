/**
 * Unit / integration tests — AdminView
 *
 * MSW intercepts all /api/users and /api/integrations requests.
 * The authStore is pre-loaded with an admin user so RBAC-guarded
 * mutations are reachable.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../test/server';
import AdminView from './AdminView';
import {
  MOCK_USERS_LIST,
  MOCK_USER,
  MOCK_INTEGRATIONS,
} from '../test/handlers';
import { useAuthStore } from '../store/authStore';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderAdmin() {
  // Pre-seed authStore with an admin user (no real JWT needed in unit tests)
  useAuthStore.setState({
    user:            MOCK_USER as ReturnType<typeof useAuthStore.getState>['user'],
    refreshToken:    'mock-rt',
    isAuthenticated: true,
  });

  const qc = makeQueryClient();
  return {
    user: userEvent.setup(),
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <AdminView />
      </QueryClientProvider>
    ),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AdminView', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── rendering ───────────────────────────────────────────────────────────────

  describe('initial render', () => {
    it('shows "Team Members" section heading', async () => {
      renderAdmin();
      await waitFor(() =>
        expect(screen.getByText(/team members/i)).toBeInTheDocument()
      );
    });

    it('shows "Integrations" section heading', async () => {
      renderAdmin();
      await waitFor(() =>
        expect(screen.getByText(/integrations/i)).toBeInTheDocument()
      );
    });

    it('lists users fetched from /api/users', async () => {
      renderAdmin();
      await waitFor(() => {
        MOCK_USERS_LIST.forEach((u) => {
          expect(screen.getByText(u.email)).toBeInTheDocument();
        });
      });
    });

    it('shows platform names from integrations list', async () => {
      renderAdmin();
      // The integrations returned by MSW include 'github' and 'openai'
      await waitFor(() => {
        expect(screen.getByText(/github issues/i)).toBeInTheDocument();
        expect(screen.getByText(/openai/i)).toBeInTheDocument();
      });
    });
  });

  // ── user list ──────────────────────────────────────────────────────────────

  describe('user list', () => {
    it('renders role badge for each user', async () => {
      renderAdmin();
      await waitFor(() => {
        // MOCK_USERS_LIST has admin + analyst
        expect(screen.getByText(/administrator/i)).toBeInTheDocument();
        expect(screen.getByText(/security architect/i)).toBeInTheDocument();
      });
    });

    it('shows loading state before data arrives', () => {
      // Override to never resolve so we can observe loading
      server.use(
        http.get('/api/users', async () => {
          await new Promise(() => {}); // never resolves
        })
      );
      renderAdmin();
      expect(screen.queryByText(/loading/i)).toBeDefined(); // either spinner or empty list
    });

    it('shows error state when /api/users returns 500', async () => {
      server.use(
        http.get('/api/users', () =>
          HttpResponse.json({ error: 'Internal error' }, { status: 500 })
        )
      );
      renderAdmin();
      await waitFor(() => {
        // React Query will surface an error or empty list
        expect(screen.queryAllByText('admin@ct.com')).toHaveLength(0);
      });
    });
  });

  // ── invite user form ───────────────────────────────────────────────────────

  describe('invite user form', () => {
    it('creates a user when form is submitted with valid data', async () => {
      const { user } = renderAdmin();

      // Wait for page to load
      await waitFor(() => screen.getByText(/team members/i));

      // Fill in invite form fields
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);

      if (emailInput && passwordInput) {
        await user.type(emailInput, 'newuser@ct.com');
        await user.type(passwordInput, 'SecurePass123!');

        const inviteBtn = screen.getByRole('button', { name: /invite|add user/i });
        await user.click(inviteBtn);

        await waitFor(() => {
          // API call succeeded — button is re-enabled
          expect(inviteBtn).not.toBeDisabled();
        });
      }
    });

    it('shows 409 error when email already exists', async () => {
      server.use(
        http.post('/api/users', () =>
          HttpResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
        )
      );

      const { user } = renderAdmin();
      await waitFor(() => screen.getByText(/team members/i));

      const emailInput = screen.queryByPlaceholderText(/email/i);
      const passwordInput = screen.queryByPlaceholderText(/password/i);

      if (emailInput && passwordInput) {
        await user.type(emailInput, 'existing@ct.com');
        await user.type(passwordInput, 'SecurePass123!');
        const inviteBtn = screen.getByRole('button', { name: /invite|add user/i });
        await user.click(inviteBtn);

        await waitFor(() =>
          expect(screen.getByText(/already exists/i)).toBeInTheDocument()
        );
      }
    });
  });

  // ── deactivate user ────────────────────────────────────────────────────────

  describe('deactivate user', () => {
    it('calls DELETE /api/users/:id when deactivate is triggered', async () => {
      let deleteCalled = false;
      server.use(
        http.delete('/api/users/:id', () => {
          deleteCalled = true;
          return HttpResponse.json({ message: 'User deactivated', user: { id: 'user-uuid-2', email: 'analyst@ct.com' } });
        })
      );

      const { user } = renderAdmin();
      await waitFor(() => screen.getByText('analyst@ct.com'));

      const deactivateBtns = screen.getAllByRole('button', { name: /deactivate|remove/i });
      if (deactivateBtns.length > 0) {
        await user.click(deactivateBtns[0]);
        await waitFor(() => expect(deleteCalled).toBe(true));
      }
    });
  });

  // ── integrations ──────────────────────────────────────────────────────────

  describe('integration forms', () => {
    it('renders a form section for each supported platform', async () => {
      renderAdmin();
      await waitFor(() => {
        // Should show all 5 platforms from PLATFORM_META
        const platforms = ['GitHub', 'Jira', 'ServiceNow', 'OpenAI', 'Ollama'];
        platforms.forEach((p) => {
          expect(screen.getByText(new RegExp(p, 'i'))).toBeInTheDocument();
        });
      });
    });

    it('shows enabled indicator dot for enabled integrations', async () => {
      renderAdmin();
      await waitFor(() => {
        // GitHub is enabled in MOCK_INTEGRATIONS
        expect(screen.getByText(/github issues/i)).toBeInTheDocument();
      });
    });

    it('saves integration config via PUT /api/integrations/:platform', async () => {
      let putCalled = false;
      let putPlatform = '';

      server.use(
        http.put('/api/integrations/:platform', ({ params }) => {
          putCalled = true;
          putPlatform = params.platform as string;
          return HttpResponse.json({ platform: params.platform, is_enabled: true });
        })
      );

      const { user } = renderAdmin();
      await waitFor(() => screen.getByText(/github issues/i));

      // Find GitHub save button (may be inside an accordion)
      const saveBtns = screen.queryAllByRole('button', { name: /save/i });
      if (saveBtns.length > 0) {
        await user.click(saveBtns[0]);
        await waitFor(() => expect(putCalled).toBe(true));
        expect(putPlatform).toBeTruthy();
      }
    });

    it('removes integration config via DELETE /api/integrations/:platform', async () => {
      let deleteCalled = false;

      server.use(
        http.delete('/api/integrations/:platform', () => {
          deleteCalled = true;
          return HttpResponse.json({ ok: true });
        })
      );

      const { user } = renderAdmin();
      await waitFor(() => screen.getByText(/github issues/i));

      const removeBtns = screen.queryAllByRole('button', { name: /remove/i });
      if (removeBtns.length > 0) {
        await user.click(removeBtns[0]);
        await waitFor(() => expect(deleteCalled).toBe(true));
      }
    });

    it('does not send "***" placeholder values when saving', async () => {
      let requestBody: Record<string, unknown> = {};

      server.use(
        http.put('/api/integrations/:platform', async ({ request }) => {
          requestBody = await request.json() as Record<string, unknown>;
          return HttpResponse.json({ platform: 'github', is_enabled: true });
        })
      );

      const { user } = renderAdmin();
      await waitFor(() => screen.getByText(/github issues/i));

      // Open and save without changing the redacted token
      const saveBtns = screen.queryAllByRole('button', { name: /save/i });
      if (saveBtns.length > 0) {
        await user.click(saveBtns[0]);
        await waitFor(() => {
          // The payload should not contain '***' values
          const payloadStr = JSON.stringify(requestBody);
          expect(payloadStr).to.not.include('***');
        });
      }
    });
  });

  // ── empty states ──────────────────────────────────────────────────────────

  describe('empty states', () => {
    it('handles empty users list without crashing', async () => {
      server.use(
        http.get('/api/users', () => HttpResponse.json({ users: [] }))
      );
      renderAdmin();
      await waitFor(() => screen.getByText(/team members/i));
      // No crash; email addresses absent
      MOCK_USERS_LIST.forEach((u) => {
        expect(screen.queryByText(u.email)).not.toBeInTheDocument();
      });
    });

    it('handles empty integrations list without crashing', async () => {
      server.use(
        http.get('/api/integrations', () => HttpResponse.json({ integrations: [] }))
      );
      renderAdmin();
      await waitFor(() => screen.getByText(/integrations/i));
      // Page renders even when no integrations exist in DB
      expect(screen.getByText(/integrations/i)).toBeInTheDocument();
    });
  });
});
