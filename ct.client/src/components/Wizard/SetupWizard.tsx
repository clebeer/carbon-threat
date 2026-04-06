import React, { useState } from 'react';

type DbType   = 'local' | 'external';
type AuthType = 'local' | 'saml';
type DbTestStatus = 'idle' | 'testing' | 'ok' | 'fail';

interface DbConfig   { type: DbType; host: string; port: string; user: string; password: string; name: string }
interface AdminConfig { email: string; displayName: string; password: string; confirmPassword: string }
interface SamlConfig  { entryPoint: string; issuer: string; cert: string }

const TOTAL_STEPS = 4;

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#fff', borderRadius: '4px', outline: 'none', fontSize: '14px',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px',
  color: 'var(--on-surface-muted)', marginBottom: '6px', letterSpacing: '0.3px',
};

const backBtnStyle: React.CSSProperties = {
  padding: '12px', background: 'transparent',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
  color: 'var(--on-surface-muted)', cursor: 'pointer', flex: '0 0 30%',
};

function primaryBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '12px', border: 'none', borderRadius: '6px',
    background: enabled ? 'var(--primary)' : 'rgba(0,242,255,0.18)',
    color: enabled ? '#000' : 'rgba(255,255,255,0.25)',
    fontWeight: 'bold', cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: '14px', transition: 'all 0.2s',
  };
}

function radioCard(selected: boolean, accent = 'var(--primary)'): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '16px',
    border: `1px solid ${selected ? accent : 'rgba(255,255,255,0.08)'}`,
    borderRadius: '8px', cursor: 'pointer',
    background: selected ? `rgba(${accent === 'var(--primary)' ? '0,242,255' : '179,102,255'},0.04)` : 'transparent',
    transition: 'all 0.2s',
  };
}

