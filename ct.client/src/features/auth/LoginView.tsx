import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, ICONS, Button, Field, Input, PasswordInput } from '../../ui/primitives';
import { useAuthStore } from '../../store/authStore';

export default function LoginView() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('boss@carbon.local');
  const [pw, setPw] = useState('');

  function signIn() {
    // V2 backend auth is not wired yet; establish a demo session so the guarded
    // app is navigable. Replace with the real /api/v1 login in Phase 2 (Prompt 3.3).
    setAuth(
      { id: 'u1', email, role: 'admin', permissions: ['findings:read', 'findings:write', 'imports:write', 'connectors:write', 'admin:*'] },
      'demo-access',
      'demo-refresh',
    );
    navigate('/dashboard');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <span className="cd-brand-badge" style={{ width: 34, height: 34, borderRadius: 9 }}>
              <Icon path={ICONS.shield} size={19} strokeWidth={2.2} />
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Carbon Dojo</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px' }}>Sign in</h1>
          <p style={{ color: 'var(--text-2)', margin: '0 0 24px', fontSize: 14 }}>Access the vulnerability management console.</p>

          <div style={{ marginBottom: 16 }}>
            <Field label="Email">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="username" />
            </Field>
          </div>
          <div style={{ marginBottom: 20 }}>
            <Field label="Password">
              <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••••••" autoComplete="current-password"
                onKeyDown={(e) => { if (e.key === 'Enter') signIn(); }} />
            </Field>
          </div>

          <Button block onClick={signIn}>Sign in</Button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>or continue with</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" block onClick={signIn}>Okta SSO</Button>
            <Button variant="secondary" block onClick={signIn}>Azure AD</Button>
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, margin: '24px 0 0' }}>Protected by MFA · SOC 2 Type II</p>
        </div>
      </div>

      <div className="cd-login-brand" style={{
        flex: 1, background: 'linear-gradient(155deg, var(--accent) 0%, #3b2fb0 55%, #1c1840 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 56, color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.16, backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '26px 26px' }} />
        <div style={{ position: 'relative', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', opacity: 0.85 }}>CARBON DOJO</div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, maxWidth: 460 }}>Find it. Track it. Fix it before it ships.</div>
          <p style={{ fontSize: 15, opacity: 0.85, maxWidth: 420, margin: '18px 0 0', lineHeight: 1.6 }}>Enterprise penetration-testing &amp; vulnerability management — from first finding to closed remediation, across every asset.</p>
          <div style={{ display: 'flex', gap: 28, marginTop: 36 }}>
            <div><div style={{ fontSize: 26, fontWeight: 700 }}>22</div><div style={{ fontSize: 13, opacity: 0.8 }}>findings tracked</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 700 }}>5</div><div style={{ fontSize: 13, opacity: 0.8 }}>roles &amp; SSO</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 700 }}>AA</div><div style={{ fontSize: 13, opacity: 0.8 }}>WCAG contrast</div></div>
          </div>
        </div>
        <div style={{ position: 'relative', fontSize: 13, opacity: 0.7 }}>© 2026 Carbon Dojo · Acme Corp</div>
      </div>
    </div>
  );
}
