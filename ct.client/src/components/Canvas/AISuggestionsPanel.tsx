import React, { useState } from 'react';
import type { Node } from 'reactflow';
import { suggestThreats, type ThreatSuggestion } from '../../api/ai';
import { DEFAULT_KIND_LABEL } from './assets/kindLabels';
import type { CyberNodeData } from './CyberNode';

// ── Severity badge ────────────────────────────────────────────────────────────

const SEV_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  High:   { bg: 'rgba(255,77,79,0.12)',  text: 'var(--error)',   border: 'rgba(255,77,79,0.3)' },
  Medium: { bg: 'rgba(250,173,20,0.12)', text: '#faad14',        border: 'rgba(250,173,20,0.3)' },
  Low:    { bg: 'rgba(0,242,255,0.08)',  text: 'var(--primary)', border: 'rgba(0,242,255,0.2)' },
};

export function SeverityBadge({ severity }: { severity: string }) {
  const c = SEV_COLORS[severity] ?? SEV_COLORS.Medium;
  return (
    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontWeight: 600, letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
      {severity.toUpperCase()}
    </span>
  );
}

// ── AI Suggestions panel ──────────────────────────────────────────────────────

interface AIPanelProps {
  node: Node<CyberNodeData>;
  onClose: () => void;
  onAccept: (threat: ThreatSuggestion) => void;
}

export function AISuggestionsPanel({ node, onClose, onAccept }: AIPanelProps) {
  const [loading, setSuggLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ThreatSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  const kindLabel = DEFAULT_KIND_LABEL[node.data.kind] ?? node.data.kind;

  async function handleAnalyse() {
    setSuggLoading(true);
    setError(null);
    setSuggestions([]);
    setAccepted(new Set());
    setRejected(new Set());
    try {
      const result = await suggestThreats(node.id, node.data.label, node.data.kind);
      setSuggestions(result.suggestions);
    } catch {
      setError('AI service unavailable. Configure a provider in Settings → Integrations.');
    } finally {
      setSuggLoading(false);
    }
  }

  return (
    <div className="glass-panel" style={{ position: 'absolute', top: 0, right: 0, width: '320px', height: '100%', zIndex: 50, display: 'flex', flexDirection: 'column', borderRadius: 0, borderTop: 'none', borderRight: 'none', borderBottom: 'none', borderLeft: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto' }}>
      <div style={{ padding: '18px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--secondary)', marginBottom: '4px' }}>AI THREAT ANALYSIS</div>
          <div style={{ fontSize: '15px', color: '#fff', fontFamily: 'var(--font-tech)' }}>{node.data.label}</div>
          <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', marginTop: '2px' }}>{kindLabel} component</div>
        </div>
        <button aria-label="Close"  onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--on-surface-muted)', width: '24px', height: '24px', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 }}>×</button>
      </div>
      <div style={{ padding: '14px 18px', flexShrink: 0 }}>
        <button onClick={handleAnalyse} disabled={loading} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(179,102,255,0.3)', background: loading ? 'rgba(179,102,255,0.3)' : 'rgba(179,102,255,0.12)', color: 'var(--secondary)', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.5px' }}>
          {loading ? '⟳  Analysing…' : '✦  Run STRIDE Analysis'}
        </button>
      </div>
      {error && (
        <div style={{ margin: '0 18px 14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,77,79,0.08)', border: '1px solid rgba(255,77,79,0.2)', fontSize: '12px', color: 'var(--error)' }}>
          {error}
        </div>
      )}
      {suggestions.length === 0 && !loading && !error && (
        <div style={{ padding: '0 18px', fontSize: '12px', color: 'var(--on-surface-muted)', lineHeight: 1.6 }}>
          Click "Run STRIDE Analysis" to get AI-generated threat suggestions for this component.
        </div>
      )}
      <div style={{ flex: 1, padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {suggestions.map((t: ThreatSuggestion, idx: number) => {
          const isAcc = accepted.has(idx);
          const isRej = rejected.has(idx);
          return (
            <div key={idx} style={{ padding: '12px', borderRadius: '8px', background: isAcc ? 'rgba(0,242,255,0.06)' : isRej ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isAcc ? 'rgba(0,242,255,0.2)' : isRej ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.08)'}`, opacity: isRej ? 0.4 : 1, transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '5px' }}>
                <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>{t.title}</span>
                <SeverityBadge severity={t.severity} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--secondary)', marginBottom: '5px' }}>{t.strideCategory}</div>
              {t.mitigation && <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', lineHeight: 1.5, marginBottom: '8px' }}>{t.mitigation}</div>}
              {!isAcc && !isRej && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => { setAccepted((s: Set<number>) => new Set(s).add(idx)); onAccept(t); }} style={{ flex: 1, padding: '4px', borderRadius: '4px', border: '1px solid rgba(0,242,255,0.3)', background: 'transparent', color: 'var(--primary)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>Accept</button>
                  <button onClick={() => setRejected((s: Set<number>) => new Set(s).add(idx))} style={{ flex: 1, padding: '4px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--on-surface-muted)', fontSize: '11px', cursor: 'pointer' }}>Dismiss</button>
                </div>
              )}
              {isAcc && <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>✓ Added to model</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}