import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listUsers, createUser, deactivateUser, type User, type UserRole } from '../api/users';
import { useAuthStore } from '../store/authStore';

// ── RBAC helpers ────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  admin:   'Administrator',
  analyst: 'Security Architect',
  viewer:  'Auditor / Viewer',
  api_key: 'API Key',
};

const ROLE_DESC: Record<UserRole, string> = {
  admin:   'Full system access — manages users, config, and integrations',
  analyst: 'Can create and edit threat models and templates',
  viewer:  'Read-only access to models and reports',
  api_key: 'Machine-to-machine integrations via bearer token',
};

const ROLE_PERMS: Record<UserRole, string[]> = {
  admin:   ['Manage users', 'Configure system', 'Read/write all models', 'Audit logs', 'Integrations'],
  analyst: ['Read/write own models', 'Import templates', 'Export reports', 'AI suggestions'],
  viewer:  ['Read models', 'Download reports'],
  api_key: ['Scoped by token claims'],
};

function roleBadgeColor(role: UserRole): string {
  switch (role) {
    case 'admin':   return 'var(--primary)';
    case 'analyst': return 'var(--secondary)';
    case 'viewer':  return 'var(--on-surface-muted)';
    case 'api_key': return '#f59e0b';
  }
}

interface InviteFormState {
  email: string; display_name: string; password: string; role: UserRole;
}

// ── Main AdminView ──────────────────────────────────────────────────────────

export default function AdminView() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin     = currentUser?.role === 'admin';
  const qc          = useQueryClient();

  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm]             = useState<InviteFormState>({ email: '', display_name: '', password: '', role: 'analyst' });
  const [formError, setFormError]   = useState<string | null>(null);

  const { data: users = [], isLoading, error: usersError } = useQuery({
    queryKey: ['users'],
    queryFn:  listUsers,
    enabled:  isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowInvite(false);
      setForm({ email: '', display_name: '', password: '', role: 'analyst' });
      setFormError(null);
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      setFormError(e?.response?.data?.error ?? 'Failed to create user'),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const activeUsers = users.filter((u: User) => u.is_active);
  const roleCounts  = activeUsers.reduce<Partial<Record<UserRole, number>>>(
    (acc: Partial<Record<UserRole, number>>, u: User) => ({ ...acc, [u.role]: (acc[u.role] ?? 0) + 1 }), {}
  );

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate(form);
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: '32px', paddingTop: '96px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--on-surface-muted)' }}>
          <p style={{ fontSize: '14px' }}>Administrator access required.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', paddingTop: '96px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h1 className="font-display" style={{ fontSize: '28px', marginBottom: '8px', color: '#fff' }}>Platform Administration</h1>
      <p className="label-text" style={{ color: 'var(--on-surface-muted)', marginBottom: '32px' }}>
        Manage users and role-based access control. System config is in <strong style={{ color: 'var(--primary)' }}>Settings</strong>.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

        {/* ── Role profiles ── */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 className="label-text glow-text-cyan" style={{ fontSize: '14px', margin: '0 0 20px', letterSpacing: '1px' }}>
            ROLE PROFILES
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(['admin', 'analyst', 'viewer'] as UserRole[]).map((role) => (
              <div key={role} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>{ROLE_LABELS[role]}</div>
                    <div style={{ color: 'var(--on-surface-muted)', fontSize: '12px', marginTop: '3px' }}>{ROLE_DESC[role]}</div>
                  </div>
                  <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: roleBadgeColor(role), border: `1px solid ${roleBadgeColor(role)}33`, whiteSpace: 'nowrap' }}>
                    {roleCounts[role] ?? 0} users
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {ROLE_PERMS[role].map((p) => (
                    <span key={p} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', color: 'var(--on-surface-muted)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Users panel ── */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 className="label-text glow-text-purple" style={{ fontSize: '14px', margin: 0, letterSpacing: '1px' }}>
              USERS ({users.length})
            </h3>
            <button
              onClick={() => setShowInvite((v: boolean) => !v)}
              style={{ background: 'rgba(0,242,255,0.1)', border: '1px dashed var(--primary)', color: 'var(--primary)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', letterSpacing: '0.5px' }}
            >
              {showInvite ? 'Cancel' : '+ Invite User'}
            </button>
          </div>

          {showInvite && (
            <form onSubmit={handleInviteSubmit} style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'grid', gap: '10px' }}>
                {(['email', 'display_name', 'password'] as const).map((field) => (
                  <input
                    key={field}
                    type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                    placeholder={field === 'display_name' ? 'Display name (optional)' : field.charAt(0).toUpperCase() + field.slice(1)}
                    required={field !== 'display_name'}
                    value={form[field]}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f: InviteFormState) => ({ ...f, [field]: e.target.value }))}
                    style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '13px', outline: 'none' }}
                  />
                ))}
                <select
                  value={form.role}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((f: InviteFormState) => ({ ...f, role: e.target.value as UserRole }))}
                  style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#12161f', color: '#e2e8f0', fontSize: '13px', outline: 'none' }}
                >
                  <option value="admin">Administrator</option>
                  <option value="analyst">Security Architect (analyst)</option>
                  <option value="viewer">Auditor / Viewer</option>
                </select>
                {formError && <p style={{ margin: 0, fontSize: '12px', color: 'var(--error)' }}>{formError}</p>}
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  style={{ padding: '9px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: '#000', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  {createMutation.isPending ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          )}

          {isLoading && <p style={{ fontSize: '13px', color: 'var(--on-surface-muted)' }}>Loading users…</p>}
          {usersError  && <p style={{ fontSize: '13px', color: 'var(--error)' }}>Failed to load users.</p>}

          {!isLoading && (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {users.map((user: User) => (
                <div
                  key={user.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px',
                    opacity: user.is_active ? 1 : 0.45,
                  }}
                >
                  <div>
                    <div style={{ color: user.is_active ? '#e2e8f0' : 'var(--on-surface-muted)', fontSize: '13px' }}>
                      {user.display_name || user.email}
                      {!user.is_active && (
                        <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--error)' }}>INACTIVE</span>
                      )}
                    </div>
                    <div style={{ color: 'var(--on-surface-muted)', fontSize: '11px' }}>{user.email}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: roleBadgeColor(user.role) }}>
                      {user.role}
                    </span>
                    {user.is_active && user.id !== currentUser?.id && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Deactivate ${user.display_name || user.email}?`)) {
                            deactivateMutation.mutate(user.id);
                          }
                        }}
                        title="Deactivate user"
                        style={{ background: 'transparent', border: 'none', color: 'var(--on-surface-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 4px' }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {users.length === 0 && !isLoading && (
                <p style={{ fontSize: '13px', color: 'var(--on-surface-muted)', textAlign: 'center', padding: '24px 0' }}>
                  No users yet.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
