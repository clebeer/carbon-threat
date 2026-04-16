/**
 * AttackView — MITRE ATT&CK Framework Integration
 *
 * Four tabs:
 *   Analysis   — Coverage heatmap, STRIDE→tactic gap analysis per threat model
 *   Techniques — ATT&CK technique browser with tactic filter and full-text search
 *   Modeling   — Map STRIDE threats to ATT&CK techniques; manage mappings
 *   Report     — Generate / export ATT&CK coverage report per model
 *
 * Follows Carbon Threat design system: glass-panel, CSS vars, inline styles.
 * No external UI library — same pattern as ScannerView / ThreatsView.
 */

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSyncStatus,
  triggerSync,
  listTactics,
  listTechniques,
  getTechniqueDetails,
  analyzeModelCoverage,
  listMappings,
  createThreatMapping,
  deleteThreatMapping,
  downloadReport,
  getReport,
  type AttackTactic,
  type AttackTechnique,
  type AttackObject,
  type ThreatMapping,
  type CoverageAnalysis,
  type Confidence,
} from '../api/attack';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';

// ── Design tokens ─────────────────────────────────────────────────────────────

const TACTIC_COLORS: Record<string, string> = {
  'initial-access':       '#f97316',
  'execution':            '#eab308',
  'persistence':          '#84cc16',
  'privilege-escalation': '#22c55e',
  'defense-evasion':      '#14b8a6',
  'credential-access':    '#06b6d4',
  'discovery':            '#3b82f6',
  'lateral-movement':     '#8b5cf6',
  'collection':           '#a855f7',
  'command-and-control':  '#ec4899',
  'exfiltration':         '#f43f5e',
  'impact':               'var(--error)',
  'resource-development': '#78716c',
  'reconnaissance':       '#6b7280',
};

const CONFIDENCE_COLOR: Record<Confidence, string> = {
  high:   '#52c41a',
  medium: '#f59e0b',
  low:    'var(--on-surface-muted)',
};

const STRIDE_COLOR: Record<string, string> = {
  'Spoofing':               '#06b6d4',
  'Tampering':              '#f59e0b',
  'Repudiation':            '#8b5cf6',
  'Information Disclosure': '#3b82f6',
  'Denial of Service':      'var(--error)',
  'Elevation of Privilege': '#f97316',
};

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="label-text glow-text-cyan"
      style={{ fontSize: '13px', margin: '0 0 4px', letterSpacing: '1px' }}>
      {children}
    </h3>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
      background: `${color}22`, color, border: `1px solid ${color}44`,
      fontWeight: 600, letterSpacing: '0.3px', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--on-surface-muted)', fontSize: '13px' }}>
      {message}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--primary)', fontSize: '13px' }}>
      Loading…
    </div>
  );
}

function NotSyncedBanner({ onSync, isSyncing, canSync }: { onSync: () => void; isSyncing: boolean; canSync: boolean }) {
  return (
    <div style={{
      padding: '16px 24px', margin: '0 0 24px',
      background: 'rgba(245, 158, 11, 0.08)',
      border: '1px solid rgba(245, 158, 11, 0.3)',
      borderRadius: '8px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: '16px',
    }}>
      <span style={{ fontSize: '13px', color: '#f59e0b' }}>
        {canSync
          ? 'ATT&CK data not yet loaded. Run an initial sync to enable all modules.'
          : 'ATT&CK data not yet loaded. Ask an admin to trigger the initial sync.'}
      </span>
      {canSync && (
        <button
          onClick={onSync}
          disabled={isSyncing}
          style={{
            padding: '7px 16px', borderRadius: '6px', border: 'none',
            background: 'var(--primary)', color: '#000',
            fontSize: '12px', fontWeight: 600, cursor: isSyncing ? 'not-allowed' : 'pointer',
            opacity: isSyncing ? 0.6 : 1, whiteSpace: 'nowrap',
          }}
        >
          {isSyncing ? 'Syncing…' : 'Sync Now'}
        </button>
      )}
    </div>
  );
}

// ── Model Selector ────────────────────────────────────────────────────────────

function useModels() {
  return useQuery({
    queryKey: ['threatmodels-list'],
    queryFn:  async () => {
      const { data } = await apiClient.get<{ models: { id: string; title: string }[] }>('/threatmodels');
      return data.models ?? [];
    },
    staleTime: 60_000,
  });
}

function ModelSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data: models = [] } = useModels();
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '8px 12px', borderRadius: '6px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: 'var(--on-surface)', fontSize: '13px',
        minWidth: '240px', cursor: 'pointer',
      }}
    >
      <option value="">— Select a threat model —</option>
      {models.map(m => (
        <option key={m.id} value={m.id}>{m.title}</option>
      ))}
    </select>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1: Analysis
