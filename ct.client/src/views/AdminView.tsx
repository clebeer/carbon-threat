import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listUsers, createUser, deactivateUser, type User, type UserRole } from '../api/users';
import { getVulnFeedStatus, triggerVulnFeedSync } from '../api/vulnFeeds';
import { listBackups, createBackup, downloadBackup, deleteBackup, listSchedules, createSchedule, deleteSchedule, restoreBackup as restoreBackupApi, type BackupRecord, type BackupSchedule } from '../api/backup';
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

const SEVERITY_COLOR: Record<string, string> = {
  Critical: 'var(--error)',
  High:     '#f97316',
  Medium:   '#f59e0b',
  Low:      'var(--on-surface-muted)',
};

export default function AdminView() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin     = currentUser?.role === 'admin';
  const qc          = useQueryClient();

  // ── Tabs ──
  const [activeTab, setActiveTab] = useState<'users' | 'backup'>('users');

  const [showInvite, setShowInvite]   = useState(false);
  const [form, setForm]               = useState<InviteFormState>({ email: '', display_name: '', password: '', role: 'analyst' });
  const [formError, setFormError]     = useState<string | null>(null);
  const [syncNotice, setSyncNotice]   = useState<string | null>(null);

  // ── Backup state ──
  const [bkCreating, setBkCreating] = useState(false);
  const [bkError, setBkError] = useState('');
  const [bkRestoring, setBkRestoring] = useState(false);
  const [bkRestoreResult, setBkRestoreResult] = useState<{ restored: Record<string, number>; errors: string[] } | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleFreq, setScheduleFreq] = useState('daily');
  const bkFileRef = useRef<HTMLInputElement>(null);

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

  const { data: feedStatus, isLoading: feedLoading, refetch: refetchFeed } = useQuery({
    queryKey: ['vuln-feed-status'],
    queryFn:  getVulnFeedStatus,
    enabled:  isAdmin,
    refetchInterval: (query) => {
      // Poll every 4 s while a sync run is in progress
      return query.state.data?.lastRun?.status === 'running' ? 4000 : false;
    },
  });

  const syncMutation = useMutation({
    mutationFn: triggerVulnFeedSync,
    onSuccess: () => {
      setSyncNotice('Sync started — the database will update in the background.');
      setTimeout(() => { refetchFeed(); setSyncNotice(null); }, 5000);
    },
    onError: () => setSyncNotice('Sync request failed. Check server logs.'),
  });

  // ── Backup queries ──
  const { data: backups = [], isLoading: bkLoading, refetch: bkRefetch } = useQuery({
    queryKey: ['backups'],
    queryFn:  listBackups,
    enabled:  isAdmin && activeTab === 'backup',
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['backup-schedules'],
    queryFn:  listSchedules,
    enabled:  isAdmin && activeTab === 'backup',
  });

  const handleBkCreate = useCallback(async () => {
    setBkCreating(true);
    setBkError('');
    try {
      await createBackup();
      bkRefetch();
    } catch {
      setBkError('Failed to create backup');
    } finally {
      setBkCreating(false);
    }
  }, [bkRefetch]);

  const handleBkDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this backup?')) return;
    try {
      await deleteBackup(id);
      bkRefetch();
    } catch {
      setBkError('Failed to delete backup');
    }
  }, [bkRefetch]);

  const handleBkDownload = useCallback(async (id: string) => {
    try {
      await downloadBackup(id);
    } catch {
      setBkError('Failed to download backup');
    }
  }, []);

  const handleBkRestore = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBkRestoring(true);
    setBkRestoreResult(null);
    setBkError('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await restoreBackupApi(data);
      setBkRestoreResult(result);
      bkRefetch();
    } catch (err) {
      setBkError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setBkRestoring(false);
    }
  }, [bkRefetch]);

  const handleCreateSchedule = useCallback(async () => {
    if (!scheduleName.trim()) return;
    try {
      await createSchedule({ name: scheduleName, frequency: scheduleFreq });
      qc.invalidateQueries({ queryKey: ['backup-schedules'] });
      setScheduleName('');
      setShowScheduleForm(false);
    } catch {
      setBkError('Failed to create schedule');
    }
  }, [scheduleName, scheduleFreq, qc]);

  const handleDeleteSchedule = useCallback(async (id: string) => {
    if (!confirm('Delete this schedule?')) return;
    try {
      await deleteSchedule(id);
      qc.invalidateQueries({ queryKey: ['backup-schedules'] });
    } catch {
      setBkError('Failed to delete schedule');
    }
  }, [qc]);

  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'complete': return '#10b981';
      case 'running': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return 'var(--on-surface-muted)';
    }
  };

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
      <p className="label-text" style={{ color: 'var(--on-surface-muted)', marginBottom: '24px' }}>
        Manage users, threat intelligence, and backups.
      </p>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '4px' }}>
        {([['users', 'Users & Threat Intel'], ['backup', 'Backup & Restore']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', transition: 'all 0.2s',
              background: activeTab === key ? 'rgba(0,242,255,0.12)' : 'transparent',
              color: activeTab === key ? 'var(--primary)' : 'var(--on-surface-muted)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (<>
      {/* ── Threat Intelligence ── */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', borderTop: '2px solid rgba(0,242,255,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <div>
            <h3 className="label-text glow-text-cyan" style={{ fontSize: '14px', margin: '0 0 4px', letterSpacing: '1px' }}>
              THREAT INTELLIGENCE
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--on-surface-muted)' }}>
              Vulnerability advisories from OSV (Open Source Vulnerabilities). Mapped to STRIDE categories and used to enrich threat analysis.
            </p>
          </div>
          <button
            onClick={() => { setSyncNotice(null); syncMutation.mutate(); }}
            disabled={syncMutation.isPending || feedStatus?.lastRun?.status === 'running'}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '9px 20px', borderRadius: '6px', cursor: 'pointer',
              fontFamily: 'var(--font-label)', fontSize: '12px', letterSpacing: '0.5px',
              border: '1px solid var(--primary)', fontWeight: 600, transition: 'all 0.2s',
              background: (syncMutation.isPending || feedStatus?.lastRun?.status === 'running')
                ? 'rgba(0,242,255,0.05)'
                : 'rgba(0,242,255,0.12)',
              color: (syncMutation.isPending || feedStatus?.lastRun?.status === 'running')
                ? 'rgba(0,242,255,0.4)'
                : 'var(--primary)',
            }}
          >
            {(syncMutation.isPending || feedStatus?.lastRun?.status === 'running') ? (
              <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>↻</span> Syncing…</>
            ) : (
              <> ↻ Update Threat DB</>
            )}
          </button>
        </div>

        {syncNotice && (
          <div style={{ padding: '10px 14px', background: 'rgba(0,242,255,0.06)', border: '1px solid rgba(0,242,255,0.2)', borderRadius: '6px', fontSize: '12px', color: 'var(--primary)', marginBottom: '16px' }}>
            {syncNotice}
          </div>
        )}

        {feedLoading && <p style={{ fontSize: '13px', color: 'var(--on-surface-muted)', margin: 0 }}>Loading status…</p>}

        {feedStatus && (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Advisory counts by severity */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
              {(['Critical', 'High', 'Medium', 'Low'] as const).map(sev => (
                <div key={sev} style={{ padding: '14px 18px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${SEVERITY_COLOR[sev]}22`, minWidth: '80px', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: SEVERITY_COLOR[sev], fontFamily: 'var(--font-display)' }}>
                    {feedStatus.bySeverity[sev] ?? 0}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--on-surface-muted)', marginTop: '4px', letterSpacing: '0.5px' }}>{sev}</div>
                </div>
              ))}
              <div style={{ padding: '14px 18px', borderRadius: '8px', background: 'rgba(0,242,255,0.04)', border: '1px solid rgba(0,242,255,0.15)', minWidth: '80px', textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>
                  {feedStatus.totalAdvisories}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--on-surface-muted)', marginTop: '4px', letterSpacing: '0.5px' }}>Total</div>
              </div>
            </div>

            {/* Last run info */}
            {feedStatus.lastRun && (
              <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', lineHeight: 1.8, minWidth: '180px' }}>
                <div>
                  <span style={{ color: feedStatus.lastRun.status === 'success' ? '#52c41a' : feedStatus.lastRun.status === 'error' ? 'var(--error)' : 'var(--primary)' }}>
                    ● {feedStatus.lastRun.status.toUpperCase()}
                  </span>
                </div>
                <div>Last sync: {new Date(feedStatus.lastRun.started_at).toLocaleString()}</div>
                <div>Fetched: {feedStatus.lastRun.fetched} · New: {feedStatus.lastRun.inserted} · Updated: {feedStatus.lastRun.updated}</div>
                {feedStatus.lastRun.error_message && (
                  <div style={{ color: 'var(--error)', marginTop: '4px' }}>{feedStatus.lastRun.error_message}</div>
                )}
              </div>
            )}

            {!feedStatus.lastRun && (
              <p style={{ fontSize: '12px', color: 'var(--on-surface-muted)', margin: 0, alignSelf: 'center' }}>
                No sync has been run yet. Click <strong style={{ color: 'var(--primary)' }}>Update Threat DB</strong> to fetch current advisories.
              </p>
            )}
          </div>
        )}
      </div>

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
                        aria-label="Deactivate user"
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
      </>)}

      {activeTab === 'backup' && (
        <div className="glass-panel" style={{ padding: '24px', borderTop: '2px solid rgba(0,242,255,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 className="label-text glow-text-cyan" style={{ fontSize: '14px', margin: '0 0 4px', letterSpacing: '1px' }}>
                BACKUP & RESTORE
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--on-surface-muted)' }}>
                Create, download, and restore application backups
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => bkFileRef.current?.click()}
                disabled={bkRestoring}
                style={{
                  padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent', color: 'var(--on-surface-muted)', cursor: 'pointer', fontSize: '12px',
                }}
              >
                {bkRestoring ? 'Restoring…' : '📤 Restore from file'}
                <input ref={bkFileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleBkRestore} />
              </button>
              <button
                onClick={handleBkCreate}
                disabled={bkCreating}
                style={{
                  padding: '8px 20px', borderRadius: '6px', border: 'none',
                  background: bkCreating ? 'rgba(255,255,255,0.1)' : 'var(--primary)',
                  color: bkCreating ? 'var(--on-surface-muted)' : '#000',
                  cursor: bkCreating ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 700,
                }}
              >
                {bkCreating ? 'Creating…' : '+ Create Backup'}
              </button>
            </div>
          </div>

          {bkError && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '16px', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>{bkError}</div>}

          {bkRestoreResult && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={{ color: '#10b981', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Restore complete</div>
              <div style={{ fontSize: '12px', color: 'var(--on-surface-muted)' }}>
                {Object.entries(bkRestoreResult.restored).map(([table, count]) => `${table}: ${count}`).join(' · ')}
              </div>
              {bkRestoreResult.errors.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#f59e0b' }}>
                  {bkRestoreResult.errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
                </div>
              )}
            </div>
          )}

          {/* Schedules */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ color: '#fff', fontSize: '14px', margin: 0 }}>Schedules</h4>
              <button onClick={() => setShowScheduleForm(!showScheduleForm)} style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px' }}>+ New Schedule</button>
            </div>

            {showScheduleForm && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                <input value={scheduleName} onChange={e => setScheduleName(e.target.value)} placeholder="Schedule name" style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '12px' }} />
                <select value={scheduleFreq} onChange={e => setScheduleFreq(e.target.value)} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '12px' }}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <button onClick={handleCreateSchedule} style={{ padding: '6px 16px', borderRadius: '4px', border: 'none', background: 'var(--primary)', color: '#000', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Save</button>
              </div>
            )}

            {schedules.length === 0 ? (
              <div style={{ color: 'var(--on-surface-muted)', fontSize: '12px', padding: '12px' }}>No schedules configured</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {schedules.map((s: BackupSchedule) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}>{s.name}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,242,255,0.1)', color: 'var(--primary)' }}>{s.frequency}</span>
                      <span style={{ fontSize: '11px', color: s.is_active ? '#10b981' : 'var(--on-surface-muted)' }}>{s.is_active ? 'Active' : 'Paused'}</span>
                    </div>
                    <button onClick={() => handleDeleteSchedule(s.id)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Backups list */}
          <div>
            <h4 style={{ color: '#fff', fontSize: '14px', margin: '0 0 12px 0' }}>Backups ({backups.length})</h4>
            {bkLoading ? (
              <p style={{ fontSize: '13px', color: 'var(--on-surface-muted)' }}>Loading backups…</p>
            ) : backups.length === 0 ? (
              <div style={{ color: 'var(--on-surface-muted)', fontSize: '12px', padding: '24px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>No backups yet. Click "Create Backup" to get started.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {backups.map((b: BackupRecord) => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}>{b.name}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor(b.status)}20`, color: statusColor(b.status) }}>{b.status}</span>
                      <span style={{ fontSize: '11px', color: 'var(--on-surface-muted)' }}>{b.storage_type}</span>
                      <span style={{ fontSize: '11px', color: 'var(--on-surface-muted)' }}>{formatSize(b.file_size)}</span>
                      <span style={{ fontSize: '11px', color: 'var(--on-surface-muted)' }}>{new Date(b.created_at).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {b.status === 'complete' && (
                        <button onClick={() => handleBkDownload(b.id)} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(0,242,255,0.2)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px' }}>Download</button>
                      )}
                      <button onClick={() => handleBkDelete(b.id)} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
