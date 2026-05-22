import React, { useState, FormEvent } from 'react';
import { login } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { Field, Button } from '../components/ui';

interface LoginViewProps {
  onSuccess: () => void;
}

export default function LoginView({ onSuccess }: LoginViewProps) {
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(email.trim(), password);
      setAuth(result.user as Parameters<typeof setAuth>[0], result.accessToken, result.refreshToken);
      onSuccess();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Login failed. Check your credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100vw',
        height: '100vh',
        background: 'var(--surface-dim)',
      }}
    >
      <div
        className="glass-panel"
        style={{ width: '400px', padding: '48px 40px', borderRadius: '16px' }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              fontWeight: 'bold',
              fontSize: '22px',
            }}
          >
            C
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: '24px',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              color: '#fff',
            }}
          >
            Carbon<span className="glow-text-cyan">Threat</span>
          </h1>
        </div>

        <p
          style={{
            margin: '0 0 32px',
            fontSize: '13px',
            color: 'var(--on-surface-muted)',
            letterSpacing: '0.3px',
          }}
        >
          Sign in to your workspace
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p
              role="alert"
              style={{
                margin: 'var(--space-4) 0 0',
                fontSize: 'var(--text-sm)',
                color: 'var(--error)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 77, 79, 0.08)',
                border: '1px solid rgba(255, 77, 79, 0.2)',
              }}
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            loading={loading}
            style={{ marginTop: 'var(--space-6)', width: '100%' }}
          >
            Sign In
          </Button>
        </form>

        <p
          style={{
            marginTop: '32px',
            fontSize: '12px',
            color: 'var(--on-surface-muted)',
            textAlign: 'center',
            lineHeight: '1.6',
          }}
        >
          First time? Use{' '}
          <code style={{ color: 'var(--primary)', fontSize: '11px' }}>POST /api/auth/local/bootstrap</code>
          {' '}to create the admin account.
        </p>
      </div>
    </div>
  );
}

