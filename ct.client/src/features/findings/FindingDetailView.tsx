import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, SeverityChip, StatusPill, SlaBadge, Mono, Spinner, EmptyState, Tabs, Icon, ICONS, Field, Input, Textarea } from '../../ui/primitives';
import { useFinding } from '../../api/carbon';
import { useToast } from '../../components/ui';

export default function FindingDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { data: f, isLoading } = useFinding(id);
  const [tab, setTab] = useState('overview');

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>;
  if (!f) return <EmptyState title="Finding not found" message="It may have been resolved or moved." action={<Button onClick={() => navigate('/findings')}>Back to findings</Button>} />;

  return (
    <div>
      <button className="cd-btn cd-btn--ghost" style={{ padding: 0, marginBottom: 16 }} onClick={() => navigate('/findings')}>
        <Icon path={ICONS.back} size={15} strokeWidth={2} /> Findings
      </button>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <SeverityChip severity={f.severity} />
        <h1 className="cd-page-h1">{f.title}</h1>
        <StatusPill status={f.status} />
      </div>
      <Mono style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', margin: '0 0 20px' }}>{f.cwe} · CVSS {f.cvss} · {f.jiraKey ?? 'Not exported'}</Mono>

      <div className="cd-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', marginBottom: 20 }}>
        <div className="cd-card cd-card-pad">
          <h3 className="cd-h3" style={{ marginBottom: 14 }}>Change status</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="cd-select"><option>active</option><option>resolved</option><option>false_positive</option></select>
            <Button onClick={() => notify('Status transitioned to active', 'success')}>Transition</Button>
          </div>
        </div>
        <div className="cd-card cd-card-pad">
          <h3 className="cd-h3" style={{ marginBottom: 8 }}>Export to Jira</h3>
          <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '0 0 14px' }}>Routes to the engagement's Jira project (PEN).</p>
          <Button variant="secondary" icon={<Icon path={ICONS.jira} size={15} strokeWidth={2} />} onClick={() => notify('Exported to Jira (PEN)', 'success')}>Export to Jira</Button>
        </div>
      </div>

      {/* Risk acceptance — two-person approval */}
      <div className="cd-card cd-card-pad" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <h3 className="cd-h3">Risk acceptance</h3>
          <span className="cd-badge-accent">Two-person approval</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '0 0 16px' }}>Requires a request and an approval from a different user before the risk is formally accepted.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--success)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon path={ICONS.check} size={15} strokeWidth={2.5} /></div>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>Requested</div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>by boss@carbon.local</div></div>
          </div>
          <div style={{ flex: 1, height: 2, background: 'var(--border)', minWidth: 30 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)', border: '1.5px dashed var(--border-strong)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>2</div>
            <div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Awaiting approval</div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>a different approver</div></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="Re-assess by"><Input type="date" style={{ width: 'auto' }} /></Field>
          <Button variant="secondary" onClick={() => notify('Risk acceptance requested', 'success')}>Request risk acceptance</Button>
          <Button onClick={() => notify('Approval needs a different user', 'warning')} style={{ background: 'var(--success)' }}>Approve</Button>
        </div>
      </div>

      <Tabs tabs={[{ key: 'overview', label: 'Overview' }, { key: 'comments', label: 'Comments' }, { key: 'evidence', label: 'Evidence' }]} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="cd-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
          <div className="cd-card cd-card-pad">
            <h4 className="cd-eyebrow">Description</h4>
            <p style={{ fontSize: 14, lineHeight: 1.65, margin: '0 0 20px' }}>{f.description}</p>
            <h4 className="cd-eyebrow">Remediation</h4>
            <p style={{ fontSize: 14, lineHeight: 1.65, margin: 0 }}>{f.remediation}</p>
          </div>
          <div className="cd-card cd-card-pad">
            <h4 className="cd-eyebrow">Details</h4>
            {[['Source', f.source], ['CVE', f.cve], ['CWE', f.cwe], ['CVSS', f.cvss]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{k}</span><Mono style={{ fontSize: 13 }}>{v}</Mono>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>SLA</span><SlaBadge sla={f.sla} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Jira</span><Mono style={{ fontSize: 13, color: 'var(--accent-text)' }}>{f.jiraKey ?? '—'}</Mono>
            </div>
          </div>
        </div>
      )}

      {tab === 'comments' && (
        <div className="cd-card cd-card-pad">
          <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
            <div className="cd-avatar" style={{ width: 32, height: 32 }}>A</div>
            <div><div style={{ fontSize: 13 }}><strong>analyst@carbon.local</strong> <span style={{ color: 'var(--text-3)' }}>· 2 days ago</span></div>
              <p style={{ fontSize: 14, margin: '4px 0 0', lineHeight: 1.6 }}>Confirmed reproducible on staging. Routing to dev owner for remediation, target this sprint.</p></div>
          </div>
          <Textarea placeholder="Add a comment…" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><Button onClick={() => notify('Comment posted', 'success')}>Comment</Button></div>
        </div>
      )}

      {tab === 'evidence' && (
        <EmptyState title="No evidence attached" message="Upload screenshots, request/response captures, or PoC scripts."
          icon={<Icon path={ICONS.file} size={22} />} action={<Button variant="secondary" onClick={() => notify('Evidence upload opened', 'info')}>Upload evidence</Button>} />
      )}
    </div>
  );
}