export default function SetupWizard({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [dbTest, setDbTest]     = useState<DbTestStatus>('idle');

  const [db, setDb]             = useState<DbConfig>({
    type: 'local', host: 'localhost', port: '5432', user: '', password: '', name: 'carbonthreat',
  });
  const [authType, setAuthType] = useState<AuthType>('local');
  const [admin, setAdmin]       = useState<AdminConfig>({ email: '', displayName: '', password: '', confirmPassword: '' });
  const [saml, setSaml]         = useState<SamlConfig>({ entryPoint: '', issuer: '', cert: '' });

  // ── helpers ────────────────────────────────────────────────────────────────

  function setDbField(patch: Partial<DbConfig>) {
    setDb((d: DbConfig) => ({ ...d, ...patch }));
    setDbTest('idle');
    setError(null);
  }

  async function testDbConnection() {
    setDbTest('testing');
    setError(null);
    try {
      const res = await fetch('/api/config/test-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: db.host, port: parseInt(db.port, 10) || 5432, user: db.user, password: db.password, name: db.name }),
      });
      if (res.ok) {
        setDbTest('ok');
      } else {
        const data = await res.json().catch(() => ({}));
        setDbTest('fail');
        setError(data.error || 'Connection failed');
      }
    } catch {
      setDbTest('fail');
      setError('Could not reach the server. Is it running?');
    }
  }

  async function handleFinish() {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        db,
        authType,
        admin: authType === 'local' ? { email: admin.email, displayName: admin.displayName || 'System Administrator', password: admin.password } : undefined,
        saml: authType === 'saml' ? saml : undefined,
      };
      const res = await fetch('/api/config/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Setup failed');
      localStorage.setItem('carbonthreat_setup_complete', 'true');
      if (onComplete) onComplete();
      else window.location.reload();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  const canAdvanceStep1 = () =>
    db.type === 'local' || (!!db.host && !!db.user && !!db.password && !!db.name && dbTest === 'ok');

  const canAdvanceStep3 = () =>
    authType === 'local'
      ? !!admin.email && admin.password.length >= 12 && admin.password === admin.confirmPassword
      : !!saml.entryPoint && !!saml.issuer && !!saml.cert;

  function advance(next: number) { setError(null); setStep(next); }

  // ── layout ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', background: 'var(--background)', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center' }}>
      <div
        className="glass-panel"
        style={{ width: '560px', padding: '40px', borderRadius: '12px', position: 'relative', overflow: 'hidden', background: 'var(--surface-container-high)', border: '1px solid rgba(0,242,255,0.15)', boxShadow: '0 0 80px rgba(0,0,0,0.6)' }}
      >
        {/* Progress bar */}
        <div style={{ display: 'flex', gap: '5px', position: 'absolute', top: 0, left: 0, right: 0, height: '3px' }}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              style={{ flex: 1, transition: 'background 0.4s', background: step > i + 1 ? 'var(--primary)' : step === i + 1 ? 'rgba(0,242,255,0.6)' : 'rgba(255,255,255,0.07)' }}
            />
          ))}
        </div>

        {/* Header */}
        <div style={{ marginTop: '8px', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '22px', fontFamily: 'var(--font-display)', color: '#fff', margin: '0 0 4px 0' }}>
            Carbon<span style={{ color: 'var(--primary)' }}>Threat</span> Enterprise
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--on-surface-muted)', margin: 0, fontFamily: 'var(--font-label)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
            System Initialization — Step {step} of {TOTAL_STEPS}
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ background: 'rgba(255,77,79,0.08)', border: '1px solid var(--error)', padding: '12px 16px', borderRadius: '6px', color: 'var(--error)', marginBottom: '20px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {/* ── STEP 1: DATABASE ───────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <p style={{ fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: '18px', fontFamily: 'var(--font-label)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              1. Database Configuration
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {(['local', 'external'] as DbType[]).map(opt => (
                <label key={opt} style={radioCard(db.type === opt)} onClick={() => setDbField({ type: opt })}>
                  <input type="radio" readOnly checked={db.type === opt} style={{ marginTop: '2px', accentColor: 'var(--primary)', flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px', marginBottom: '3px' }}>
                      {opt === 'local' ? 'Local PostgreSQL' : 'External PostgreSQL'}
                    </div>
                    <div style={{ color: 'var(--on-surface-muted)', fontSize: '12px', lineHeight: 1.5 }}>
                      {opt === 'local'
                        ? 'Use a locally running database on localhost:5432. Ideal for single-server and development deployments.'
                        : 'Connect to an existing PostgreSQL server on your network or cloud. Required for HA and production environments.'}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {db.type === 'external' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 3 }}>
                    <label style={labelStyle}>Host</label>
                    <input type="text" value={db.host} onChange={e => setDbField({ host: e.target.value })} placeholder="db.example.com" style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Port</label>
                    <input type="number" value={db.port} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDbField({ port: e.target.value })} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Username</label>
                    <input type="text" value={db.user} onChange={e => setDbField({ user: e.target.value })} placeholder="carbonthreat_user" style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Password</label>
                    <input type="password" value={db.password} onChange={e => setDbField({ password: e.target.value })} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Database Name</label>
                  <input type="text" value={db.name} onChange={e => setDbField({ name: e.target.value })} placeholder="carbonthreat" style={inputStyle} />
                </div>

                <button
                  onClick={testDbConnection}
                  disabled={dbTest === 'testing' || !db.host || !db.user || !db.password || !db.name}
                  style={{
                    padding: '10px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
                    fontFamily: 'var(--font-label)', letterSpacing: '0.5px', transition: 'all 0.2s',
                    border: `1px solid ${dbTest === 'ok' ? '#52c41a' : dbTest === 'fail' ? 'var(--error)' : 'rgba(0,242,255,0.4)'}`,
                    background: 'transparent',
                    color: dbTest === 'ok' ? '#52c41a' : dbTest === 'fail' ? 'var(--error)' : 'var(--primary)',
                  }}
                >
                  {dbTest === 'testing' ? 'Testing connection…'
                    : dbTest === 'ok'   ? '✓  Connection successful'
                    : dbTest === 'fail' ? '✗  Failed — retry'
                    :                    'Test Connection'}
                </button>

                {dbTest !== 'ok' && (
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--on-surface-muted)' }}>
                    You must verify the connection before continuing.
                  </p>
                )}
              </div>
            )}

            <button onClick={() => advance(2)} disabled={!canAdvanceStep1()} style={primaryBtnStyle(canAdvanceStep1())}>
              Continue to Authentication →
            </button>
          </div>
        )}

        {/* ── STEP 2: AUTH TYPE ──────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <p style={{ fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: '18px', fontFamily: 'var(--font-label)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              2. Authentication System
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {([['local', 'var(--primary)'], ['saml', 'var(--secondary)']] as [AuthType, string][]).map(([opt, accent]) => (
                <label key={opt} style={radioCard(authType === opt, accent)} onClick={() => setAuthType(opt)}>
                  <input type="radio" readOnly checked={authType === opt} style={{ marginTop: '2px', accentColor: accent, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px', marginBottom: '3px' }}>
                      {opt === 'local' ? 'Local Authentication' : 'Enterprise SSO (SAML 2.0)'}
                    </div>
                    <div style={{ color: 'var(--on-surface-muted)', fontSize: '12px', lineHeight: 1.5 }}>
                      {opt === 'local'
                        ? 'Built-in user management with roles and bcrypt-hashed passwords stored in the local database.'
                        : 'Delegate identity to an existing IdP — Azure AD, Okta, Ping Identity, or any SAML 2.0-compliant provider.'}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setStep(1)} style={backBtnStyle}>← Back</button>
              <button onClick={() => advance(3)} style={primaryBtnStyle(true)}>
                {authType === 'local' ? 'Configure Admin Account →' : 'Configure SAML 2.0 →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3a: LOCAL ADMIN ───────────────────────────────────────────── */}
        {step === 3 && authType === 'local' && (
          <div>
            <p style={{ fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: '18px', fontFamily: 'var(--font-label)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              3. Administrator Account
            </p>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-muted)', marginBottom: '20px' }}>
              This account will have full administrative access. Additional users and roles can be configured after initialization.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px' }}>
              <div>
                <label style={labelStyle}>Display Name</label>
                <input type="text" value={admin.displayName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdmin((a: AdminConfig) => ({ ...a, displayName: e.target.value }))} placeholder="System Administrator" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email Address *</label>
                <input type="email" value={admin.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdmin((a: AdminConfig) => ({ ...a, email: e.target.value }))} placeholder="admin@carbonthreat.io" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>
                  Password *&nbsp;
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400 }}>(min. 12 characters)</span>
                </label>
                <input type="password" value={admin.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdmin((a: AdminConfig) => ({ ...a, password: e.target.value }))} style={inputStyle} />
                {admin.password.length > 0 && admin.password.length < 12 && (
                  <span style={{ display: 'block', marginTop: '5px', fontSize: '11px', color: 'var(--error)' }}>
                    {12 - admin.password.length} characters short
                  </span>
                )}
              </div>
              <div>
                <label style={labelStyle}>Confirm Password *</label>
                <input type="password" value={admin.confirmPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdmin((a: AdminConfig) => ({ ...a, confirmPassword: e.target.value }))} style={inputStyle} />
                {admin.confirmPassword.length > 0 && admin.password !== admin.confirmPassword && (
                  <span style={{ display: 'block', marginTop: '5px', fontSize: '11px', color: 'var(--error)' }}>Passwords do not match</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setStep(2)} style={backBtnStyle}>← Back</button>
              <button
                onClick={() => {
                  if (!admin.email) { setError('Email address is required'); return; }
                  if (admin.password.length < 12) { setError('Password must be at least 12 characters'); return; }
                  if (admin.password !== admin.confirmPassword) { setError('Passwords do not match'); return; }
                  advance(4);
                }}
                style={primaryBtnStyle(canAdvanceStep3())}
              >
                Review Setup →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3b: SAML CONFIG ───────────────────────────────────────────── */}
        {step === 3 && authType === 'saml' && (
          <div>
            <p style={{ fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: '18px', fontFamily: 'var(--font-label)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              3. SAML 2.0 Identity Provider
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={labelStyle}>SSO Entry Point URL *</label>
                <input type="url" value={saml.entryPoint} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSaml((s: SamlConfig) => ({ ...s, entryPoint: e.target.value }))} placeholder="https://login.microsoftonline.com/…/saml2" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Issuer / Entity ID *</label>
                <input type="text" value={saml.issuer} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSaml((s: SamlConfig) => ({ ...s, issuer: e.target.value }))} placeholder="https://carbonthreat.example.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>IdP Certificate (PEM) *</label>
                <textarea
                  value={saml.cert}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSaml((s: SamlConfig) => ({ ...s, cert: e.target.value }))}
                  placeholder={'-----BEGIN CERTIFICATE-----\nMIIDB…\n-----END CERTIFICATE-----'}
                  rows={5}
                  style={{ ...inputStyle, height: 'auto', resize: 'vertical', fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.6 }}
                />
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: 'rgba(179,102,255,0.05)', border: '1px solid rgba(179,102,255,0.2)', borderRadius: '6px', fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: '20px' }}>
              Your SP metadata will be available at&nbsp;
              <span style={{ color: 'var(--secondary)', fontFamily: 'monospace' }}>/api/auth/sso/saml/metadata</span>
              &nbsp;after initialization. Register this URL as the ACS endpoint in your IdP.
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setStep(2)} style={backBtnStyle}>← Back</button>
              <button
                onClick={() => {
                  if (!saml.entryPoint) { setError('SSO Entry Point URL is required'); return; }
                  if (!saml.issuer)     { setError('Issuer / Entity ID is required'); return; }
                  if (!saml.cert)       { setError('IdP Certificate is required'); return; }
                  advance(4);
                }}
                style={{ ...primaryBtnStyle(canAdvanceStep3()), background: canAdvanceStep3() ? 'var(--secondary)' : 'rgba(179,102,255,0.18)' }}
              >
                Review Setup →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: REVIEW & INITIALIZE ────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <p style={{ fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: '18px', fontFamily: 'var(--font-label)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              4. Review & Initialize
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
              {[
                {
                  label: 'Database',
                  value: db.type === 'local'
                    ? 'Local PostgreSQL (localhost:5432)'
                    : `${db.user}@${db.host}:${db.port}/${db.name}`,
                  accent: 'var(--primary)',
                },
                {
                  label: 'Authentication',
                  value: authType === 'local' ? 'Local — built-in user management' : 'Enterprise SSO (SAML 2.0)',
                  accent: authType === 'local' ? 'var(--primary)' : 'var(--secondary)',
                },
                authType === 'local'
                  ? { label: 'Admin Account', value: admin.email, accent: 'var(--on-surface-muted)' }
                  : { label: 'SAML Entry Point', value: saml.entryPoint, accent: 'var(--secondary)' },
              ].map(row => (
                <div
                  key={row.label}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', gap: '16px' }}
                >
                  <span style={{ fontSize: '12px', color: 'var(--on-surface-muted)', fontFamily: 'var(--font-label)', letterSpacing: '0.5px', flexShrink: 0 }}>
                    {row.label}
                  </span>
                  <span style={{ fontSize: '13px', color: row.accent, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Cloud Storage — next release notice */}
            <div style={{ padding: '10px 14px', background: 'rgba(179,102,255,0.04)', border: '1px solid rgba(179,102,255,0.15)', borderRadius: '6px', marginBottom: '16px', fontSize: '12px', color: 'var(--on-surface-muted)', lineHeight: 1.6 }}>
              <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>Cloud Storage (Google Drive / OneDrive)</span>
              {' '}— OAuth credentials will be configurable in Settings after initialization. Available in the next release.
            </div>

            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginBottom: '20px', lineHeight: 1.6 }}>
              The system will run database migrations and write the configuration to the application store. This may take a few seconds.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setStep(3)} disabled={loading} style={backBtnStyle}>← Back</button>
              <button
                onClick={handleFinish}
                disabled={loading}
                style={{ ...primaryBtnStyle(!loading), opacity: loading ? 0.65 : 1 }}
              >
                {loading ? 'Initializing…' : 'Initialize CarbonThreat'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
