import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listUsers, createUser, deactivateUser, type User, type UserRole } from '../api/users';
import { getVulnFeedStatus, triggerVulnFeedSync } from '../api/vulnFeeds';
import { listBackups, createBackup, downloadBackup, deleteBackup, listSchedules, createSchedule, deleteSchedule, restoreBackup as restoreBackupApi, type BackupRecord, type BackupSchedule } from '../api/backup';
import { listRoles, createRole, updateRole, deleteRole, listPermissions, type Role, type PermissionGroup } from '../api/roles';
import { useAuthStore } from '../store/authStore';
import { Field, Select as UISelect, Button, Spinner, Modal, useToast } from '../components/ui';

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

const ROLE_SELECT_OPTIONS = [
  { value: 'admin',   label: ROLE_LABELS.admin },
  { value: 'analyst', label: ROLE_LABELS.analyst },
  { value: 'viewer',  label: ROLE_LABELS.viewer },
];

const SCHEDULE_FREQ_OPTIONS = [
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

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

// ── Role editor state ─────────────────────────────────────────────────────────

interface RoleFormState {
  name: string;
  description: string;
  permission_keys: string[];
}

const EMPTY_ROLE_FORM: RoleFormState = { name: '', description: '', permission_keys: [] };

export default function AdminView() {
  const currentUser  = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const isAdmin      = hasPermission('users:manage');
  const canManageRoles = hasPermission('roles:manage');
  const qc           = useQueryClient();
  const { notify }   = useToast();

  // ── Tabs ──
  const [activeTab, setActiveTab] = useState<'users' | 'backup' | 'roles'>('users');

  // ── Role editor state ──
  const [roleModalOpen, setRoleModalOpen]       = useState(false);
  const [editingRole, setEditingRole]           = useState<Role | null>(null);
  const [roleForm, setRoleForm]                 = useState<RoleFormState>(EMPTY_ROLE_FORM);
  const [roleFormError, setRoleFormError]       = useState<string | null>(null);

  const [showInvite, setShowInvite]   = useState(false);
  const [form, setForm]               = useState<InviteFormState>({ email: '', display_name: '', password: '', role: 'analyst' });
  const [formError, setFormError]     = useState<string | null>(null);

  // ── Backup state ──
  const [bkCreating, setBkCreating] = useState(false);
  const [bkRestoring, setBkRestoring] = useState(false);
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
      notify('Sync started — the database will update in the background.', 'success');
      setTimeout(() => refetchFeed(), 5000);
    },
    onError: () => notify('Sync request failed. Check server logs.', 'error'),
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
    try {
      await createBackup();
      bkRefetch();
      notify('Backup created successfully.', 'success');
    } catch {
      notify('Failed to create backup.', 'error');
    } finally {
      setBkCreating(false);
    }
  }, [bkRefetch, notify]);

  const handleBkDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this backup?')) return;
    try {
      await deleteBackup(id);
      bkRefetch();
      notify('Backup deleted.', 'success');
    } catch {
      notify('Failed to delete backup.', 'error');
    }
  }, [bkRefetch, notify]);

  const handleBkDownload = useCallback(async (id: string) => {
    try {
      await downloadBackup(id);
    } catch {
      notify('Failed to download backup.', 'error');
    }
  }, [notify]);

  const handleBkRestore = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBkRestoring(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await restoreBackupApi(data);
      bkRefetch();
      const summary = Object.entries(result.restored).map(([t, c]) => `${t}: ${c}`).join(' · ');
      const hasErrors = result.errors.length > 0;
      notify(
        `Restore complete — ${summary}${hasErrors ? ` (${result.errors.length} warning${result.errors.length > 1 ? 's' : ''})` : ''}`,
        hasErrors ? 'warning' : 'success',
        8000,
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Restore failed.', 'error');
    } finally {
      setBkRestoring(false);
    }
  }, [bkRefetch, notify]);

  // ── Roles queries + mutations ──
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn:  listRoles,
    enabled:  canManageRoles && activeTab === 'roles',
  });

  const { data: permissionGroups = [] } = useQuery<PermissionGroup[]>({
    queryKey: ['permissions-catalog'],
    queryFn:  listPermissions,
    enabled:  canManageRoles && roleModalOpen,
  });

  const createRoleMutation = useMutation({
    mutationFn: (data: RoleFormState) => createRole(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      setRoleModalOpen(false);
      setRoleForm(EMPTY_ROLE_FORM);
      setRoleFormError(null);
      notify('Role created.', 'success');
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      setRoleFormError(e?.response?.data?.error ?? 'Failed to create role'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RoleFormState }) => updateRole(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      setRoleModalOpen(false);
      setEditingRole(null);
      setRoleForm(EMPTY_ROLE_FORM);
      setRoleFormError(null);
      notify('Role updated.', 'success');
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      setRoleFormError(e?.response?.data?.error ?? 'Failed to update role'),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      notify('Role deleted.', 'success');
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      notify(e?.response?.data?.error ?? 'Failed to delete role', 'error'),
  });

  function openCreateRole() {
    setEditingRole(null);
    setRoleForm(EMPTY_ROLE_FORM);
    setRoleFormError(null);
    setRoleModalOpen(true);
  }

  function openEditRole(role: Role) {
    setEditingRole(role);
    setRoleForm({ name: role.name, description: role.description, permission_keys: role.permission_keys });
    setRoleFormError(null);
    setRoleModalOpen(true);
  }

  function handleRoleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRoleFormError(null);
    if (editingRole) {
      updateRoleMutation.mutate({ id: editingRole.id, data: roleForm });
    } else {
      createRoleMutation.mutate(roleForm);
    }
  }

  function togglePermKey(key: string) {
    setRoleForm((f) => ({
      ...f,
      permission_keys: f.permission_keys.includes(key)
        ? f.permission_keys.filter((k) => k !== key)
        : [...f.permission_keys, key],
    }));
  }

  const handleCreateSchedule = useCallback(async () => {
    if (!scheduleName.trim()) return;
    try {
      await createSchedule({ name: scheduleName, frequency: scheduleFreq });
      qc.invalidateQueries({ queryKey: ['backup-schedules'] });
      setScheduleName('');
      setShowScheduleForm(false);
      notify('Schedule created.', 'success');
    } catch {
      notify('Failed to create schedule.', 'error');
    }
  }, [scheduleName, scheduleFreq, qc, notify]);

  const handleDeleteSchedule = useCallback(async (id: string) => {
    if (!confirm('Delete this schedule?')) return;
    try {
      await deleteSchedule(id);
      qc.invalidateQueries({ queryKey: ['backup-schedules'] });
      notify('Schedule deleted.', 'success');
    } catch {
      notify('Failed to delete schedule.', 'error');
    }
  }, [qc, notify]);

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
        {([
          ['users',  'Users & Threat Intel'],
          ['backup', 'Backup & Restore'],
          ['roles',  'Role Profiles'],
        ] as const).map(([key, label]) => (
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
          <Button
            variant="ghost"
            size="sm"
            loading={syncMutation.isPending || feedStatus?.lastRun?.status === 'running'}
            onClick={() => syncMutation.mutate()}
            style={{ border: '1px solid var(--primary)', color: 'var(--primary)', background: 'rgba(0,242,255,0.08)' }}
          >
            ↻ Update Threat DB
          </Button>
        </div>

        {feedLoading && <Spinner label="Loading feed status" />}

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
            <form
              onSubmit={handleInviteSubmit}
              style={{ marginBottom: 'var(--space-5)', padding: 'var(--space-4)', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <Field
                label="Email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Field
                label="Display Name"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              />
              <Field
                label="Password"
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
              <UISelect
                label="Role"
                required
                options={ROLE_SELECT_OPTIONS}
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
              />
              {formError && (
                <p role="alert" style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--error)' }}>
                  {formError}
                </p>
              )}
              <Button type="submit" loading={createMutation.isPending} style={{ width: '100%' }}>
                Create User
              </Button>
            </form>
          )}

          {isLoading && <Spinner label="Loading users" />}
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

      {/* ── Roles Tab ── */}
      {activeTab === 'roles' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h3 className="label-text glow-text-cyan" style={{ fontSize: '14px', margin: '0 0 4px', letterSpacing: '1px' }}>ROLE PROFILES</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--on-surface-muted)' }}>
                System roles are read-only. Create custom roles with a configurable set of permissions.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={openCreateRole}>+ New Role</Button>
          </div>

          {rolesLoading && <Spinner label="Loading roles" />}

          {!rolesLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {roles.map((role: Role) => (
                <div
                  key={role.id}
                  className="glass-panel"
                  style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', opacity: role.is_active ? 1 : 0.5 }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600 }}>{role.name}</span>
                      {role.is_system && (
                        <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(0,242,255,0.08)', color: 'var(--primary)', border: '1px solid rgba(0,242,255,0.2)' }}>
                          SYSTEM
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: 'var(--on-surface-muted)' }}>
                        {role.permission_keys.length} permissions · {role.user_count} user{role.user_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {role.description && (
                      <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--on-surface-muted)' }}>{role.description}</p>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {role.permission_keys.slice(0, 8).map((k) => (
                        <span key={k} style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', color: 'var(--on-surface-muted)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          {k}
                        </span>
                      ))}
                      {role.permission_keys.length > 8 && (
                        <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', color: 'var(--on-surface-muted)' }}>
                          +{role.permission_keys.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <Button variant="secondary" size="sm" onClick={() => openEditRole(role)}>
                      {role.is_system ? 'View' : 'Edit'}
                    </Button>
                    {!role.is_system && (
                      <Button
                        variant="danger"
                        size="sm"
                        loading={deleteRoleMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) {
                            deleteRoleMutation.mutate(role.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {roles.length === 0 && !rolesLoading && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--on-surface-muted)', fontSize: '13px' }}>
                  No roles found.
                </div>
              )}
            </div>
          )}

          {/* ── Role editor modal ── */}
          <Modal
            open={roleModalOpen}
            onClose={() => { setRoleModalOpen(false); setEditingRole(null); setRoleForm(EMPTY_ROLE_FORM); }}
            title={editingRole ? (editingRole.is_system ? `View: ${editingRole.name}` : `Edit: ${editingRole.name}`) : 'New Role'}
            style={{ maxWidth: 680, maxHeight: '85vh', overflowY: 'auto' }}
          >
            <form onSubmit={handleRoleFormSubmit}>
              <Field
                label="Role Name"
                required
                value={roleForm.name}
                onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
                disabled={editingRole?.is_system}
              />
              <Field
                label="Description"
                value={roleForm.description}
                onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))}
                disabled={editingRole?.is_system}
              />

              {/* Permission matrix */}
              <div style={{ marginTop: 'var(--space-4)' }}>
                <p style={{ fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: 'var(--space-3)' }}>
                  Permissions — {roleForm.permission_keys.length} selected
                </p>
                {permissionGroups.map((group: PermissionGroup) => (
                  <div key={group.domain} style={{ marginBottom: 'var(--space-4)' }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary)', letterSpacing: '0.8px', margin: '0 0 var(--space-2)', textTransform: 'uppercase' }}>
                      {group.domain}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {group.permissions.map((p) => {
                        const checked = roleForm.permission_keys.includes(p.key);
                        return (
                          <label
                            key={p.key}
                            title={p.description}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              fontSize: '11px', padding: '4px 10px', borderRadius: '4px', cursor: editingRole?.is_system ? 'default' : 'pointer',
                              background: checked ? 'rgba(0,242,255,0.12)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${checked ? 'rgba(0,242,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                              color: checked ? 'var(--primary)' : 'var(--on-surface-muted)',
                              transition: 'all 0.15s',
                              userSelect: 'none',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => !editingRole?.is_system && togglePermKey(p.key)}
                              disabled={editingRole?.is_system}
                              style={{ width: 12, height: 12, accentColor: 'var(--primary)' }}
                            />
                            {p.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {roleFormError && (
                <p role="alert" style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--error)' }}>
                  {roleFormError}
                </p>
              )}

              {!editingRole?.is_system && (
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                  <Button
                    variant="secondary"
                    type="button"
                    style={{ flex: 1 }}
                    onClick={() => { setRoleModalOpen(false); setEditingRole(null); setRoleForm(EMPTY_ROLE_FORM); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    style={{ flex: 1 }}
                    loading={createRoleMutation.isPending || updateRoleMutation.isPending}
                  >
                    {editingRole ? 'Save Changes' : 'Create Role'}
                  </Button>
                </div>
              )}
            </form>
          </Modal>
        </div>
      )}

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
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button variant="secondary" size="sm" loading={bkRestoring} onClick={() => bkFileRef.current?.click()}>
                📤 Restore from file
                <input ref={bkFileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleBkRestore} />
              </Button>
              <Button variant="primary" size="sm" loading={bkCreating} onClick={handleBkCreate}>
                + Create Backup
              </Button>
            </div>
          </div>

          {/* Schedules */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ color: '#fff', fontSize: '14px', margin: 0 }}>Schedules</h4>
              <button onClick={() => setShowScheduleForm(!showScheduleForm)} style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px' }}>+ New Schedule</button>
            </div>

            {showScheduleForm && (
              <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <Field
                    label="Name"
                    required
                    value={scheduleName}
                    onChange={(e) => setScheduleName(e.target.value)}
                  />
                  <UISelect
                    label="Frequency"
                    options={SCHEDULE_FREQ_OPTIONS}
                    value={scheduleFreq}
                    onChange={(e) => setScheduleFreq(e.target.value)}
                  />
                </div>
                <Button size="sm" onClick={handleCreateSchedule} disabled={!scheduleName.trim()}>
                  Save Schedule
                </Button>
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
                    <button aria-label={`Delete schedule ${s.id}`} onClick={() => handleDeleteSchedule(s.id)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Backups list */}
          <div>
            <h4 style={{ color: '#fff', fontSize: '14px', margin: '0 0 12px 0' }}>Backups ({backups.length})</h4>
            {bkLoading ? (
              <Spinner label="Loading backups" />
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
                      <button aria-label={`Download backup ${b.id}`} onClick={() => handleBkDownload(b.id)} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(0,242,255,0.2)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px' }}>Download</button>
                      )}
                    <button aria-label={`Delete backup ${b.id}`} onClick={() => handleBkDelete(b.id)} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>Delete</button>
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
