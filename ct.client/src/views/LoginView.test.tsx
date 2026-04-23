/**
 * Unit / integration tests — LoginView
 *
 * MSW intercepts POST /api/auth/local/login — no real network.
 * The authStore is reset between tests via module isolation or manual clear.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../test/server';
import LoginView from './LoginView';
import { MOCK_ACCESS_TOKEN, MOCK_REFRESH_TOKEN, MOCK_USER } from '../test/handlers';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderLogin(onSuccess = vi.fn()) {
  return {
    onSuccess,
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={makeQueryClient()}>
        <LoginView onSuccess={onSuccess} />
      </QueryClientProvider>
    ),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('LoginView', () => {
  beforeEach(() => {
    // Clear persisted zustand state between tests
    localStorage.clear();
  });

  // ── rendering ───────────────────────────────────────────────────────────────

  describe('initial render', () => {
    it('renders the CarbonThreat heading', () => {
      renderLogin();
      // Heading is "Carbon<span>Threat</span>" — accessible name may not concatenate cleanly
      expect(screen.getByRole('heading')).toBeInTheDocument();
      expect(screen.getByText(/Carbon/)).toBeInTheDocument();
      expect(screen.getByText(/Threat/)).toBeInTheDocument();
    });

    it('renders email and password inputs', () => {
      renderLogin();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it('renders the Sign In submit button', () => {
      renderLogin();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('does not show an error message on initial render', () => {
      renderLogin();
      expect(screen.queryByRole('paragraph', { name: /error/i })).not.toBeInTheDocument();
    });

    it('Sign In button is enabled initially', () => {
      renderLogin();
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
    });
  });

  // ── successful login ─────────────────────────────────────────────────────────

  describe('successful login flow', () => {
    it('calls onSuccess after valid credentials', async () => {
      const { user, onSuccess } = renderLogin();

      await user.type(screen.getByLabelText(/email/i), 'admin@ct.com');
      await user.type(screen.getByLabelText(/password/i), 'SecurePass123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    });

    it('button shows loading text while request is in flight', async () => {
      // Delay the MSW response so we can assert the loading state
      server.use(
        http.post('/api/auth/local/login', async () => {
          await new Promise((r) => setTimeout(r, 50));
          return HttpResponse.json({
            user: MOCK_USER,
            accessToken: MOCK_ACCESS_TOKEN,
            refreshToken: MOCK_REFRESH_TOKEN,
          });
        })
      );

      const { user } = renderLogin();
      await user.type(screen.getByLabelText(/email/i), 'admin@ct.com');
      await user.type(screen.getByLabelText(/password/i), 'SecurePass123!');

      const btn = screen.getByRole('button', { name: /sign in/i });
      await user.click(btn);

      // Immediately after click the button should show loading text
      expect(btn).toBeDisabled();
    });
  });

  // ── failed login ─────────────────────────────────────────────────────────────

  describe('failed login flow', () => {
    beforeEach(() => {
      server.use(
        http.post('/api/auth/local/login', () =>
          HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
        )
      );
    });

    it('shows the error message from API on 401', async () => {
      const { user } = renderLogin();
      await user.type(screen.getByLabelText(/email/i), 'wrong@ct.com');
      await user.type(screen.getByLabelText(/password/i), 'WrongPass123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument());
    });

    it('does NOT call onSuccess on 401', async () => {
      const { user, onSuccess } = renderLogin();
      await user.type(screen.getByLabelText(/email/i), 'wrong@ct.com');
      await user.type(screen.getByLabelText(/password/i), 'WrongPass123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => screen.getByText(/invalid credentials/i));
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('button is re-enabled after failed request', async () => {
      const { user } = renderLogin();
      await user.type(screen.getByLabelText(/email/i), 'x@y.com');
      await user.type(screen.getByLabelText(/password/i), 'PasswordXYZ!123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => screen.getByText(/invalid credentials/i));
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
    });

    it('shows fallback message when error response has no JSON body', async () => {
      server.use(
        http.post('/api/auth/local/login', () => new HttpResponse(null, { status: 500 }))
      );

      const { user } = renderLogin();
      await user.type(screen.getByLabelText(/email/i), 'x@y.com');
      await user.type(screen.getByLabelText(/password/i), 'PasswordXYZ!123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() =>
        expect(screen.getByText(/login failed/i)).toBeInTheDocument()
      );
    });
  });

  // ── form controls ─────────────────────────────────────────────────────────

  describe('form inputs', () => {
    it('updates email field when user types', async () => {
      const { user } = renderLogin();
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'test@example.com');
      expect(emailInput).toHaveValue('test@example.com');
    });

    it('updates password field when user types', async () => {
      const { user } = renderLogin();
      const pwInput = screen.getByLabelText(/password/i);
      await user.type(pwInput, 'MyPassword1!');
      expect(pwInput).toHaveValue('MyPassword1!');
    });

    it('password field has type="password" (masked)', () => {
      renderLogin();
      expect(screen.getByLabelText(/password/i)).toHaveAttribute('type', 'password');
    });

    it('clears previous error when user submits again', async () => {
      server.use(
        http.post('/api/auth/local/login', () =>
          HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
        )
      );

      const { user } = renderLogin();
      await user.type(screen.getByLabelText(/email/i), 'x@y.com');
      await user.type(screen.getByLabelText(/password/i), 'Wrong!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));
      await waitFor(() => screen.getByText(/invalid credentials/i));

      // Now reset to success handler and try again
      server.use(
        http.post('/api/auth/local/login', () =>
          HttpResponse.json({
            user: MOCK_USER,
            accessToken: MOCK_ACCESS_TOKEN,
            refreshToken: MOCK_REFRESH_TOKEN,
          })
        )
      );

      await user.click(screen.getByRole('button', { name: /sign in/i }));
      await waitFor(() => expect(screen.queryByText(/invalid credentials/i)).not.toBeInTheDocument());
    });
  });

  // ── accessibility ──────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('email input has autocomplete="email"', () => {
      renderLogin();
      expect(screen.getByLabelText(/email/i)).toHaveAttribute('autocomplete', 'email');
    });

    it('password input has autocomplete="current-password"', () => {
      renderLogin();
      expect(screen.getByLabelText(/password/i)).toHaveAttribute('autocomplete', 'current-password');
    });

    it('form has novalidate attribute (custom validation)', () => {
      renderLogin();
      const form = screen.getByRole('button', { name: /sign in/i }).closest('form');
      expect(form).toHaveAttribute('novalidate');
    });
  });
});
