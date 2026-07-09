import React, { useState } from 'react';
import { Button, Card, Field, Input, PasswordInput, Spinner, Tabs, TabDef } from '../../ui/primitives';
import { useAdminUsers } from '../../api/carbon';
import { useToast } from '../../components/ui';
import { AdminUser } from '../../domain/types';

/* ============================================================================
   Admin — reference: Carbon Dojo.dc.html lines ~688-737, adminContent (support.js data ~980-1023)
   ========================================================================== */

const ADMIN_TABS: TabDef[] = [
  { key: 'users', label: 'Users & Roles' },
  { key: 'service', label: 'Service Accounts' },
  { key: 'audit', label: 'Audit Log' },
  { key: 'identity', label: 'Identity Providers' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'policies', label: 'Policies' },
];

type AdminTabKey = 'users' | 'service' | 'audit' | 'identity' | 'notifications' | 'policies';

interface AdminRow {
  title: string;
  sub: string;
  badge: string;
  /** CSS color value (var(--...)) driving the badge's --_c. */
  badgeColor: string;
}

interface AdminTabContent {
  label: string;
  desc: string;
  rows: AdminRow[];
}

const ADMIN_CONTENT: Record<Exclude<AdminTabKey, 'users'>, AdminTabContent> = {
  service: {
    label: 'Service Accounts & API Keys',
    desc: 'Machine identities and scoped tokens. Secrets are write-only.',
    rows: [
      { title: 'ci-importer', sub: 'Scopes: findings:read, imports:write', badge: 'active', badgeColor: 'var(--success)' },
      { title: 'metrics-exporter', sub: 'Scopes: findings:read · org-wide', badge: 'active', badgeColor: 'var(--success)' },
      { title: 'legacy-bot', sub: 'Last used 94 days ago', badge: 'stale', badgeColor: 'var(--warning)' },
    ],
  },
  audit: {
    label: 'Audit Log',
    desc: 'Immutable record of privileged actions.',
    rows: [
      { title: 'role.assign → analyst@carbon.local', sub: 'by boss@carbon.local · 2h ago', badge: 'role', badgeColor: 'var(--accent-text)' },
      { title: 'connector.create → Jira PEN', sub: 'by boss@carbon.local · 1d ago', badge: 'connector', badgeColor: 'var(--accent-text)' },
      { title: 'finding.export → PEN-3', sub: 'by manager@carbon.local · 2d ago', badge: 'export', badgeColor: 'var(--accent-text)' },
    ],
  },
  identity: {
    label: 'Identity Providers',
    desc: 'OIDC / SAML providers and group → role mappings.',
    rows: [
      { title: 'Okta (OIDC)', sub: 'sso.acme.com · auto-provision on', badge: 'enabled', badgeColor: 'var(--success)' },
      { title: 'Azure AD (SAML)', sub: 'group "sec-team" → Red Team Analyst', badge: 'enabled', badgeColor: 'var(--success)' },
    ],
  },
  notifications: {
    label: 'Notifications',
    desc: 'SMTP and Microsoft Teams delivery.',
    rows: [
      { title: 'SMTP relay', sub: 'smtp.acme.com:587 · TLS', badge: 'connected', badgeColor: 'var(--success)' },
      { title: 'Microsoft Teams', sub: 'Critical & High findings channel', badge: 'connected', badgeColor: 'var(--success)' },
    ],
  },
  policies: {
    label: 'Policies',
    desc: 'SLA per severity and data retention.',
    rows: [
      { title: 'SLA — Critical', sub: 'Remediate within 7 days', badge: '7d', badgeColor: 'var(--sev-critical)' },
      { title: 'SLA — High', sub: 'Remediate within 30 days', badge: '30d', badgeColor: 'var(--sev-high)' },
      { title: 'Data retention', sub: 'Audit & session PII purged after 180 days', badge: '180d', badgeColor: 'var(--accent-text)' },
    ],
  },
};

/** Chip driven purely by a CSS color token (via --_c custom property). */
function AdminChip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="cd-chip" style={{ ['--_c' as unknown as string]: color }}>
      <span className="cd-dot" />{children}
    </span>
  );
}

function initialOf(user: AdminUser): string {
  return (user.name || user.email || '?').trim().charAt(0).toUpperCase();
}

/* ── "Users & Roles" tab ──────────────────────────────────────────────────── */
function UsersTab() {
  const { notify } = useToast();
  const { data: users, isLoading } = useAdminUsers();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  function handleCreate() {
    notify('Created successfully', 'success');
    setEmail('');
    setDisplayName('');
    setPassword('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card>
        <h3 className="cd-h3" style={{ marginBottom: 16 }}>Create user</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@carbon.local" />
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <Field label="Display name">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" />
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <Field label="Password" hint="(min 12)">
              <PasswordInput minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </div>
          <Button onClick={handleCreate}>Create user</Button>
        </div>
      </Card>

      <div className="cd-table cd-table--stack">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <h3 className="cd-h3">Users &amp; roles</h3>
        </div>
        <div className="cd-thead">
          <span style={{ flex: 1, minWidth: 140 }}>User</span>
          <span style={{ width: 150, flexShrink: 0 }}>Role</span>
          <span style={{ width: 90, flexShrink: 0 }}>Status</span>
          <span style={{ width: 70, flexShrink: 0 }} />
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : !users?.length ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>No users found.</div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="cd-row">
              <div style={{ flex: 1, minWidth: 140, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="cd-avatar" aria-hidden="true">{initialOf(u)}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{u.email}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{u.name}</div>
                </div>
              </div>
              <span style={{ width: 150, flexShrink: 0 }}>
                <span className="cd-pill">{u.role}</span>
              </span>
              <span style={{ width: 90, flexShrink: 0 }}>
                {u.status === 'active' ? (
                  <AdminChip color="var(--success)">active</AdminChip>
                ) : (
                  <AdminChip color="var(--text-3)">disabled</AdminChip>
                )}
              </span>
              <span style={{ width: 70, flexShrink: 0 }}>
                <Button
                  variant="secondary"
                  sm
                  onClick={() => notify(`Edit dialog opened for ${u.email}`, 'info')}
                >
                  Edit
                </Button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Generic admin tab (service / audit / identity / notifications / policies) ─ */
function GenericAdminTab({ content }: { content: AdminTabContent }) {
  const { notify } = useToast();
  return (
    <Card>
      <h3 className="cd-h3" style={{ marginBottom: 4 }}>{content.label}</h3>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 20px' }}>{content.desc}</p>
      {content.rows.map((row, i) => (
        <div
          key={row.title}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '14px 0', borderBottom: i < content.rows.length - 1 ? '1px solid var(--border)' : 'none',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{row.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{row.sub}</div>
          </div>
          <AdminChip color={row.badgeColor}>{row.badge}</AdminChip>
          <Button
            variant="secondary"
            sm
            onClick={() => notify(`Configure dialog opened for ${row.title}`, 'info')}
          >
            Configure
          </Button>
        </div>
      ))}
    </Card>
  );
}

/* ── Root ──────────────────────────────────────────────────────────────────── */
export default function AdminView() {
  const [tab, setTab] = useState<AdminTabKey>('users');

  return (
    <div>
      <h1 className="cd-page-h1" style={{ marginBottom: 16 }}>Admin</h1>
      <Tabs tabs={ADMIN_TABS} active={tab} onChange={(k) => setTab(k as AdminTabKey)} />

      {tab === 'users' ? <UsersTab /> : <GenericAdminTab content={ADMIN_CONTENT[tab]} />}
    </div>
  );
}
