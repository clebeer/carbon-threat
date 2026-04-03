import React, { useState } from 'react';
import { type Threat, type ThreatStatus } from '../api/threats';

// ── Colour palettes ──────────────────────────────────────────────────────────

const STRIDE_COLORS: Record<string, string> = {
  'Spoofing':               '#3b82f6',
  'Tampering':              '#f59e0b',
  'Repudiation':            '#8b5cf6',
  'Information Disclosure': '#ef4444',
  'DoS':                    '#f97316',
  'Elevation of Privilege': '#ec4899',
};

const SEV_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Critical: { text: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)' },
  High:     { text: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  Medium:   { text: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  Low:      { text: '#00f2ff', bg: 'rgba(0,242,255,0.08)',  border: 'rgba(0,242,255,0.2)'  },
};

const STATUS_COLORS: Record<ThreatStatus, string> = {
  Open:            '#ef4444',
  Investigating:   '#f59e0b',
  Mitigated:       '#22c55e',
  'Not Applicable':'#64748b',
};

const OWASP_TYPE_META: Record<string, { label: string; bg: string; color: string; border: string; icon: string }> = {
  OWASP_TOP10: {
    label: 'OWASP Top 10',
    bg:    'rgba(239,68,68,0.08)',
    color: '#ef4444',
    border:'rgba(239,68,68,0.25)',
    icon:  '🔴',
  },
  CHEAT_SHEET: {
    label: 'Cheat Sheet',
    bg:    'rgba(0,242,255,0.06)',
    color: '#00f2ff',
    border:'rgba(0,242,255,0.2)',
    icon:  '📋',
  },
  CWE: {
    label: 'CWE',
    bg:    'rgba(245,158,11,0.08)',
    color: '#f59e0b',
    border:'rgba(245,158,11,0.25)',
    icon:  '⚠',
  },
};

const STATUS_LIST: ThreatStatus[] = ['Open', 'Investigating', 'Mitigated', 'Not Applicable'];

// ── Sub-components ─────────────────────────────────────────────────────────

function SevBadge({ s }: { s: string }) {
  const c = SEV_COLORS[s] ?? SEV_COLORS.Medium;
  return (
    <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontWeight: 700, letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
      {s.toUpperCase()}
    </span>
  );
}

interface OwaspGuideProps {
  refs: Threat['owasp_refs'];
}

function OwaspGuide({ refs }: OwaspGuideProps) {
  const [expandedType, setExpandedType] = useState<string | null>(null);

  if (!refs?.length) {
    return (
      <div style={{ padding: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--on-surface-muted)' }}>No OWASP references mapped for this threat category.</p>
      </div>
    );
  }

  // Group refs by type
  const grouped = refs.reduce<Record<string, typeof refs>>((acc, r) => {
    (acc[r.type] = acc[r.type] ?? []).push(r);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Object.entries(grouped).map(([type, items]) => {
        const meta = OWASP_TYPE_META[type] ?? OWASP_TYPE_META.CWE;
        const isExpanded = expandedType === type;
        return (
          <div key={type} style={{ borderRadius: '8px', border: `1px solid ${meta.border}`, overflow: 'hidden' }}>
            {/* Group header */}
            <button
              onClick={() => setExpandedType(isExpanded ? null : type)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: meta.bg, border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px' }}>{meta.icon}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: meta.color, letterSpacing: '0.5px' }}>{meta.label}</span>
                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}>
                  {items.length}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: meta.color }}>{isExpanded ? '▲' : '▼'}</span>
            </button>

            {/* Refs list */}
            {isExpanded && (
              <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(0,0,0,0.2)' }}>
                {items.map((r, i) => (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '6px', background: meta.bg, border: `1px solid ${meta.border}`, textDecoration: 'none', transition: 'filter 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.2)')}
                    onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
                  >
                    <div style={{ flexShrink: 0 }}>
                      <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.border}`, letterSpacing: '0.3px' }}>
                        {r.ref}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 500, lineHeight: 1.4 }}>{r.title}</div>
                      <div style={{ fontSize: '10px', color: meta.color, marginTop: '3px' }}>
                        View reference ↗
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main ThreatCard component ──────────────────────────────────────────────

export interface ThreatCardProps {
  threat: Threat;
  modelTitle?: string;
  onStatusChange: (id: string, status: ThreatStatus) => void;
  onDelete: (id: string) => void;
  defaultExpanded?: boolean;
}

export default function ThreatCard({ threat: t, modelTitle, onStatusChange, onDelete, defaultExpanded = false }: ThreatCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState<'details' | 'owasp'>('details');

  const strideColor = STRIDE_COLORS[t.stride_category] ?? '#666';

  return (
    <div
      style={{
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: `3px solid ${strideColor}`,
        overflow: 'hidden',
        transition: 'all 0.15s',
      }}
    >
      {/* Row header — always visible */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>{t.title}</span>
            <SevBadge s={t.severity} />
            {t.source !== 'manual' && (
              <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '10px', background: t.source === 'rule' ? 'rgba(0,242,255,0.08)' : 'rgba(179,102,255,0.08)', color: t.source === 'rule' ? 'var(--primary)' : 'var(--secondary)', border: `1px solid ${t.source === 'rule' ? 'rgba(0,242,255,0.2)' : 'rgba(179,102,255,0.2)'}` }}>
                {t.source}
              </span>
            )}
            {(t.owasp_refs?.length ?? 0) > 0 && (
              <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                {t.owasp_refs!.length} OWASP ref{t.owasp_refs!.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '5px' }}>
            <span style={{ fontSize: '11px', color: strideColor }}>{t.stride_category}</span>
            {modelTitle && <span style={{ fontSize: '11px', color: 'var(--on-surface-muted)' }}>{modelTitle}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <select
            value={t.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { e.stopPropagation(); onStatusChange(t.id, e.target.value as ThreatStatus); }}
            style={{ fontSize: '11px', padding: '3px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: STATUS_COLORS[t.status as ThreatStatus] ?? 'var(--on-surface-muted)', cursor: 'pointer', outline: 'none' }}
          >
            {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span style={{ fontSize: '11px', color: 'var(--on-surface-muted)', userSelect: 'none' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {(['details', 'owasp'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{ flex: 1, padding: '8px', border: 'none', background: activeTab === tab ? 'rgba(255,255,255,0.04)' : 'transparent', color: activeTab === tab ? '#e2e8f0' : 'var(--on-surface-muted)', fontSize: '11px', cursor: 'pointer', borderBottom: `2px solid ${activeTab === tab ? 'var(--primary)' : 'transparent'}`, fontWeight: activeTab === tab ? 600 : 400, letterSpacing: '0.5px', transition: 'all 0.15s', textTransform: 'uppercase' }}
              >
                {tab === 'details' ? 'Details & Mitigation' : `OWASP Guide (${t.owasp_refs?.length ?? 0})`}
              </button>
            ))}
          </div>

          <div style={{ padding: '14px 16px' }}>
            {activeTab === 'details' && (
              <div>
                {t.description && (
                  <p style={{ fontSize: '13px', color: 'var(--on-surface-muted)', margin: '0 0 14px', lineHeight: 1.6 }}>{t.description}</p>
                )}

                {t.mitigation ? (
                  <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px' }}>🛡</span>
                      <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: 700, letterSpacing: '0.5px' }}>RECOMMENDED MITIGATION</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.6 }}>{t.mitigation}</p>
                  </div>
                ) : (
                  <div style={{ padding: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', marginBottom: '14px', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--on-surface-muted)' }}>No mitigation defined. Update the threat record to add one.</p>
                  </div>
                )}

                {/* Affected components */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(t.node_ids?.length ?? 0) > 0 && (
                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', background: 'rgba(0,242,255,0.06)', border: '1px solid rgba(0,242,255,0.15)', color: 'var(--primary)' }}>
                      ◉ {t.node_ids!.length} affected node{t.node_ids!.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {(t.edge_ids?.length ?? 0) > 0 && (
                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', background: 'rgba(179,102,255,0.06)', border: '1px solid rgba(179,102,255,0.15)', color: 'var(--secondary)' }}>
                      → {t.edge_ids!.length} affected connection{t.edge_ids!.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {t.rule_id && (
                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--on-surface-muted)' }}>
                      rule: {t.rule_id}
                    </span>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'owasp' && (
              <div>
                <p style={{ fontSize: '12px', color: 'var(--on-surface-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                  Security standards and guidelines relevant to this threat. Click any reference to open the official documentation.
                </p>
                <OwaspGuide refs={t.owasp_refs} />
              </div>
            )}

            {/* Footer actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button
                onClick={() => { if (window.confirm('Delete this threat?')) onDelete(t.id); }}
                style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '4px', border: '1px solid rgba(255,77,79,0.2)', background: 'transparent', color: 'rgba(255,77,79,0.7)', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,77,79,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,77,79,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,77,79,0.2)'; }}
              >
                Delete threat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
