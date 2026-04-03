import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listThreats, updateThreat, deleteThreat, type Threat, type ThreatStatus, type StrideCategory } from '../api/threats';
import { listThreatModels, type ThreatModelSummary } from '../api/threatmodels';
import ThreatCard from '../components/ThreatCard';

const STRIDE_LIST: StrideCategory[] = ['Spoofing', 'Tampering', 'Repudiation', 'Information Disclosure', 'DoS', 'Elevation of Privilege'];
const STATUS_LIST: ThreatStatus[] = ['Open', 'Investigating', 'Mitigated', 'Not Applicable'];
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low'];

const SEV_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Critical: { text: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)' },
  High:     { text: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  Medium:   { text: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  Low:      { text: '#00f2ff', bg: 'rgba(0,242,255,0.08)',  border: 'rgba(0,242,255,0.2)'  },
};

export default function ThreatsView() {
  const qc = useQueryClient();
  const [filterModel, setFilterModel]   = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterStride, setFilterStride] = useState<string>('all');
  const [filterSev, setFilterSev]       = useState<string>('all');

  const { data: models = [] } = useQuery<ThreatModelSummary[]>({
    queryKey: ['threatmodels'],
    queryFn: listThreatModels,
  });

  const activeModels = models.filter(m => !m.is_archived);

  const { data: threats = [], isLoading } = useQuery<Threat[]>({
    queryKey: ['threats', filterModel],
    queryFn: () => listThreats(filterModel !== 'all' ? { modelId: filterModel } : {}),
    enabled: filterModel !== 'all' || activeModels.length > 0,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Threat> }) => updateThreat(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['threats'] }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteThreat,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['threats'] }),
  });

  // Apply local filters
  const visible = threats.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterStride !== 'all' && t.stride_category !== filterStride) return false;
    if (filterSev !== 'all' && t.severity !== filterSev) return false;
    return true;
  }).sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));

  const total     = threats.length;
  const open      = threats.filter(t => t.status === 'Open').length;
  const mitigated = threats.filter(t => t.status === 'Mitigated').length;
  const critical  = threats.filter(t => t.severity === 'Critical').length;
  const owaspRefs = threats.reduce((n, t) => n + (t.owasp_refs?.length ?? 0), 0);

  const modelTitle = (id: string) => models.find(m => m.id === id)?.title ?? id.slice(0, 8) + '…';

  const hasFilters = filterStatus !== 'all' || filterStride !== 'all' || filterModel !== 'all' || filterSev !== 'all';

  return (
    <div style={{ padding: '32px', paddingTop: '96px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <h1 className="font-display" style={{ fontSize: '28px', marginBottom: '8px', color: '#fff' }}>Threat Catalog</h1>
      <p className="label-text" style={{ color: 'var(--on-surface-muted)', margin: '0 0 28px' }}>
        All identified threats across your models. Click any threat to expand details and OWASP guidance.
      </p>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total',      value: total,     color: 'var(--primary)' },
          { label: 'Open',       value: open,      color: '#ef4444' },
          { label: 'Mitigated',  value: mitigated, color: '#22c55e' },
          { label: 'Critical',   value: critical,  color: '#ec4899' },
          { label: 'OWASP Refs', value: owaspRefs, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="glass-panel" style={{ padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: s.color, fontFamily: 'var(--font-tech)' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', letterSpacing: '0.5px', marginTop: '4px' }}>{s.label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* Severity distribution mini-chart */}
      {total > 0 && (
        <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: 'var(--on-surface-muted)', letterSpacing: '0.5px', flexShrink: 0 }}>SEVERITY</span>
          <div style={{ flex: 1, display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', gap: '2px' }}>
            {SEV_ORDER.map(sev => {
              const count = threats.filter(t => t.severity === sev).length;
              if (count === 0) return null;
              const pct = (count / total) * 100;
              const c = SEV_COLORS[sev];
              return (
                <div
                  key={sev}
                  title={`${sev}: ${count}`}
                  style={{ width: `${pct}%`, background: c.text, borderRadius: '3px', transition: 'width 0.3s' }}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
            {SEV_ORDER.map(sev => {
              const count = threats.filter(t => t.severity === sev).length;
              if (count === 0) return null;
              const c = SEV_COLORS[sev];
              return (
                <span key={sev} style={{ fontSize: '10px', color: c.text }}>
                  {sev[0]}: {count}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { label: 'MODEL',    value: filterModel,  onChange: setFilterModel,  options: [['all', 'All Models'], ...activeModels.map(m => [m.id, m.title])] },
          { label: 'STATUS',   value: filterStatus, onChange: setFilterStatus, options: [['all', 'All'], ...STATUS_LIST.map(s => [s, s])] },
          { label: 'STRIDE',   value: filterStride, onChange: setFilterStride, options: [['all', 'All Categories'], ...STRIDE_LIST.map(s => [s, s])] },
          { label: 'SEVERITY', value: filterSev,    onChange: setFilterSev,    options: [['all', 'All'], ...SEV_ORDER.map(s => [s, s])] },
        ].map(f => (
          <div key={f.label} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--on-surface-muted)', letterSpacing: '0.5px', flexShrink: 0 }}>{f.label}</span>
            <select
              value={f.value}
              onChange={e => f.onChange(e.target.value)}
              style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', borderRadius: '6px', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
            >
              {f.options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>
        ))}
        {hasFilters && (
          <button onClick={() => { setFilterStatus('all'); setFilterStride('all'); setFilterModel('all'); setFilterSev('all'); }}
            style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--on-surface-muted)', fontSize: '11px', cursor: 'pointer' }}>
            Clear filters
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--on-surface-muted)' }}>
          {visible.length} of {total} threats
        </span>
      </div>

      {/* Threat list */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        {isLoading && <p style={{ color: 'var(--on-surface-muted)', fontSize: '13px', margin: 0 }}>Loading threats…</p>}

        {!isLoading && filterModel === 'all' && threats.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ color: 'var(--on-surface-muted)', fontSize: '14px', margin: '0 0 8px' }}>No threats found.</p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', margin: 0 }}>
              Open a model in Modeling → click "⚡ Threats" → "Run Rule-Based Analysis"
            </p>
          </div>
        )}

        {!isLoading && visible.length === 0 && threats.length > 0 && (
          <p style={{ color: 'var(--on-surface-muted)', fontSize: '13px', margin: 0 }}>No threats match current filters.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {visible.map(t => (
            <ThreatCard
              key={t.id}
              threat={t}
              modelTitle={modelTitle(t.model_id)}
              onStatusChange={(id, status) => updateMut.mutate({ id, patch: { status } })}
              onDelete={(id) => deleteMut.mutate(id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
