import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { listUsers, createUser, updateUser, deactivateUser, type User, type UserRole } from '../api/users';
import {
  listIntegrations,
  upsertIntegration,
  deleteIntegration,
  type Platform,
  type IntegrationSummary,
} from '../api/integrations';
import { useAuthStore } from '../store/authStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SmtpConfig {
  host: string; port: string; user: string; password: string; from: string; secure: boolean;
}

interface AuditLog {
  id: number; action: string; entity_type: string; entity_id?: string;
  user_id?: string; ip_address?: string; http_status?: number; created_at: string;
}

interface RbacProfile {
  name: string;
  description: string;
  permissions: string[];
}

// ── Shared style helpers ──────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#e2e8f0', borderRadius: '6px', fontSize: '13px', outline: 'none',
};

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: '11px', color: 'var(--on-surface-muted)',
  marginBottom: '5px', letterSpacing: '0.5px', textTransform: 'uppercase' as const,
};

const sectionTitle = (text: string, accent = 'var(--primary)'): React.ReactNode => (
  <h3 style={{ fontSize: '12px', color: accent, letterSpacing: '1px', margin: '0 0 18px 0', fontFamily: 'var(--font-label)' }}>
    {text}
  </h3>
);

// ── RBAC profiles (built-in + custom) ────────────────────────────────────────

const BUILT_IN_PROFILES: RbacProfile[] = [
  { name: 'Administrator', description: 'Full system access — manage users, integrations, and all models', permissions: ['users:*', 'models:*', 'integrations:*', 'audit:read', 'config:*'] },
  { name: 'Security Architect', description: 'Create and edit threat models; run AI analysis', permissions: ['models:read', 'models:write', 'ai:suggest', 'integrations:read'] },
  { name: 'Auditor / Viewer', description: 'Read-only access to models and reports', permissions: ['models:read', 'reports:read'] },
];

function roleBadgeColor(role: UserRole): string {
  switch (role) {
    case 'admin':   return 'var(--primary)';
    case 'analyst': return 'var(--secondary)';
    case 'viewer':  return 'var(--on-surface-muted)';
    default:        return '#f59e0b';
  }
}

// ── Tab: SMTP ─────────────────────────────────────────────────────────────────

