import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listThreats, updateThreat, analyzeModel, type Threat, type ThreatStatus } from '../../api/threats';
import { useAnalysisStore } from '../../store/analysisStore';

const STRIDE_COLORS: Record<string, string> = {
  'Spoofing':               '#3b82f6',
  'Tampering':              '#f59e0b',
  'Repudiation':            '#8b5cf6',
  'Information Disclosure': '#ef4444',
  'DoS':                    '#f97316',
  'Elevation of Privilege': '#ec4899',
};

const SEV_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Critical: { bg: 'rgba(239,68,68,0.15)',  text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  High:     { bg: 'rgba(249,115,22,0.12)', text: '#f97316', border: 'rgba(249,115,22,0.3)' },
  Medium:   { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  Low:      { bg: 'rgba(0,242,255,0.08)',  text: 'var(--primary)', border: 'rgba(0,242,255,0.2)' },
};

const OWASP_TYPE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  OWASP_TOP10:  { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444',  border: 'rgba(239,68,68,0.25)' },
  CHEAT_SHEET:  { bg: 'rgba(0,242,255,0.08)',  color: 'var(--primary)', border: 'rgba(0,242,255,0.2)' },
  CWE:          { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b',  border: 'rgba(245,158,11,0.25)' },
};

const STATUS_OPTIONS: ThreatStatus[] = ['Open', 'Investigating', 'Mitigated', 'Not Applicable'];
const STATUS_COLORS: Record<ThreatStatus, string> = {
  Open:            'var(--error)',
  Investigating:   '#f59e0b',
  Mitigated:       '#22c55e',
  'Not Applicable':'var(--on-surface-muted)',
};

function SeverityBadge({ s }: { s: string }) {
  const c = SEV_COLORS[s] ?? SEV_COLORS.Medium;
  return (
    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontWeight: 700, letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
      {s.toUpperCase()}
    </span>
  );
}

function OwaspSection({ refs }: { refs: Threat['owasp_refs'] }) {
  if (!refs?.length) return null;

  // Group by type
  const grouped = refs.reduce<Record<string, typeof refs>>((acc, r) => {
    (acc[r.type] = acc[r.type] ?? []).push(r);
    return acc;
  }, {});

  const typeLabels: Record<string, string> = {
    OWASP_TOP10: 'OWASP Top 10',
    CHEAT_SHEET: 'Cheat Sheets',
    CWE:         'CWE',
  };

  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ fontSize: '10px', color: 'var(--secondary)', letterSpacing: '0.5px', marginBottom: '6px' }}>OWASP REFERENCES</div>
      {Object.entries(grouped).map(([type, items]) => {
        const style = OWASP_TYPE_STYLE[type] ?? OWASP_TYPE_STYLE.CWE;
        return (
          <div key={type} style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: '9px', color: style.color, letterSpacing: '0.5px', marginBottom: '3px' }}>{typeLabels[type] ?? type}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {items.map((r, i) => (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '5px', background: style.bg, border: `1px solid ${style.border}`, textDecoration: 'none', transition: 'opacity 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, color: style.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{r.ref}</span>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{r.title}</span>
                  <span style={{ fontSize: '10px', color: style.color, flexShrink: 0 }}>↗</span>
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ThreatPanelProps {
  modelId: string;
  onClose: () => void;
}

export default function ThreatPanel({ modelId, onClose }: ThreatPanelProps) {
  const qc = useQueryClient();
  const {
    setHighlight, clearHighlight,
    selectedThreatId, setSelectedThreat,
    selectedNodeId, selectedNodeLabel, setNodeFilter,
  } = useAnalysisStore();
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ThreatStatus | 'All'>('All');

  const { data: threats = [], isLoading } = useQuery({
    queryKey: ['threats', modelId],
    queryFn: () => listThreats({ modelId }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Threat> }) => updateThreat(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['threats', modelId] }),
  });

  async function handleAnalyze() {
    setAnalyzing(true);
    setAnalyzeMsg(null);
    try {
      const result = await analyzeModel(modelId);
      setAnalyzeMsg(`✓ ${result.count} threat${result.count !== 1 ? 's' : ''} generated`);
      qc.invalidateQueries({ queryKey: ['threats', modelId] });
    } catch {
      setAnalyzeMsg('Analysis failed — check server connection');
    } finally {
      setAnalyzing(false);
      setTimeout(() => setAnalyzeMsg(null), 4000);
    }
  }

  function handleThreatClick(t: Threat) {
    if (selectedThreatId === t.id) {
      clearHighlight();
      setExpandedId(expandedId === t.id ? null : t.id);
    } else {
      setSelectedThreat(t.id);
      setHighlight(t.node_ids ?? [], t.edge_ids ?? []);
      setExpandedId(t.id);
    }
  }

  function clearNodeFilter() {
    setNodeFilter(null);
    setExpandedId(null);
  }

  // Apply all active filters
  const visible = threats.filter(t => {
    if (selectedNodeId && !(t.node_ids ?? []).includes(selectedNodeId)) return false;
    if (filterStatus !== 'All' && t.status !== filterStatus) return false;
    return true;
  });

  const countByStatus = {
    Open:          threats.filter(t => t.status === 'Open').length,
    Investigating: threats.filter(t => t.status === 'Investigating').length,
    Mitigated:     threats.filter(t => t.status === 'Mitigated').length,
  };

  return (
    <div
      className="glass-panel"
      style={{ position: 'absolute', top: 0, right: 0, width: '340px', height: '100%', zIndex: 50, display: 'flex', flexDirection: 'column', borderRadius: 0, borderTop: 'none', borderRight: 'none', borderBottom: 'none', borderLeft: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header */}
      <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--secondary)' }}>THREAT ANALYSIS</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>
              {threats.length} threat{threats.length !== 1 ? 's' : ''} identified
            </div>
          </div>
          <button onClick={() => { clearHighlight(); onClose(); }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--on-surface-muted)', width: '26px', height: '26px', borderRadius: '4px', cursor: 'pointer' }}>×</button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {(['Open', 'Investigating', 'Mitigated'] as const).map(s => (
            <div key={s} style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: STATUS_COLORS[s as ThreatStatus] }}>{countByStatus[s]}</div>
              <div style={{ fontSize: '10px', color: 'var(--on-surface-muted)' }}>{s}</div>
            </div>
          ))}
        </div>

        {/* Analyze button */}
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid rgba(0,242,255,0.3)', background: analyzing ? 'rgba(0,242,255,0.15)' : 'rgba(0,242,255,0.08)', color: 'var(--primary)', fontSize: '12px', fontWeight: 700, cursor: analyzing ? 'not-allowed' : 'pointer', letterSpacing: '0.5px', marginBottom: '4px' }}
        >
          {analyzing ? '⟳  Analyzing diagram…' : '⚡  Run Rule-Based Analysis'}
        </button>
        {analyzeMsg && (
          <div style={{ fontSize: '11px', color: analyzeMsg.startsWith('✓') ? '#22c55e' : 'var(--error)', textAlign: 'center', padding: '4px 0' }}>
            {analyzeMsg}
          </div>
        )}

        {/* F2: Active node filter banner */}
        {selectedNodeId && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(0,242,255,0.06)', border: '1px solid rgba(0,242,255,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: 'var(--primary)' }}>◉</span>
              <span style={{ fontSize: '11px', color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                {selectedNodeLabel ?? selectedNodeId}
              </span>
            </div>
            <button
              onClick={clearNodeFilter}
              style={{ background: 'transparent', border: 'none', color: 'var(--on-surface-muted)', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '0 2px' }}
              title="Clear node filter"
            >×</button>
          </div>
        )}

        {/* Hint when panel first opens */}
        {!selectedNodeId && threats.length > 0 && (
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '4px 0', marginTop: '4px' }}>
            Click a node on the canvas to filter by component
          </div>
        )}

        {/* Status filter */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '8px', marginBottom: '8px', overflowX: 'auto' }}>
          {(['All', ...STATUS_OPTIONS] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: '3px 8px', borderRadius: '12px', border: `1px solid ${filterStatus === s ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`, background: filterStatus === s ? 'rgba(0,242,255,0.1)' : 'transparent', color: filterStatus === s ? 'var(--primary)' : 'var(--on-surface-muted)', fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {s}
            </button>
          ))}
        </div>

        {/* Result count when filtering */}
        {(selectedNodeId || filterStatus !== 'All') && (
          <div style={{ fontSize: '10px', color: 'var(--on-surface-muted)', textAlign: 'right', marginBottom: '4px' }}>
            {visible.length} of {threats.length} threats
          </div>
        )}
      </div>

      {/* Threat list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
        {isLoading && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--on-surface-muted)', fontSize: '13px' }}>Loading…</div>}

        {!isLoading && visible.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--on-surface-muted)', fontSize: '12px', lineHeight: 1.6 }}>
            {threats.length === 0
              ? 'No threats yet. Click "Run Rule-Based Analysis" to auto-detect threats from the diagram.'
              : selectedNodeId
                ? `No threats linked to "${selectedNodeLabel ?? selectedNodeId}".`
                : `No threats with status "${filterStatus}".`}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {visible.map(t => {
            const isExpanded = expandedId === t.id;
            const isSelected = selectedThreatId === t.id;
            return (
              <div
                key={t.id}
                onClick={() => handleThreatClick(t)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: isSelected ? 'rgba(0,242,255,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSelected ? 'rgba(0,242,255,0.25)' : 'rgba(255,255,255,0.07)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  borderLeft: `3px solid ${STRIDE_COLORS[t.stride_category] ?? '#666'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 500, lineHeight: 1.4, flex: 1 }}>{t.title}</span>
                  <SeverityBadge s={t.severity} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: STRIDE_COLORS[t.stride_category] ?? 'var(--on-surface-muted)' }}>
                    {t.stride_category}
                  </span>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {t.source !== 'manual' && (
                      <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '10px', background: t.source === 'rule' ? 'rgba(0,242,255,0.1)' : 'rgba(179,102,255,0.1)', color: t.source === 'rule' ? 'var(--primary)' : 'var(--secondary)', border: `1px solid ${t.source === 'rule' ? 'rgba(0,242,255,0.2)' : 'rgba(179,102,255,0.2)'}` }}>
                        {t.source}
                      </span>
                    )}
                    <select
                      value={t.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { e.stopPropagation(); updateMut.mutate({ id: t.id, patch: { status: e.target.value as ThreatStatus } }); }}
                      style={{ fontSize: '10px', padding: '2px 4px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: STATUS_COLORS[t.status] ?? 'var(--on-surface-muted)', cursor: 'pointer', outline: 'none' }}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }} onClick={e => e.stopPropagation()}>
                    {t.description && (
                      <p style={{ fontSize: '11px', color: 'var(--on-surface-muted)', margin: '0 0 8px', lineHeight: 1.5 }}>{t.description}</p>
                    )}
                    {t.mitigation && (
                      <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', marginBottom: '6px' }}>
                        <div style={{ fontSize: '10px', color: '#22c55e', marginBottom: '3px', letterSpacing: '0.5px' }}>MITIGATION</div>
                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.5 }}>{t.mitigation}</p>
                      </div>
                    )}
                    <OwaspSection refs={t.owasp_refs} />
                    {/* Affected components indicator */}
                    {((t.node_ids?.length ?? 0) > 0 || (t.edge_ids?.length ?? 0) > 0) && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        {(t.node_ids?.length ?? 0) > 0 && (
                          <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px', background: 'rgba(0,242,255,0.06)', border: '1px solid rgba(0,242,255,0.15)', color: 'var(--primary)' }}>
                            {t.node_ids!.length} node{t.node_ids!.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {(t.edge_ids?.length ?? 0) > 0 && (
                          <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px', background: 'rgba(179,102,255,0.06)', border: '1px solid rgba(179,102,255,0.15)', color: 'var(--secondary)' }}>
                            {t.edge_ids!.length} connection{t.edge_ids!.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
