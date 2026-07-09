import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, SeverityChip, StatusPill, SlaBadge, Mono, Spinner, EmptyState, Icon, ICONS } from '../../ui/primitives';
import { useFindings } from '../../api/carbon';
import { FindingStatus, Severity } from '../../domain/types';

export default function FindingsListView() {
  const navigate = useNavigate();
  const [severity, setSeverity] = useState<Severity | 'all'>('all');
  const [status, setStatus] = useState<FindingStatus | 'all'>('all');
  const { data: findings, isLoading } = useFindings({ severity, status });

  return (
    <div>
      <h1 className="cd-page-h1" style={{ marginBottom: 4 }}>Findings</h1>
      <p className="cd-page-sub" style={{ marginBottom: 20 }}>{findings?.length ?? 0} findings · carbon-dojo</p>

      {/* Filter bar */}
      <div className="cd-filterbar" style={{ marginBottom: 14 }}>
        <div style={{ minWidth: 140 }}>
          <label className="cd-label" htmlFor="f-org">Organization</label>
          <select id="f-org" className="cd-select"><option>Acme Corp</option></select>
        </div>
        <div style={{ minWidth: 140 }}>
          <label className="cd-label" htmlFor="f-bu">Business Unit</label>
          <select id="f-bu" className="cd-select"><option>Plataforma</option></select>
        </div>
        <div style={{ minWidth: 140 }}>
          <label className="cd-label" htmlFor="f-prod">Product</label>
          <select id="f-prod" className="cd-select"><option>carbon-dojo</option></select>
        </div>
        <div style={{ minWidth: 130 }}>
          <label className="cd-label" htmlFor="f-sev">Severity</label>
          <select id="f-sev" className="cd-select" value={severity} onChange={(e) => setSeverity(e.target.value as Severity | 'all')}>
            <option value="all">All</option><option value="critical">Critical</option><option value="high">High</option>
            <option value="medium">Medium</option><option value="low">Low</option><option value="info">Info</option>
          </select>
        </div>
        <div style={{ minWidth: 130 }}>
          <label className="cd-label" htmlFor="f-status">Status</label>
          <select id="f-status" className="cd-select" value={status} onChange={(e) => setStatus(e.target.value as FindingStatus | 'all')}>
            <option value="all">All</option><option value="triage">Triage</option><option value="active">Active</option><option value="resolved">Resolved</option>
          </select>
        </div>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={() => { setSeverity('all'); setStatus('all'); }}>Reset</Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
      ) : !findings?.length ? (
        <EmptyState title="No findings match these filters" message="Adjust the filters or reset to see the full backlog."
          icon={<Icon path={ICONS.file} size={22} />} action={<Button variant="secondary" onClick={() => { setSeverity('all'); setStatus('all'); }}>Reset filters</Button>} />
      ) : (
        <div className="cd-table cd-table--stack">
          <div className="cd-thead">
            <span style={{ width: 88, flexShrink: 0 }}>Severity</span>
            <span style={{ flex: 1, minWidth: 160 }}>Title</span>
            <span style={{ width: 110, flexShrink: 0 }}>Status</span>
            <span style={{ width: 100, flexShrink: 0 }}>SLA</span>
            <span style={{ width: 80, flexShrink: 0 }}>ID</span>
          </div>
          {findings.map((f) => (
            <div key={f.id} className="cd-row cd-row--link" role="button" tabIndex={0}
              onClick={() => navigate(`/findings/${f.id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/findings/${f.id}`); } }}>
              <span style={{ width: 88, flexShrink: 0 }}><SeverityChip severity={f.severity} /></span>
              <span style={{ flex: 1, minWidth: 160, fontSize: 14, fontWeight: 500 }}>{f.title}</span>
              <span style={{ width: 110, flexShrink: 0 }}><StatusPill status={f.status} /></span>
              <span style={{ width: 100, flexShrink: 0 }}><SlaBadge sla={f.sla} /></span>
              <Mono style={{ width: 80, flexShrink: 0, fontSize: 12, color: 'var(--text-3)' }}>{f.jiraKey ?? '—'}</Mono>
            </div>
          ))}
          <div className="cd-tablefoot">
            <span>Showing {findings.length} findings</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" sm disabled>Previous</Button>
              <Button variant="secondary" sm>Next</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