function SmtpTab() {
  const [cfg, setCfg] = useState<SmtpConfig>({ host: '', port: '587', user: '', password: '', from: '', secure: false });
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  // Load existing config
  useQuery({
    queryKey: ['smtp-config'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ smtp?: SmtpConfig }>('/config/smtp');
      if (data.smtp) setCfg({ ...data.smtp, password: '' }); // never pre-fill password
      return data;
    },
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: async () => { await apiClient.put('/config/smtp', cfg); },
    onSuccess: () => { setSaved(true); setErr(null); setTimeout(() => setSaved(false), 3000); },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      setErr(e?.response?.data?.error ?? 'Save failed'),
  });

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setTestMsg(null);
    try {
      const { data } = await apiClient.post<{ ok: boolean; sentTo?: string }>('/config/smtp/test', {
        ...cfg,
        to: 'clebeer@cle.beer' // Direct testing email requested by user
      });
      setTestResult('ok');
      setTestMsg(data.sentTo ? `Email sent to ${data.sentTo}` : 'Test email sent successfully');
    } catch (e: unknown) {
      setTestResult('fail');
      const axiosErr = e as { response?: { data?: { error?: string } } };
      setTestMsg(axiosErr?.response?.data?.error ?? 'SMTP connection failed — check host, port and credentials');
    } finally {
      setTesting(false);
    }
  }

  function field(k: keyof SmtpConfig, label: string, type = 'text', placeholder = '') {
    if (k === 'secure') return null;
    return (
      <div key={k}>
        <label style={labelSt}>{label}</label>
        <input
          type={type}
          placeholder={placeholder}
          value={cfg[k] as string}
          onChange={e => setCfg(c => ({ ...c, [k]: e.target.value }))}
          style={inputSt}
        />
      </div>
    );
  }

  return (
    <div>
      {sectionTitle('OUTBOUND EMAIL (SMTP)')}
      <p style={{ fontSize: '13px', color: 'var(--on-surface-muted)', marginBottom: '24px' }}>
        Used for user invitations, password resets, and scheduled report delivery.
      </p>

      <div style={{ display: 'grid', gap: '14px', maxWidth: '520px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelSt}>SMTP Host</label>
            <input type="text" placeholder="smtp.sendgrid.net" value={cfg.host}
              onChange={e => setCfg(c => ({ ...c, host: e.target.value }))} style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Port</label>
            <input type="number" value={cfg.port}
              onChange={e => setCfg(c => ({ ...c, port: e.target.value }))} style={inputSt} />
          </div>
        </div>

        {field('user', 'Username', 'text', 'apikey')}
        {field('password', 'Password / API Key', 'password', '••••••••')}
        {field('from', 'From Address', 'email', 'no-reply@carbonthreat.io')}

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: 'var(--on-surface-muted)' }}>
          <div
            onClick={() => setCfg(c => ({ ...c, secure: !c.secure }))}
            style={{ width: '34px', height: '18px', borderRadius: '9px', background: cfg.secure ? 'var(--primary)' : 'rgba(255,255,255,0.15)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
          >
            <div style={{ width: '13px', height: '13px', borderRadius: '50%', background: '#000', position: 'absolute', top: '2.5px', left: cfg.secure ? '19px' : '2px', transition: 'left 0.2s' }} />
          </div>
          Require TLS / SSL
        </label>

        {err && <p style={{ margin: 0, fontSize: '12px', color: 'var(--error)' }}>{err}</p>}

        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            style={{ flex: 2, padding: '10px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: '#000', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
          >
            {saveMutation.isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save Configuration'}
          </button>
          <button
            onClick={handleTest}
            disabled={testing || !cfg.host}
            style={{ flex: 1, padding: '10px', borderRadius: '6px', border: `1px solid ${testResult === 'ok' ? '#52c41a' : testResult === 'fail' ? 'var(--error)' : 'rgba(255,255,255,0.15)'}`, background: 'transparent', color: testResult === 'ok' ? '#52c41a' : testResult === 'fail' ? 'var(--error)' : 'var(--on-surface-muted)', fontSize: '13px', cursor: testing || !cfg.host ? 'not-allowed' : 'pointer' }}
          >
            {testing ? 'Testing…' : testResult === 'ok' ? '✓ OK' : testResult === 'fail' ? '✗ Failed' : 'Send Test'}
          </button>
        </div>

        {testMsg && (
          <p style={{ margin: 0, fontSize: '12px', color: testResult === 'ok' ? '#52c41a' : 'var(--error)', padding: '8px 10px', background: testResult === 'ok' ? 'rgba(82,196,26,0.08)' : 'rgba(255,77,79,0.08)', borderRadius: '4px', border: `1px solid ${testResult === 'ok' ? 'rgba(82,196,26,0.25)' : 'rgba(255,77,79,0.25)'}` }}>
            {testMsg}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Tab: RBAC Profiles ───────────────────────────────────────────────────────

function RbacTab() {
  return (
    <div>
      {sectionTitle('ACCESS CONTROL PROFILES')}
      <p style={{ fontSize: '13px', color: 'var(--on-surface-muted)', marginBottom: '24px' }}>
        Built-in roles map to the user role field. Custom profiles are planned for a future release.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {BUILT_IN_PROFILES.map((p) => (
          <div
            key={p.name}
            className="glass-panel"
            style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', color: '#fff', fontWeight: 600, marginBottom: '4px' }}>{p.name}</div>
              <div style={{ fontSize: '13px', color: 'var(--on-surface-muted)', marginBottom: '10px' }}>{p.description}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {p.permissions.map((perm) => (
                  <span
                    key={perm}
                    style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,242,255,0.06)', color: 'var(--primary)', border: '1px solid rgba(0,242,255,0.18)', fontFamily: 'monospace' }}
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: 'var(--on-surface-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Built-in
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '24px', padding: '16px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--on-surface-muted)' }}>
          Custom role profiles — coming in a future release. Open a GitHub issue to request specific permission sets.
        </p>
      </div>
    </div>
  );
}

// ── Tab: Users ────────────────────────────────────────────────────────────────

interface InviteForm { email: string; display_name: string; password: string; role: UserRole }

function UsersTab() {
  const qc = useQueryClient();
  const currentUser = useAuthStore(s => s.user);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InviteForm>({ email: '', display_name: '', password: '', role: 'analyst' });
  const [formErr, setFormErr] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: listUsers });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowForm(false); setForm({ email: '', display_name: '', password: '', role: 'analyst' }); setFormErr(null); },
    onError: (e: { response?: { data?: { error?: string } } }) => setFormErr(e?.response?.data?.error ?? 'Failed'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => updateUser(id, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditingId(null); },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        {sectionTitle('USER MANAGEMENT')}
        <button
          onClick={() => { setShowForm(v => !v); setFormErr(null); }}
          style={{ padding: '8px 16px', borderRadius: '6px', border: '1px dashed var(--primary)', background: showForm ? 'rgba(0,242,255,0.1)' : 'transparent', color: 'var(--primary)', fontSize: '12px', cursor: 'pointer', letterSpacing: '0.5px', marginBottom: '18px' }}
        >
          {showForm ? 'Cancel' : '+ Invite User'}
        </button>
      </div>

      {showForm && (
        <div style={{ padding: '18px', marginBottom: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: '12px', maxWidth: '480px' }}>
          {(['email', 'display_name', 'password'] as const).map(f => (
            <div key={f}>
              <label style={labelSt}>{f === 'display_name' ? 'Display Name (optional)' : f === 'password' ? 'Initial Password' : 'Email Address'}</label>
              <input
                type={f === 'password' ? 'password' : f === 'email' ? 'email' : 'text'}
                value={form[f]}
                onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                style={inputSt}
              />
            </div>
          ))}
          <div>
            <label style={labelSt}>Role</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}
              style={{ ...inputSt, background: '#12161f' }}>
              <option value="admin">Administrator</option>
              <option value="analyst">Security Architect</option>
              <option value="viewer">Auditor / Viewer</option>
            </select>
          </div>
          {formErr && <p style={{ margin: 0, fontSize: '12px', color: 'var(--error)' }}>{formErr}</p>}
          <button
            onClick={() => { setFormErr(null); createMutation.mutate(form); }}
            disabled={createMutation.isPending || !form.email || !form.password}
            style={{ padding: '9px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: '#000', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
          >
            {createMutation.isPending ? 'Creating…' : 'Create & Send Invite'}
          </button>
        </div>
      )}

      {isLoading && <p style={{ color: 'var(--on-surface-muted)', fontSize: '13px' }}>Loading…</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {users.map((u: User) => (
          <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', opacity: u.is_active ? 1 : 0.5 }}>
            <div>
              <div style={{ fontSize: '14px', color: '#e2e8f0', fontWeight: 500 }}>
                {u.display_name || u.email}
                {!u.is_active && <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--error)' }}>INACTIVE</span>}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)' }}>{u.email}</div>
              {u.last_login_at && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>Last login: {new Date(u.last_login_at).toLocaleDateString()}</div>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {editingId === u.id ? (
                <select
                  defaultValue={u.role}
                  autoFocus
                  onBlur={e => { updateRoleMutation.mutate({ id: u.id, role: e.target.value as UserRole }); }}
                  onChange={e => updateRoleMutation.mutate({ id: u.id, role: e.target.value as UserRole })}
                  style={{ ...inputSt, width: 'auto', padding: '5px 8px', fontSize: '12px', background: '#12161f' }}
                >
                  <option value="admin">Administrator</option>
                  <option value="analyst">Analyst</option>
                  <option value="viewer">Viewer</option>
                </select>
              ) : (
                <span
                  onClick={() => u.id !== currentUser?.id && setEditingId(u.id)}
                  title={u.id !== currentUser?.id ? 'Click to change role' : undefined}
                  style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: roleBadgeColor(u.role), cursor: u.id !== currentUser?.id ? 'pointer' : 'default', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {u.role}
                </span>
              )}

              {u.is_active && u.id !== currentUser?.id && (
                <button
                  onClick={() => { if (confirm(`Deactivate ${u.email}?`)) deactivateMutation.mutate(u.id); }}
                  title="Deactivate"
                  style={{ background: 'transparent', border: 'none', color: 'rgba(255,77,79,0.6)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 4px' }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Integrations ─────────────────────────────────────────────────────────

const PLATFORM_META: Record<Platform, { label: string; fields: { key: string; label: string; placeholder: string; type?: string }[] }> = {
  github:     { label: 'GitHub Issues',       fields: [{ key: 'token', label: 'Personal Access Token', placeholder: 'ghp_…', type: 'password' }, { key: 'repo', label: 'Repository', placeholder: 'owner/repo' }] },
  jira:       { label: 'Jira Software',        fields: [{ key: 'serverUrl', label: 'Server URL', placeholder: 'https://org.atlassian.net' }, { key: 'email', label: 'Email', placeholder: 'you@example.com' }, { key: 'token', label: 'API Token', placeholder: '…', type: 'password' }, { key: 'projectKey', label: 'Project Key', placeholder: 'SEC' }] },
  servicenow: { label: 'ServiceNow',           fields: [{ key: 'serverUrl', label: 'Instance URL', placeholder: 'https://org.service-now.com' }, { key: 'username', label: 'Username', placeholder: 'admin' }, { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' }] },
  openai:     { label: 'OpenAI (Threat Bot)',  fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'sk-…', type: 'password' }, { key: 'model', label: 'Model', placeholder: 'gpt-4-turbo-preview' }] },
  ollama:     { label: 'Ollama / LM Studio',   fields: [{ key: 'url', label: 'Endpoint URL', placeholder: 'http://localhost:11434/v1/chat/completions' }, { key: 'model', label: 'Model name', placeholder: 'llama3' }] },
  jules:      { label: 'Google Jules (AI Agent)', fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'AIza…', type: 'password' }] },
};

function IntegrationCard({ platform, existing }: { platform: Platform; existing: IntegrationSummary | undefined }) {
  const meta = PLATFORM_META[platform];
  const qc   = useQueryClient();
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    meta.fields.forEach(f => { init[f.key] = existing?.config?.[f.key] ?? ''; });
    return init;
  });
  const [enabled, setEnabled] = useState(existing?.is_enabled ?? true);
  const [err, setErr] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {};
      meta.fields.forEach(f => { if (vals[f.key] && vals[f.key] !== '***') payload[f.key] = vals[f.key]; });
      return upsertIntegration(platform, payload, enabled);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['integrations'] }); setOpen(false); },
    onError: (e: { response?: { data?: { error?: string } } }) => setErr(e?.response?.data?.error ?? 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteIntegration(platform),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['integrations'] }); setOpen(false); },
  });

  const isActive = existing?.is_enabled ?? false;

  return (
    <div style={{ borderRadius: '8px', border: `1px solid ${open ? 'rgba(179,102,255,0.35)' : 'rgba(255,255,255,0.07)'}`, background: open ? 'rgba(179,102,255,0.03)' : 'rgba(255,255,255,0.02)', transition: 'all 0.2s' }}>
      <div onClick={() => setOpen(v => !v)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isActive ? 'var(--primary)' : 'rgba(255,255,255,0.15)', boxShadow: isActive ? '0 0 6px var(--primary)' : 'none' }} />
          <span style={{ color: '#e2e8f0', fontSize: '14px' }}>{meta.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {existing && (
            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: isActive ? 'rgba(0,242,255,0.08)' : 'rgba(255,255,255,0.05)', color: isActive ? 'var(--primary)' : 'var(--on-surface-muted)', border: `1px solid ${isActive ? 'rgba(0,242,255,0.2)' : 'rgba(255,255,255,0.1)'}` }}>
              {isActive ? 'ENABLED' : 'DISABLED'}
            </span>
          )}
          <span style={{ color: 'var(--on-surface-muted)', fontSize: '16px', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>›</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ display: 'grid', gap: '10px' }}>
            {meta.fields.map(f => (
              <div key={f.key}>
                <label style={labelSt}>{f.label}</label>
                <input
                  type={f.type ?? 'text'}
                  placeholder={f.placeholder}
                  value={vals[f.key]}
                  onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                  style={inputSt}
                />
              </div>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div onClick={() => setEnabled(v => !v)} style={{ width: '34px', height: '18px', borderRadius: '9px', background: enabled ? 'var(--primary)' : 'rgba(255,255,255,0.15)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ width: '13px', height: '13px', borderRadius: '50%', background: '#000', position: 'absolute', top: '2.5px', left: enabled ? '19px' : '2px', transition: 'left 0.2s' }} />
              </div>
              <span style={{ fontSize: '12px', color: enabled ? 'var(--primary)' : 'var(--on-surface-muted)' }}>{enabled ? 'Enabled' : 'Disabled'}</span>
            </div>

            {err && <p style={{ margin: 0, fontSize: '12px', color: 'var(--error)' }}>{err}</p>}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} style={{ flex: 2, padding: '8px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: '#000', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              {existing && (
                <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,77,79,0.3)', background: 'transparent', color: 'var(--error)', fontSize: '12px', cursor: 'pointer' }}>
                  {deleteMutation.isPending ? '…' : 'Remove'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IntegrationsTab() {
  const { data: integrations = [], isLoading } = useQuery<IntegrationSummary[]>({
    queryKey: ['integrations'],
    queryFn: listIntegrations,
  });

  const cfgMap = Object.fromEntries(integrations.map(i => [i.platform, i])) as Record<Platform, IntegrationSummary | undefined>;

  return (
    <div>
      {sectionTitle('THIRD-PARTY INTEGRATIONS', 'var(--secondary)')}
      <p style={{ fontSize: '13px', color: 'var(--on-surface-muted)', marginBottom: '24px' }}>
        Credentials are encrypted with AES-256-GCM before storage. Revoke via the Remove button.
      </p>

      {isLoading ? (
        <p style={{ color: 'var(--on-surface-muted)', fontSize: '13px' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(Object.keys(PLATFORM_META) as Platform[]).map(p => (
            <IntegrationCard key={p} platform={p} existing={cfgMap[p]} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Audit Logs ───────────────────────────────────────────────────────────

function AuditTab() {
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isLoading, isError } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ['audit-logs', page],
    queryFn: async () => {
      const { data } = await apiClient.get<{ logs: AuditLog[]; total: number }>(
        `/audit?page=${page}&limit=${limit}`
      );
      return data;
    },
    retry: false,
  });

  const logs  = data?.logs ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));

  function actionColor(action: string): string {
    if (action.includes('DELETE') || action.includes('DEACTIVATE')) return 'var(--error)';
    if (action.includes('CREATE') || action.includes('BOOTSTRAP'))  return 'var(--primary)';
    if (action.includes('UPDATE') || action.includes('UPSERT'))     return '#f59e0b';
    return 'var(--on-surface-muted)';
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        {sectionTitle('AUDIT TRAIL')}
        <span style={{ fontSize: '12px', color: 'var(--on-surface-muted)' }}>
          {total > 0 ? `${total} entries` : ''}
        </span>
      </div>

      {isLoading && <p style={{ color: 'var(--on-surface-muted)', fontSize: '13px' }}>Loading audit trail…</p>}
      {isError   && <p style={{ color: 'var(--error)', fontSize: '13px' }}>Failed to load audit logs.</p>}

      {!isLoading && logs.length === 0 && !isError && (
        <p style={{ color: 'var(--on-surface-muted)', fontSize: '13px' }}>No audit events recorded yet.</p>
      )}

      {logs.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '600px' }}>
              <thead>
                <tr style={{ color: 'var(--on-surface-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Timestamp', 'Action', 'Entity', 'ID', 'IP'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontFamily: 'var(--font-label)', fontSize: '11px', letterSpacing: '0.8px' }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log: AuditLog) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="tech-text" style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.35)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 12px', color: actionColor(log.action), fontWeight: 600, fontFamily: 'var(--font-tech)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {log.action}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--on-surface-muted)' }}>{log.entity_type ?? '—'}</td>
                    <td className="tech-text" style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.25)', fontSize: '11px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.entity_id ?? '—'}
                    </td>
                    <td className="tech-text" style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
                      {log.ip_address ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '6px 14px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--on-surface-muted)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
                ← Prev
              </button>
              <span style={{ lineHeight: '32px', fontSize: '12px', color: 'var(--on-surface-muted)' }}>{page} / {pages}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                style={{ padding: '6px 14px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--on-surface-muted)', cursor: page === pages ? 'not-allowed' : 'pointer', opacity: page === pages ? 0.4 : 1 }}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main SettingsView ─────────────────────────────────────────────────────────

type Tab = 'smtp' | 'rbac' | 'users' | 'integrations' | 'audit';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'smtp',         label: 'Email (SMTP)',   icon: '✉' },
  { id: 'rbac',         label: 'Access Profiles', icon: '⊙' },
  { id: 'users',        label: 'Users',           icon: '⊕' },
  { id: 'integrations', label: 'Integrations',    icon: '⬡' },
  { id: 'audit',        label: 'Audit Logs',      icon: '⊞' },
];

export default function SettingsView() {
  const currentUser = useAuthStore(s => s.user);
  const isAdmin     = currentUser?.role === 'admin';
  const [activeTab, setActiveTab] = useState<Tab>('smtp');

  if (!isAdmin) {
    return (
      <div style={{ padding: '32px', paddingTop: '96px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.2 }}>⊙</div>
          <h2 style={{ color: '#fff', marginBottom: '8px' }}>Access Restricted</h2>
          <p style={{ color: 'var(--on-surface-muted)', fontSize: '14px' }}>System settings are only accessible to administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', paddingTop: '64px' }}>
      {/* Left nav */}
      <div className="glass-panel" style={{ width: '200px', flexShrink: 0, padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: '4px', borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderLeft: 'none', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
        <p style={{ fontSize: '10px', color: 'var(--on-surface-muted)', letterSpacing: '1px', marginBottom: '12px', paddingLeft: '10px', fontFamily: 'var(--font-label)' }}>SYSTEM SETTINGS</p>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px', borderRadius: '6px', border: 'none',
              background: activeTab === t.id ? 'rgba(0,242,255,0.1)' : 'transparent',
              color: activeTab === t.id ? 'var(--primary)' : 'var(--on-surface-muted)',
              fontSize: '13px', cursor: 'pointer', textAlign: 'left', width: '100%',
              fontWeight: activeTab === t.id ? 600 : 400, transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: '15px', opacity: 0.7 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        {activeTab === 'smtp'         && <SmtpTab />}
        {activeTab === 'rbac'         && <RbacTab />}
        {activeTab === 'users'        && <UsersTab />}
        {activeTab === 'integrations' && <IntegrationsTab />}
        {activeTab === 'audit'        && <AuditTab />}
      </div>
    </div>
  );
}
