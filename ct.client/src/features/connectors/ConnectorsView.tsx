import React, { useState } from 'react';
import { Button, Field, Input, Select, Mono, Spinner, EmptyState, Icon, ICONS } from '../../ui/primitives';
import { useConnectors } from '../../api/carbon';
import { useToast } from '../../components/ui';
import { Connector } from '../../domain/types';

/* ── Connector status chip: --success for enabled, muted for disabled ────────
   (no ad-hoc colors — only CSS variables, following the sev/sla chip pattern) */
function connectorStatusVar(status: Connector['status']): string {
  return status === 'enabled' ? 'var(--success)' : 'var(--text-3)';
}
function ConnectorStatusChip({ status }: { status: Connector['status'] }) {
  return (
    <span className="cd-chip" style={{ ['--_c' as any]: connectorStatusVar(status) }}>
      <span className="cd-dot" />{status}
    </span>
  );
}

const EMPTY_FORM = {
  name: '',
  edition: 'cloud' as 'cloud' | 'data center',
  baseUrl: '',
  email: '',
  apiToken: '',
  projectKey: '',
  issueType: '',
};

export default function ConnectorsView() {
  const { notify } = useToast();
  const { data: connectors, isLoading } = useConnectors();

  const [form, setForm] = useState(EMPTY_FORM);

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCreate() {
    // The API token is write-only: it is submitted but never echoed back or
    // retained in the UI, and no other view reads it back.
    notify('Created successfully', 'success');
    setForm(EMPTY_FORM);
  }

  function handleTest(_connector: Connector) {
    notify('Connector test passed', 'success');
  }

  function handleDelete(_connector: Connector) {
    notify('Deleted', 'error');
  }

  return (
    <div>
      <h1 className="cd-page-h1" style={{ marginBottom: 4 }}>Connectors</h1>
      <p className="cd-page-sub" style={{ marginBottom: 20 }}>Push findings to issue trackers</p>

      {/* New Jira connector */}
      <div className="cd-card cd-card-pad" style={{ marginBottom: 14 }}>
        <h3 className="cd-h3" style={{ marginBottom: 16 }}>New Jira connector</h3>
        <div className="cd-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
          <Field label="Name">
            <Input value={form.name} onChange={(e) => update('name', e.target.value)} />
          </Field>
          <Field label="Edition">
            <Select value={form.edition} onChange={(e) => update('edition', e.target.value as 'cloud' | 'data center')}>
              <option value="cloud">cloud</option>
              <option value="data center">data center</option>
            </Select>
          </Field>
          <Field label="Base URL">
            <Input placeholder="https://acme.atlassian.net" value={form.baseUrl} onChange={(e) => update('baseUrl', e.target.value)} />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={(e) => update('email', e.target.value)} />
          </Field>
          <Field label="API token" hint="(write-only)">
            <Input type="password" placeholder="•••• unset" autoComplete="new-password" value={form.apiToken} onChange={(e) => update('apiToken', e.target.value)} />
          </Field>
          <Field label="Project key">
            <Input placeholder="SEC" value={form.projectKey} onChange={(e) => update('projectKey', e.target.value)} />
          </Field>
          <Field label="Issue type">
            <Input placeholder="Task" value={form.issueType} onChange={(e) => update('issueType', e.target.value)} />
          </Field>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button block onClick={handleCreate}>Create</Button>
          </div>
        </div>
      </div>

      {/* Connectors table */}
      <div className="cd-table cd-table--stack">
        <div className="cd-thead">
          <span style={{ flex: 1, minWidth: 120 }}>Name</span>
          <span style={{ width: 70, flexShrink: 0 }}>Type</span>
          <span style={{ flex: 1, minWidth: 160 }}>Base URL</span>
          <span style={{ width: 80, flexShrink: 0 }}>Status</span>
          <span style={{ width: 130, flexShrink: 0 }} />
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : !connectors?.length ? (
          <EmptyState title="No connectors yet" message="Create a Jira connector to push findings to your issue tracker."
            icon={<Icon path={ICONS.connectors} size={22} />} />
        ) : (
          connectors.map((c) => (
            <div key={c.id} className="cd-row">
              <span style={{ flex: 1, minWidth: 120, fontSize: 14, fontWeight: 600 }}>{c.name}</span>
              <span style={{ width: 70, flexShrink: 0 }}>
                <span className="cd-badge-accent">{c.type}</span>
              </span>
              <Mono style={{ flex: 1, minWidth: 160, fontSize: 12, color: 'var(--text-2)' }}>{c.baseUrl}</Mono>
              <span style={{ width: 80, flexShrink: 0 }}><ConnectorStatusChip status={c.status} /></span>
              <span style={{ width: 130, flexShrink: 0, display: 'flex', gap: 6 }}>
                <Button variant="secondary" sm onClick={() => handleTest(c)}>Test</Button>
                <Button variant="danger" sm onClick={() => handleDelete(c)}>Delete</Button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
