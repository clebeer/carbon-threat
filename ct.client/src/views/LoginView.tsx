import React, { useState, FormEvent } from 'react';
import { login } from '../api/auth';
import { useAuthStore } from '../store/authStore';

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
          {/* Email */}
          <label
            htmlFor="ct-email"
            style={{ display: 'block', fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: '6px', letterSpacing: '0.5px' }}
          >
            EMAIL
          </label>
          <input
            id="ct-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          {/* Password */}
          <label
            htmlFor="ct-password"
            style={{ display: 'block', fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: '6px', marginTop: '20px', letterSpacing: '0.5px' }}
          >
            PASSWORD
          </label>
          <input
            id="ct-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          {/* Error */}
          {error && (
            <p
              style={{
                margin: '16px 0 0',
                fontSize: '13px',
                color: 'var(--error)',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 77, 79, 0.08)',
                border: '1px solid rgba(255, 77, 79, 0.2)',
              }}
            >
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '28px',
              width: '100%',
              padding: '13px',
              borderRadius: '8px',
              border: 'none',
              background: loading ? 'rgba(0, 242, 255, 0.4)' : 'var(--primary)',
              color: '#000',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.5px',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 14px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: '#e2e8f0',
  fontSize: '14px',
  outline: 'none',
  fontFamily: 'var(--font-display)',
};
