import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Field, Input, Select, Mono, Spinner, EmptyState, Icon, ICONS } from '../../ui/primitives';
import { useEngagements, useFindings } from '../../api/carbon';
import { useToast } from '../../components/ui';
import { Engagement, EngagementStatus, EngagementType, Finding } from '../../domain/types';

/* ── Engagement status chip: color driven only by --success/--accent/--warning ─ */
function statusVar(status: EngagementStatus | string): string {
  if (status === 'completed') return 'var(--success)';
  if (status === 'active') return 'var(--accent)';
  return 'var(--warning)'; // planned
}
function EngagementStatusChip({ status }: { status: EngagementStatus | string }) {
  const c = statusVar(status);
  return (
    <span className="cd-chip" style={{ ['--_c' as any]: c }}>
      <span className="cd-dot" />{status}
    </span>
  );
}

/* ── Engagement type badge ─────────────────────────────────────────────────── */
function EngagementTypeBadge({ type }: { type: EngagementType | string }) {
  return <span className="cd-badge-accent">{type}</span>;
}

const ENGAGEMENT_TYPES: EngagementType[] = ['pentest', 'scan', 'bug bounty', 'red team'];

/* ============================================================================
   List
   ========================================================================== */
export default function EngagementsView() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { data: engagements, isLoading } = useEngagements();

  const [name, setName] = useState('');
  const [type, setType] = useState<EngagementType>('pentest');
  const [jiraProject, setJiraProject] = useState('');

  function handleCreate() {
    notify('Created successfully', 'success');
    setName('');
    setType('pentest');
    setJiraProject('');
  }

  function openEngagement(e: Engagement) {
    navigate(`/engagements/${e.id}`);
  }

  return (
    <div>
      <h1 className="cd-page-h1" style={{ marginBottom: 4 }}>Engagements</h1>
      <p className="cd-page-sub" style={{ marginBottom: 20 }}>Security projects on carbon-dojo</p>

      <div className="cd-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', alignItems: 'start' }}>
        {/* New engagement form */}
        <div className="cd-card cd-card-pad">
          <h3 className="cd-h3" style={{ marginBottom: 16 }}>New engagement</h3>
          <div style={{ marginBottom: 14 }}>
            <Field label="Name">
              <Input placeholder="Pentest 2026-Q3" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <div style={{ marginBottom: 14 }}>
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as EngagementType)}>
                {ENGAGEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
          </div>
          <div style={{ marginBottom: 18 }}>
            <Field label="Jira project">
              <Input placeholder="PEN" value={jiraProject} onChange={(e) => setJiraProject(e.target.value)} />
            </Field>
          </div>
          <Button block onClick={handleCreate}>Create engagement</Button>
        </div>

        {/* Engagements table */}
        <div className="cd-table cd-table--stack" style={{ gridColumn: 'span 2', minWidth: 0 }}>
          <div className="cd-thead">
            <span style={{ flex: 1, minWidth: 120 }}>Name</span>
            <span style={{ width: 90, flexShrink: 0 }}>Type</span>
            <span style={{ width: 100, flexShrink: 0 }}>Status</span>
            <span style={{ width: 80, flexShrink: 0 }}>Jira</span>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          ) : !engagements?.length ? (
            <EmptyState title="No engagements yet" message="Create your first engagement to start tracking findings."
              icon={<Icon path={ICONS.engagements} size={22} />} />
          ) : (
            engagements.map((e) => (
              <div
                key={e.id}
                className="cd-row cd-row--link"
                role="button"
                tabIndex={0}
                onClick={() => openEngagement(e)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openEngagement(e); } }}
              >
                <span style={{ flex: 1, minWidth: 120, fontSize: 14, fontWeight: 600 }}>{e.name}</span>
                <span style={{ width: 90, flexShrink: 0 }}><EngagementTypeBadge type={e.type} /></span>
                <span style={{ width: 100, flexShrink: 0 }}><EngagementStatusChip status={e.status} /></span>
                <Mono style={{ width: 80, flexShrink: 0, fontSize: 12, color: 'var(--text-2)' }}>{e.jiraProject}</Mono>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Detail
   ========================================================================== */
export function EngagementDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { data: engagements, isLoading: loadingEngagements } = useEngagements();
  const { data: findings, isLoading: loadingFindings } = useFindings();

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  // Simulated per-finding export state (finding.jiraKey is the seeded "already exported" marker).
  const [exportedKeys, setExportedKeys] = useState<Record<string, string | undefined>>({});

  const engagement = engagements?.find((e) => e.id === id);

  function toggle(findingId: string) {
    setSelected((prev) => ({ ...prev, [findingId]: !prev[findingId] }));
  }

  function exportOne(f: Finding) {
    const key = exportedKeys[f.id] ?? f.jiraKey;
    const jiraProject = engagement?.jiraProject ?? 'PEN';
    const newKey = key ?? `${jiraProject}-${Math.floor(Math.random() * 900 + 100)}`;
    setExportedKeys((prev) => ({ ...prev, [f.id]: newKey }));
    notify(key ? `Re-exported ${f.title} to Jira (${newKey})` : `Exported ${f.title} to Jira (${newKey})`, 'success');
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;

  function exportSelected() {
    if (!findings) return;
    findings.filter((f) => selected[f.id]).forEach((f) => exportOne(f));
    notify(`Exported selected (${selectedCount})`, 'success');
  }

  if (loadingEngagements || loadingFindings) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>;
  }

  if (!engagement) {
    return (
      <EmptyState
        title="Engagement not found"
        message="It may have been deleted or moved."
        action={<Button onClick={() => navigate('/engagements')}>Back to engagements</Button>}
      />
    );
  }

  const rows = findings ?? [];

  return (
    <div>
      <button className="cd-btn cd-btn--ghost" style={{ padding: 0, marginBottom: 16 }} onClick={() => navigate('/engagements')}>
        <Icon path={ICONS.back} size={15} strokeWidth={2} /> Engagements
      </button>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h1 className="cd-page-h1">{engagement.name}</h1>
        <EngagementTypeBadge type={engagement.type} />
        <EngagementStatusChip status={engagement.status} />
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={() => notify('Edit engagement', 'info')}>Edit</Button>
      </div>

      <div className="cd-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: 18, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <h3 className="cd-h3" style={{ marginBottom: 2 }}>Export to Jira</h3>
            <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0 }}>
              Target project: <Mono style={{ color: 'var(--text)' }}>{engagement.jiraProject}</Mono> · {selectedCount} selected
            </p>
          </div>
          <Button onClick={exportSelected} disabled={selectedCount === 0} style={{ whiteSpace: 'nowrap' }}>
            Export selected ({selectedCount})
          </Button>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 20 }}>
            <EmptyState title="No findings for this engagement" message="Import or create findings to export them to Jira."
              icon={<Icon path={ICONS.findings} size={22} />} />
          </div>
        ) : (
          <div className="cd-table--stack">
            <div className="cd-thead">
              <span style={{ width: 18, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 140 }}>Finding</span>
              <span style={{ width: 80, flexShrink: 0 }}>Severity</span>
              <span style={{ width: 110, flexShrink: 0 }}>Export state</span>
              <span style={{ width: 90, flexShrink: 0 }} />
            </div>
            {rows.map((f) => {
              const jiraKey = exportedKeys[f.id] ?? f.jiraKey;
              const checked = !!selected[f.id];
              return (
                <div key={f.id} className="cd-row">
                  <span style={{ width: 18, flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      id={`export-${f.id}`}
                      checked={checked}
                      onChange={() => toggle(f.id)}
                      aria-label={`Select ${f.title} for Jira export`}
                      style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                  </span>
                  <label htmlFor={`export-${f.id}`} style={{ flex: 1, minWidth: 140, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                    {f.title}
                  </label>
                  <span style={{ width: 80, flexShrink: 0 }}>
                    <span className={`cd-chip sev-${f.severity}`}>{f.severity}</span>
                  </span>
                  <span style={{ width: 110, flexShrink: 0 }}>
                    {jiraKey ? <Mono style={{ fontSize: 12, color: 'var(--accent-text)' }}>{jiraKey}</Mono> : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Not exported</span>}
                  </span>
                  <span style={{ width: 90, flexShrink: 0 }}>
                    <Button variant="secondary" sm style={{ whiteSpace: 'nowrap' }} onClick={() => exportOne(f)}>
                      {jiraKey ? 'Re-export' : 'Export'}
                    </Button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