// ══════════════════════════════════════════════════════════════════════════════

function AnalysisTab({ isSynced }: { isSynced: boolean }) {
  const [modelId, setModelId] = useState('');

  const { data: analysis, isLoading } = useQuery<CoverageAnalysis>({
    queryKey: ['attack-analysis', modelId],
    queryFn:  () => analyzeModelCoverage(modelId),
    enabled:  !!modelId && isSynced,
  });

  const coverageColor = (score: number) =>
    score >= 70 ? '#52c41a' : score >= 40 ? '#f59e0b' : 'var(--error)';

  return (
    <div style={{ padding: '24px' }}>
      {/* Model picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <SectionLabel>THREAT MODEL</SectionLabel>
        <ModelSelector value={modelId} onChange={setModelId} />
      </div>

      {!modelId && (
        <EmptyState message="Select a threat model to view ATT&CK coverage analysis." />
      )}

      {modelId && isLoading && <Spinner />}

      {analysis && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
            {[
              { label: 'Coverage Score', value: `${analysis.coverageScore}%`, color: coverageColor(analysis.coverageScore) },
              { label: 'Tactics Covered', value: `${analysis.coveredCount} / ${analysis.totalTactics}`, color: 'var(--primary)' },
              { label: 'Technique Mappings', value: String(analysis.mappings.length), color: '#8b5cf6' },
              { label: 'STRIDE Threats', value: String(analysis.threats.length), color: '#f59e0b' },
            ].map(card => (
              <div key={card.label} className="glass-panel" style={{ padding: '20px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', letterSpacing: '0.5px', marginBottom: '8px', fontFamily: 'var(--font-label)' }}>
                  {card.label.toUpperCase()}
                </div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: card.color, fontFamily: 'var(--font-tech)' }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* Coverage progress bar */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '10px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', color: 'var(--on-surface-muted)' }}>Overall ATT&CK Coverage</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: coverageColor(analysis.coverageScore), fontFamily: 'var(--font-tech)' }}>
                {analysis.coverageScore}%
              </span>
            </div>
            <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{
                height: '100%', borderRadius: '4px',
                width: `${analysis.coverageScore}%`,
                background: `linear-gradient(90deg, ${coverageColor(analysis.coverageScore)}, ${coverageColor(analysis.coverageScore)}88)`,
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>

          {/* Tactic heatmap */}
          <SectionLabel>TACTIC COVERAGE</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', margin: '12px 0 28px' }}>
            {analysis.tactics.map((tac: AttackTactic) => {
              const shortName = (tac.extra?.short_name as string) ?? '';
              const color = TACTIC_COLORS[shortName] ?? 'var(--primary)';
              return (
                <div
                  key={tac.id}
                  style={{
                    padding: '14px 16px', borderRadius: '8px',
                    background: tac.covered
                      ? `${color}18`
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${tac.covered ? `${color}44` : 'rgba(255,255,255,0.07)'}`,
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', color: tac.covered ? color : 'var(--on-surface-muted)', fontFamily: 'var(--font-tech)', fontWeight: 600 }}>
                      {tac.attack_id}
                    </span>
                    <span style={{ fontSize: '12px' }}>{tac.covered ? '✅' : '❌'}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: tac.covered ? '#e2e8f0' : 'var(--on-surface-muted)', fontWeight: tac.covered ? 500 : 400 }}>
                    {tac.name}
                  </div>
                  {tac.mappingCount > 0 && (
                    <div style={{ marginTop: '6px', fontSize: '11px', color }}>
                      {tac.mappingCount} mapping{tac.mappingCount !== 1 ? 's' : ''}
                    </div>
                  )}
                  {tac.relatedStrideCategories && tac.relatedStrideCategories.length > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {tac.relatedStrideCategories.map(s => (
                        <span key={s} style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
                          background: `${STRIDE_COLOR[s] ?? '#888'}22`, color: STRIDE_COLOR[s] ?? '#888',
                          border: `1px solid ${STRIDE_COLOR[s] ?? '#888'}44` }}>
                          {s.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <>
              <SectionLabel>GAP RECOMMENDATIONS</SectionLabel>
              <div className="glass-panel" style={{ marginTop: '12px', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      {['STRIDE Threat', 'Category', 'Missing Tactic', 'ATT&CK ID'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px',
                          color: 'var(--on-surface-muted)', letterSpacing: '0.5px', fontFamily: 'var(--font-label)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.recommendations.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '11px 16px', color: '#e2e8f0' }}>{r.threat_title}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <Badge label={r.stride_category} color={STRIDE_COLOR[r.stride_category] ?? '#888'} />
                        </td>
                        <td style={{ padding: '11px 16px', color: '#e2e8f0' }}>{r.tactic_name}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-tech)', fontSize: '12px', color: 'var(--primary)' }}>
                          {r.tactic_id}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2: Techniques
// ══════════════════════════════════════════════════════════════════════════════

function TechniquesTab({ isSynced }: { isSynced: boolean }) {
  const [search, setSearch]       = useState('');
  const [tacticFilter, setTactic] = useState('');
  const [selected, setSelected]   = useState<string | null>(null);
  const [page, setPage]           = useState(0);

  const LIMIT = 50;

  const { data: tacticsData } = useQuery({
    queryKey: ['attack-tactics'],
    queryFn:  listTactics,
    enabled:  isSynced,
  });

  const { data: techData, isLoading } = useQuery({
    queryKey: ['attack-techniques', search, tacticFilter, page],
    queryFn:  () => listTechniques({ search: search || undefined, tactic: tacticFilter || undefined, limit: LIMIT, offset: page * LIMIT }),
    enabled:  isSynced,
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['attack-technique-detail', selected],
    queryFn:  () => getTechniqueDetails(selected!),
    enabled:  !!selected && isSynced,
  });

  const tactics = tacticsData?.tactics ?? [];
  const techniques = techData?.techniques ?? [];
  const total = techData?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    setPage(0);
    setSelected(null);
  }, []);

  const tacticColor = (shortName: string) => TACTIC_COLORS[shortName] ?? 'var(--primary)';

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left panel — list */}
      <div style={{ width: '420px', flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.06)', height: '100%' }}>
        {/* Filters */}
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            placeholder="Search techniques…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--on-surface)', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <select
            value={tacticFilter}
            onChange={e => { setTactic(e.target.value); setPage(0); setSelected(null); }}
            style={{
              padding: '8px 12px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--on-surface)', fontSize: '13px', cursor: 'pointer',
            }}
          >
            <option value="">All Tactics</option>
            {tactics.map(t => (
              <option key={t.attack_id} value={t.attack_id}>{t.name}</option>
            ))}
          </select>
          <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)' }}>
            {total} technique{total !== 1 ? 's' : ''}{tacticFilter ? ` in ${tactics.find(t => t.attack_id === tacticFilter)?.name}` : ''}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {isLoading && <Spinner />}
          {!isLoading && techniques.length === 0 && <EmptyState message="No techniques found." />}
          {techniques.map((tech: AttackTechnique) => {
            const phase = tech.kill_chain_phases?.[0]?.phase_name ?? '';
            const color = tacticColor(phase);
            const isActive = selected === tech.attack_id;
            return (
              <div
                key={tech.id}
                onClick={() => setSelected(tech.attack_id)}
                style={{
                  padding: '12px 16px', cursor: 'pointer', transition: 'all 0.15s',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: isActive ? 'rgba(0,242,255,0.07)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-tech)', color: isActive ? 'var(--primary)' : color }}>
                    {tech.attack_id}
                  </span>
                  {tech.type === 'sub-technique' && (
                    <span style={{ fontSize: '10px', color: 'var(--on-surface-muted)' }}>sub-technique</span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: isActive ? '#fff' : '#e2e8f0', fontWeight: isActive ? 500 : 400 }}>
                  {tech.type === 'sub-technique' ? `↳ ${tech.name}` : tech.name}
                </div>
                {tech.platforms?.length > 0 && (
                  <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--on-surface-muted)' }}>
                    {tech.platforms.slice(0, 3).join(', ')}{tech.platforms.length > 3 ? ` +${tech.platforms.length - 3}` : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: '6px 12px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: 'var(--on-surface-muted)', fontSize: '12px',
                cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}>
              ← Prev
            </button>
            <span style={{ fontSize: '12px', color: 'var(--on-surface-muted)' }}>
              {page + 1} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              style={{ padding: '6px 12px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: 'var(--on-surface-muted)', fontSize: '12px',
                cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1 }}>
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Right panel — detail */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {!selected && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%',
            color: 'var(--on-surface-muted)', fontSize: '13px', textAlign: 'center' }}>
            Select a technique to view details
          </div>
        )}
        {selected && detailLoading && <Spinner />}
        {selected && detailData && (() => {
          const tech = detailData.technique;
          const phase = tech.kill_chain_phases?.[0]?.phase_name ?? '';
          const color = tacticColor(phase);
          return (
            <div>
              {/* Header */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontFamily: 'var(--font-tech)', color, fontWeight: 600 }}>
                    {tech.attack_id}
                  </span>
                  {tech.kill_chain_phases?.map(p => (
                    <Badge key={p.phase_name} label={p.phase_name} color={tacticColor(p.phase_name)} />
                  ))}
                  {tech.type === 'sub-technique' && <Badge label="sub-technique" color="var(--on-surface-muted)" />}
                </div>
                <h2 style={{ margin: '0 0 12px', fontSize: '22px', color: '#fff', fontFamily: 'var(--font-display)' }}>
                  {tech.name}
                </h2>
                {tech.url && (
                  <a href={tech.url} target="_blank" rel="noreferrer"
                    style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none' }}>
                    ↗ View on attack.mitre.org
                  </a>
                )}
              </div>

              {/* Platforms */}
              {tech.platforms?.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', marginBottom: '6px', letterSpacing: '0.5px' }}>PLATFORMS</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {tech.platforms.map(p => <Badge key={p} label={p} color="var(--primary)" />)}
                  </div>
                </div>
              )}

              {/* Description */}
              {tech.description && (
                <div className="glass-panel" style={{ padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>DESCRIPTION</div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: '1.65' }}>
                    {tech.description?.slice(0, 600)}{(tech.description?.length ?? 0) > 600 ? '…' : ''}
                  </p>
                </div>
              )}

              {/* Detection */}
              {tech.extra?.detection && (
                <div className="glass-panel" style={{ padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>DETECTION</div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: '1.65' }}>
                    {(tech.extra.detection as string)?.slice(0, 400)}{((tech.extra.detection as string)?.length ?? 0) > 400 ? '…' : ''}
                  </p>
                </div>
              )}

              {/* Mitigations */}
              {tech.mitigations && tech.mitigations.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <SectionLabel>MITIGATIONS ({tech.mitigations.length})</SectionLabel>
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tech.mitigations.map((m: AttackObject) => (
                      <div key={m.id} className="glass-panel" style={{ padding: '12px 16px', borderRadius: '8px',
                        borderLeft: '3px solid #52c41a' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-tech)', color: '#52c41a' }}>{m.attack_id}</span>
                          <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>{m.name}</span>
                        </div>
                        {m.description && (
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--on-surface-muted)', lineHeight: '1.5' }}>
                            {m.description.slice(0, 200)}{m.description.length > 200 ? '…' : ''}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-techniques */}
              {tech.subTechniques && tech.subTechniques.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <SectionLabel>SUB-TECHNIQUES ({tech.subTechniques.length})</SectionLabel>
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {tech.subTechniques.map((s: AttackObject) => (
                      <div key={s.id}
                        onClick={() => setSelected(s.attack_id)}
                        style={{ padding: '10px 14px', borderRadius: '6px', cursor: 'pointer',
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                          display: 'flex', gap: '12px', alignItems: 'center', transition: 'all 0.15s' }}>
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-tech)', color }}>{s.attack_id}</span>
                        <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{s.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Groups */}
              {tech.groups && tech.groups.length > 0 && (
                <div>
                  <SectionLabel>KNOWN THREAT GROUPS ({tech.groups.length})</SectionLabel>
                  <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {tech.groups.map((g) => (
                      <Badge key={g.id} label={`${g.attack_id} ${g.name}`} color="#ec4899" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3: Modeling
// ══════════════════════════════════════════════════════════════════════════════

function ModelingTab({ isSynced }: { isSynced: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAnalyst = user?.role === 'admin' || user?.role === 'analyst';

  const [modelId, setModelId]       = useState('');
  const [techSearch, setTechSearch] = useState('');
  const [selectedThreat, setThreat] = useState('');
  const [confidence, setConf]       = useState<Confidence>('medium');
  const [notes, setNotes]           = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [techId, setTechId]         = useState('');

  // Threats for selected model
  const { data: threatsData } = useQuery({
    queryKey: ['threats', modelId],
    queryFn:  async () => {
      const { data } = await apiClient.get<{ threats: { id: string; title: string; stride_category: string; severity: string }[] }>(
        `/threats?modelId=${modelId}`
      );
      return data.threats ?? [];
    },
    enabled: !!modelId,
  });

  // Existing mappings
  const { data: mappingsData, isLoading: mappingsLoading } = useQuery({
    queryKey: ['attack-mappings', modelId],
    queryFn:  () => listMappings({ modelId }),
    enabled:  !!modelId && isSynced,
  });

  // Technique search for the mapping form
  const { data: techSearchData } = useQuery({
    queryKey: ['attack-techniques-search', techSearch],
    queryFn:  () => listTechniques({ search: techSearch, limit: 20 }),
    enabled:  isSynced && techSearch.length >= 2,
  });

  const createMut = useMutation({
    mutationFn: createThreatMapping,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attack-mappings', modelId] });
      qc.invalidateQueries({ queryKey: ['attack-analysis', modelId] });
      setShowForm(false);
      setThreat('');
      setTechId('');
      setNotes('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteThreatMapping,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attack-mappings', modelId] });
      qc.invalidateQueries({ queryKey: ['attack-analysis', modelId] });
    },
  });

  const threats   = threatsData ?? [];
  const mappings  = mappingsData?.mappings ?? [];
  const techResults = techSearchData?.techniques ?? [];

  function handleCreate() {
    if (!techId || !modelId) return;
    createMut.mutate({
      threat_id:    selectedThreat || undefined,
      technique_id: techId,
      model_id:     modelId,
      confidence,
      notes: notes || undefined,
    });
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Model picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <SectionLabel>THREAT MODEL</SectionLabel>
        <ModelSelector value={modelId} onChange={v => { setModelId(v); setShowForm(false); }} />
        {modelId && isAnalyst && (
          <button
            onClick={() => setShowForm(f => !f)}
            style={{
              padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(0,242,255,0.3)',
              background: showForm ? 'rgba(0,242,255,0.1)' : 'transparent',
              color: 'var(--primary)', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {showForm ? 'Cancel' : '+ Add Mapping'}
          </button>
        )}
      </div>

      {!modelId && <EmptyState message="Select a threat model to manage ATT&CK mappings." />}

      {/* Add mapping form */}
      {showForm && modelId && (
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '10px', marginBottom: '24px', border: '1px solid rgba(0,242,255,0.15)' }}>
          <SectionLabel>NEW MAPPING</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '14px' }}>
            {/* Threat selector */}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--on-surface-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
                STRIDE THREAT (optional)
              </label>
              <select
                value={selectedThreat}
                onChange={e => setThreat(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--on-surface)', fontSize: '13px' }}
              >
                <option value="">— Model-level mapping —</option>
                {threats.map(t => (
                  <option key={t.id} value={t.id}>[{t.stride_category}] {t.title}</option>
                ))}
              </select>
            </div>

            {/* Confidence */}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--on-surface-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
                CONFIDENCE
              </label>
              <select
                value={confidence}
                onChange={e => setConf(e.target.value as Confidence)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--on-surface)', fontSize: '13px' }}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Technique search */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '11px', color: 'var(--on-surface-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
                ATT&CK TECHNIQUE *
              </label>
              <input
                placeholder="Search technique by name or ID (e.g. T1059)…"
                value={techSearch}
                onChange={e => { setTechSearch(e.target.value); setTechId(''); }}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--on-surface)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
              {techResults.length > 0 && !techId && (
                <div style={{ marginTop: '4px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)',
                  background: '#12161f', maxHeight: '200px', overflowY: 'auto' }}>
                  {techResults.map(t => (
                    <div
                      key={t.id}
                      onClick={() => { setTechId(t.attack_id); setTechSearch(`${t.attack_id} — ${t.name}`); }}
                      style={{ padding: '9px 14px', cursor: 'pointer', fontSize: '13px',
                        display: 'flex', gap: '10px', alignItems: 'center',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,242,255,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-tech)', color: 'var(--primary)' }}>{t.attack_id}</span>
                      <span style={{ color: '#e2e8f0' }}>{t.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {techId && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#52c41a' }}>
                  ✓ Selected: {techSearch}
                </div>
              )}
            </div>

            {/* Notes */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '11px', color: 'var(--on-surface-muted)', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
                NOTES (optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Why does this threat map to this technique?"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--on-surface)', fontSize: '13px', outline: 'none',
                  resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
            <button
              onClick={handleCreate}
              disabled={!techId || createMut.isPending}
              style={{ padding: '9px 20px', borderRadius: '6px', border: 'none',
                background: 'var(--primary)', color: '#000', fontSize: '13px', fontWeight: 600,
                cursor: !techId ? 'not-allowed' : 'pointer', opacity: !techId ? 0.5 : 1 }}
            >
              {createMut.isPending ? 'Saving…' : 'Save Mapping'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{ padding: '9px 16px', borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: 'var(--on-surface-muted)', fontSize: '13px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
          {createMut.isError && (
            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--error)' }}>
              {(createMut.error as Error).message}
            </div>
          )}
        </div>
      )}

      {/* Mappings table */}
      {modelId && (
        <>
          <SectionLabel>TECHNIQUE MAPPINGS ({mappings.length})</SectionLabel>
          <div style={{ marginTop: '12px' }}>
            {mappingsLoading && <Spinner />}
            {!mappingsLoading && mappings.length === 0 && (
              <EmptyState message="No mappings yet. Add one with the button above." />
            )}
            {mappings.length > 0 && (
              <div className="glass-panel" style={{ borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      {['STRIDE Threat', 'ATT&CK Technique', 'Tactics', 'Confidence', 'Notes', ''].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px',
                          color: 'var(--on-surface-muted)', letterSpacing: '0.5px', fontFamily: 'var(--font-label)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((m: ThreatMapping) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '11px 16px' }}>
                          {m.threat_title ? (
                            <div>
                              <div style={{ color: '#e2e8f0', marginBottom: '3px' }}>{m.threat_title}</div>
                              {m.threat_stride && <Badge label={m.threat_stride} color={STRIDE_COLOR[m.threat_stride] ?? '#888'} />}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--on-surface-muted)', fontStyle: 'italic' }}>Model-level</span>
                          )}
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-tech)', fontSize: '12px', color: 'var(--primary)' }}>
                              {m.technique_attack_id}
                            </span>
                            <span style={{ color: '#e2e8f0' }}>{m.technique_name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {(m.kill_chain_phases ?? []).map(p => (
                              <Badge key={p.phase_name} label={p.phase_name} color={TACTIC_COLORS[p.phase_name] ?? 'var(--primary)'} />
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <Badge label={m.confidence} color={CONFIDENCE_COLOR[m.confidence] ?? '#888'} />
                        </td>
                        <td style={{ padding: '11px 16px', color: 'var(--on-surface-muted)', maxWidth: '200px' }}>
                          <span style={{ fontSize: '12px' }}>{m.notes ?? '—'}</span>
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          {isAnalyst && (
                            <button
                              onClick={() => deleteMut.mutate(m.id)}
                              disabled={deleteMut.isPending}
                              style={{ padding: '4px 10px', borderRadius: '5px',
                                border: '1px solid rgba(255,77,79,0.3)',
                                background: 'transparent', color: 'var(--error)',
                                fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4: Report
// ══════════════════════════════════════════════════════════════════════════════

function ReportTab({ isSynced }: { isSynced: boolean }) {
  const [modelId, setModelId]   = useState('');
  const [format, setFormat]     = useState<'json' | 'markdown'>('markdown');
  const [downloading, setDl]    = useState(false);
  const [dlError, setDlError]   = useState('');

  const { data: report, isLoading } = useQuery({
    queryKey: ['attack-report', modelId],
    queryFn:  () => getReport(modelId),
    enabled:  !!modelId && isSynced,
  });

  async function handleDownload() {
    if (!modelId) return;
    setDl(true);
    setDlError('');
    try {
      await downloadReport(modelId, format);
    } catch (err: unknown) {
      setDlError((err as Error).message ?? 'Download failed');
    } finally {
      setDl(false);
    }
  }

  const r = report?.report;
  const coverageColor = (s: number) => s >= 70 ? '#52c41a' : s >= 40 ? '#f59e0b' : 'var(--error)';

  return (
    <div style={{ padding: '24px' }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
        <SectionLabel>THREAT MODEL</SectionLabel>
        <ModelSelector value={modelId} onChange={setModelId} />

        {modelId && (
          <>
            <select
              value={format}
              onChange={e => setFormat(e.target.value as 'json' | 'markdown')}
              style={{ padding: '8px 12px', borderRadius: '6px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--on-surface)', fontSize: '13px', cursor: 'pointer' }}
            >
              <option value="markdown">Markdown (.md)</option>
              <option value="json">JSON (.json)</option>
            </select>
            <button
              onClick={handleDownload}
              disabled={downloading || !isSynced}
              style={{ padding: '8px 20px', borderRadius: '6px', border: 'none',
                background: 'var(--primary)', color: '#000', fontSize: '13px', fontWeight: 600,
                cursor: downloading ? 'not-allowed' : 'pointer', opacity: downloading ? 0.6 : 1 }}
            >
              {downloading ? 'Exporting…' : '↓ Export Report'}
            </button>
          </>
        )}
      </div>

      {dlError && (
        <div style={{ padding: '12px 16px', borderRadius: '6px', background: 'rgba(255,77,79,0.1)',
          border: '1px solid rgba(255,77,79,0.3)', color: 'var(--error)', fontSize: '13px', marginBottom: '20px' }}>
          {dlError}
        </div>
      )}

      {!modelId && <EmptyState message="Select a threat model to generate an ATT&CK report." />}
      {modelId && isLoading && <Spinner />}

      {r && (
        <>
          {/* Executive summary */}
          <div style={{ marginBottom: '28px' }}>
            <SectionLabel>EXECUTIVE SUMMARY</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginTop: '12px' }}>
              {[
                { label: 'Coverage', value: `${r.summary.coverageScore}%`, color: coverageColor(r.summary.coverageScore) },
                { label: 'Tactics Covered', value: `${r.summary.coveredTactics}/${r.summary.totalTactics}`, color: 'var(--primary)' },
                { label: 'Threats', value: String(r.summary.totalThreats), color: '#f59e0b' },
                { label: 'Mappings', value: String(r.summary.totalMappings), color: '#8b5cf6' },
                { label: 'Model', value: r.model.title, color: '#e2e8f0' },
              ].map(c => (
                <div key={c.label} className="glass-panel" style={{ padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--on-surface-muted)', marginBottom: '6px', letterSpacing: '0.5px', fontFamily: 'var(--font-label)' }}>
                    {c.label.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: c.color,
                    fontFamily: c.label === 'Model' ? 'var(--font-display)' : 'var(--font-tech)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tactic coverage table */}
          <div style={{ marginBottom: '28px' }}>
            <SectionLabel>TACTIC COVERAGE MATRIX</SectionLabel>
            <div className="glass-panel" style={{ borderRadius: '10px', overflow: 'hidden', marginTop: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {['Tactic', 'ID', 'Status', 'STRIDE Link', 'Mappings'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px',
                        color: 'var(--on-surface-muted)', letterSpacing: '0.5px', fontFamily: 'var(--font-label)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.tactics.map((t: AttackTactic) => {
                    const shortName = (t.extra?.short_name as string) ?? '';
                    const color = TACTIC_COLORS[shortName] ?? 'var(--primary)';
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 16px', color: '#e2e8f0' }}>{t.name}</td>
                        <td style={{ padding: '10px 16px', fontFamily: 'var(--font-tech)', fontSize: '12px', color }}>
                          {t.attack_id}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: '12px' }}>{t.covered ? '✅ Covered' : '❌ Gap'}</span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {(t.relatedStrideCategories ?? []).map(s => (
                              <Badge key={s} label={s.split(' ')[0]} color={STRIDE_COLOR[s] ?? '#888'} />
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px', color: t.mappingCount ? 'var(--primary)' : 'var(--on-surface-muted)',
                          fontFamily: 'var(--font-tech)' }}>
                          {t.mappingCount ?? 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mappings */}
          {r.mappings.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <SectionLabel>TECHNIQUE MAPPINGS</SectionLabel>
              <div className="glass-panel" style={{ borderRadius: '10px', overflow: 'hidden', marginTop: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      {['Threat', 'Technique', 'ATT&CK ID', 'Confidence'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px',
                          color: 'var(--on-surface-muted)', letterSpacing: '0.5px', fontFamily: 'var(--font-label)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.mappings.map((m: ThreatMapping) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 16px', color: '#e2e8f0' }}>
                          {m.threat_title ?? <em style={{ color: 'var(--on-surface-muted)' }}>Model-level</em>}
                        </td>
                        <td style={{ padding: '10px 16px', color: '#e2e8f0' }}>{m.technique_name}</td>
                        <td style={{ padding: '10px 16px', fontFamily: 'var(--font-tech)', fontSize: '12px', color: 'var(--primary)' }}>
                          {m.technique_attack_id}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <Badge label={m.confidence} color={CONFIDENCE_COLOR[m.confidence] ?? '#888'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {r.recommendations.length > 0 && (
            <div>
              <SectionLabel>GAP RECOMMENDATIONS</SectionLabel>
              <div className="glass-panel" style={{ borderRadius: '10px', overflow: 'hidden', marginTop: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      {['Threat', 'STRIDE', 'Missing Tactic', 'ATT&CK ID'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px',
                          color: 'var(--on-surface-muted)', letterSpacing: '0.5px', fontFamily: 'var(--font-label)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.recommendations.map((rec, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 16px', color: '#e2e8f0' }}>{rec.threat_title}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <Badge label={rec.stride_category} color={STRIDE_COLOR[rec.stride_category] ?? '#888'} />
                        </td>
                        <td style={{ padding: '10px 16px', color: '#e2e8f0' }}>{rec.tactic_name}</td>
                        <td style={{ padding: '10px 16px', fontFamily: 'var(--font-tech)', fontSize: '12px', color: '#f59e0b' }}>
                          {rec.tactic_id}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Root AttackView
// ══════════════════════════════════════════════════════════════════════════════

type Tab = 'analysis' | 'techniques' | 'modeling' | 'report';

const TABS: { id: Tab; label: string }[] = [
  { id: 'analysis',   label: 'Analysis'   },
  { id: 'techniques', label: 'Techniques' },
  { id: 'modeling',   label: 'Modeling'   },
  { id: 'report',     label: 'Report'     },
];

export default function AttackView() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setTab] = useState<Tab>('analysis');
  const [syncError, setSyncError] = useState<string | null>(null);

  // Sync status — poll while pending or running
  const { data: syncData, isLoading: syncLoading } = useQuery({
    queryKey: ['attack-sync-status'],
    queryFn:  getSyncStatus,
    refetchInterval: (query) => {
      const s = query.state.data?.lastSync?.status;
      return s === 'running' || s === 'pending' ? 3_000 : false;
    },
  });

  const syncMut = useMutation({
    mutationFn: triggerSync,
    onSuccess:  () => {
      setSyncError(null);
      qc.invalidateQueries({ queryKey: ['attack-sync-status'] });
    },
    onError: (err: { response?: { data?: { error?: string } }; message?: string }) => {
      setSyncError(err?.response?.data?.error ?? err?.message ?? 'Sync failed');
    },
  });

  const isSynced  = syncData?.isSynced ?? false;
  // treat both 'pending' and 'running' as in-progress so the button stays locked
  const inFlightStatus = syncData?.lastSync?.status === 'running' || syncData?.lastSync?.status === 'pending';
  const isSyncing = inFlightStatus || syncMut.isPending;

  function handleSync() {
    setSyncError(null);
    syncMut.mutate();
  }

  return (
    <div style={{ paddingTop: '64px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontFamily: 'var(--font-display)', fontWeight: 600,
            color: '#fff', letterSpacing: '-0.3px' }}>
            MITRE ATT&amp;CK<span className="glow-text-cyan"> Framework</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--on-surface-muted)' }}>
            Coverage analysis · Technique browser · Threat modeling · Reports
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Sync status pill */}
          {!syncLoading && (
            <div style={{ fontSize: '12px', color: 'var(--on-surface-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block',
                background: isSyncing ? 'var(--primary)' : isSynced ? '#52c41a' : '#f59e0b' }} />
              {isSyncing
                ? 'Syncing ATT&CK data…'
                : isSynced
                  ? `${syncData.totalObjects.toLocaleString()} objects · v${syncData.lastSync?.attack_version ?? '?'}`
                  : 'Not synced'}
            </div>
          )}
          {isAdmin && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              style={{ padding: '7px 14px', borderRadius: '6px',
                border: '1px solid rgba(0,242,255,0.3)',
                background: 'transparent', color: 'var(--primary)',
                fontSize: '12px', cursor: isSyncing ? 'not-allowed' : 'pointer',
                opacity: isSyncing ? 0.5 : 1, transition: 'all 0.2s' }}
            >
              {isSyncing ? 'Syncing…' : '↻ Sync ATT&CK Data'}
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0', padding: '16px 28px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 20px', background: 'transparent', border: 'none',
              borderBottom: activeTab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === t.id ? 'var(--primary)' : 'var(--on-surface-muted)',
              fontSize: '13px', fontWeight: activeTab === t.id ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.3px',
              fontFamily: 'var(--font-label)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sync error banner */}
      {syncError && (
        <div style={{
          margin: '0 28px 0', padding: '12px 16px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '13px', color: 'var(--error)',
        }}>
          <span>Sync failed: {syncError}</span>
          <button onClick={() => setSyncError(null)}
            style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}>
            ×
          </button>
        </div>
      )}

      {/* Not-synced banner — shown to all roles; only admin button actually fires the sync */}
      {!isSynced && !isSyncing && !syncLoading && !syncError && (
        <div style={{ padding: '0 28px' }}>
          <NotSyncedBanner onSync={handleSync} isSyncing={isSyncing} canSync={isAdmin} />
        </div>
      )}

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'analysis'   && <AnalysisTab   isSynced={isSynced} />}
        {activeTab === 'techniques' && <TechniquesTab isSynced={isSynced} />}
        {activeTab === 'modeling'   && <ModelingTab   isSynced={isSynced} />}
        {activeTab === 'report'     && <ReportTab     isSynced={isSynced} />}
      </div>
    </div>
  );
}
