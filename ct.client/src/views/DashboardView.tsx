import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import { apiClient } from '../api/client';
import { listThreatModels, type ThreatModelSummary } from '../api/threatmodels';
import { listThreats, type Threat } from '../api/threats';
import { listScans, type ScanRun } from '../api/scanner';
import { useAuthStore } from '../store/authStore';
import { useDashboardStore } from '../store/dashboardStore';
import { StatsRow } from '../components/dashboard/StatsCard';
import { StrideChart, SeverityChart, SEV_ORDER, SEV_COLORS, STRIDE_COLORS } from '../components/dashboard/ThreatChart';
import RiskHeatmap from '../components/dashboard/RiskHeatmap';
import RecentModels from '../components/dashboard/RecentModels';
import ActivityLog, { type AuditRow } from '../components/dashboard/ActivityLog';

// ── Main component ────────────────────────────────────────────────────────────

interface HealthzResponse { status: string; uptime?: number }

export default function DashboardView() {
  const user      = useAuthStore((s: any) => s.user); // eslint-disable-line @typescript-eslint/no-explicit-any
  const dashRef   = useRef<HTMLDivElement>(null);
  const { loadLayout, resetLayout } = useDashboardStore();

  // Load persisted layout on mount
  useEffect(() => { loadLayout(); }, [loadLayout]);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: health, isError: healthError } = useQuery<HealthzResponse>({
    queryKey: ['healthz'],
    queryFn: async () => { const { data } = await apiClient.get<HealthzResponse>('/healthz'); return data; },
    refetchInterval: 30_000,
    retry: false,
  });

  const { data: models = [] } = useQuery<ThreatModelSummary[]>({
    queryKey: ['threatmodels'],
    queryFn: listThreatModels,
  });

  const { data: allThreats = [] } = useQuery<Threat[]>({
    queryKey: ['threats-all'],
    queryFn: () => listThreats({}),
    enabled: models.length > 0,
  });

  const { data: scansData } = useQuery<{ scans: ScanRun[] }>({
    queryKey: ['scanner-recent-scans'],
    queryFn: listScans,
  });
  const allScans = scansData?.scans ?? [];

  const { data: auditData } = useQuery<{ logs: AuditRow[] }>({
    queryKey: ['audit-recent'],
    queryFn: async () => { const { data } = await apiClient.get('/audit?limit=8'); return data; },
    retry: false,
  });

  // ── Computed ──────────────────────────────────────────────────────────────

  const totalModels   = models.length;
  const activeModels  = models.filter(m => !m.is_archived).length;
  const totalThreats  = allThreats.length;
  const openThreats   = allThreats.filter(t => t.status === 'Open').length;
  const mitigated     = allThreats.filter(t => t.status === 'Mitigated').length;
  const critical      = allThreats.filter(t => t.severity === 'Critical').length;
  const owaspRefCount = allThreats.reduce((n, t) => n + (t.owasp_refs?.length ?? 0), 0);
  const mitigationPct = totalThreats > 0 ? Math.round((mitigated / totalThreats) * 100) : 0;

  const totalScans = allScans.length;
  const totalVulnsFound = allScans.reduce((acc, scan) => acc + (scan.vulns_found || 0), 0);
  const totalPackagesScanned = allScans.reduce((acc, scan) => acc + (scan.packages_scanned || 0), 0);
  const recentScans = [...allScans].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  const topThreats = allThreats
    .filter(t => t.status === 'Open' || t.status === 'Investigating')
    .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity))
    .slice(0, 8);

  const modelTitle = (id: string) => models.find(m => m.id === id)?.title ?? id.slice(0, 8) + '…';

  const serverStatus = healthError ? 'Degraded' : health ? 'Operational' : 'Checking…';
  const statusColor  = healthError ? 'var(--error)' : health ? 'var(--primary)' : 'var(--on-surface-muted)';

  const stats = [
    { label: 'Total Threats', value: totalThreats, color: 'var(--primary)', sub: `across ${activeModels} active model${activeModels !== 1 ? 's' : ''}` },
    { label: 'Open Threats', value: openThreats, color: '#ef4444', sub: 'require attention' },
    { label: 'Mitigated', value: mitigated, color: '#22c55e', sub: `${mitigationPct}% mitigation rate` },
    { label: 'Critical Risk', value: critical, color: '#ec4899', sub: 'highest severity' },
    { label: 'Total Scans', value: totalScans, color: '#a855f7', sub: 'OSV vulnerability scans' },
    { label: 'Total Vulns', value: totalVulnsFound, color: '#f97316', sub: 'vulnerabilities found' },
    { label: 'Scanned Pkgs', value: totalPackagesScanned, color: '#06b6d4', sub: 'dependencies checked' },
    { label: 'OWASP Refs', value: owaspRefCount, color: '#f59e0b', sub: 'standards mapped' },
  ];

  // ── Exports ───────────────────────────────────────────────────────────────

  function exportCSV() {
    const headers = ['Title', 'Severity', 'STRIDE', 'Status', 'Source', 'Model', 'Mitigation', 'OWASP Refs'];
    const rows = allThreats.map(t => [
      `"${(t.title ?? '').replace(/"/g, '""')}"`,
      t.severity,
      t.stride_category,
      t.status,
      t.source,
      `"${modelTitle(t.model_id).replace(/"/g, '""')}"`,
      `"${(t.mitigation ?? '').replace(/"/g, '""')}"`,
      (t.owasp_refs ?? []).map(r => r.ref).join('; '),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `carbonthreat-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const now  = new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
    const W    = 210;
    let   y    = 20;

    doc.setFillColor(10, 15, 28);
    doc.rect(0, 0, W, 40, 'F');
    doc.setTextColor(0, 242, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('CarbonThreat', 15, 18);
    doc.setFontSize(11);
    doc.setTextColor(160, 170, 190);
    doc.text('Executive Security Report', 15, 27);
    doc.setFontSize(9);
    doc.text(`Generated: ${now}  |  User: ${user?.email ?? '—'}`, 15, 35);
    y = 52;

    doc.setTextColor(0, 242, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('EXECUTIVE SUMMARY', 15, y);
    y += 8;

    const summaryItems = [
      ['Total Threat Models', String(totalModels)],
      ['Active Models',       String(activeModels)],
      ['Total Threats',       String(totalThreats)],
      ['Open / Unresolved',   String(openThreats)],
      ['Mitigated',           `${mitigated} (${mitigationPct}%)`],
      ['Total Scans',         String(totalScans)],
      ['Vulns Found',         String(totalVulnsFound)],
      ['Packages Scanned',    String(totalPackagesScanned)],
      ['Critical Severity',   String(critical)],
      ['OWASP References',    String(owaspRefCount)],
    ];

    doc.setFontSize(10);
    const colW = (W - 30) / 2;
    summaryItems.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x   = 15 + col * (colW + 5);
      const yy  = y + row * 10;
      doc.setFillColor(col === 0 ? 18 : 24, col === 0 ? 24 : 30, col === 0 ? 40 : 48);
      doc.roundedRect(x, yy - 5, colW, 9, 1, 1, 'F');
      doc.setTextColor(160, 170, 190);
      doc.setFont('helvetica', 'normal');
      doc.text(label, x + 3, yy);
      doc.setTextColor(220, 230, 245);
      doc.setFont('helvetica', 'bold');
      doc.text(value, x + colW - 3, yy, { align: 'right' });
    });
    y += Math.ceil(summaryItems.length / 2) * 10 + 12;

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(10, 15, 28);
      doc.rect(0, 288, W, 10, 'F');
      doc.setTextColor(80, 90, 110);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('CarbonThreat — Confidential Security Report', 15, 294);
      doc.text(`Page ${i} of ${pageCount}`, W - 15, 294, { align: 'right' });
    }

    doc.save(`carbonthreat-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={dashRef} style={{ padding: '32px', paddingTop: '96px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '28px', marginBottom: '8px', color: '#fff' }}>Security Dashboard</h1>
          <p className="label-text" style={{ color: 'var(--on-surface-muted)', margin: 0 }}>
            Risk overview · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusColor, boxShadow: healthError ? 'none' : `0 0 5px ${statusColor}` }} />
            <span style={{ fontSize: '11px', color: statusColor, letterSpacing: '0.5px' }}>API {serverStatus}</span>
          </div>
          <button
            onClick={resetLayout}
            title="Reset layout to defaults"
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'var(--on-surface-muted)', fontSize: '12px', cursor: 'pointer' }}
          >
            ↺ Reset
          </button>
          <button
            onClick={exportCSV}
            disabled={totalThreats === 0}
            title={totalThreats === 0 ? 'No threats to export' : 'Export to CSV'}
            style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'var(--on-surface-muted)', fontSize: '12px', cursor: totalThreats > 0 ? 'pointer' : 'not-allowed', opacity: totalThreats > 0 ? 1 : 0.4 }}
          >
            ↓ CSV
          </button>
          <button
            onClick={exportPDF}
            disabled={totalThreats === 0}
            title={totalThreats === 0 ? 'No threats to export' : 'Export to PDF'}
            style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: totalThreats > 0 ? 'var(--primary)' : 'rgba(255,255,255,0.1)', color: totalThreats > 0 ? '#000' : 'var(--on-surface-muted)', fontSize: '12px', fontWeight: 700, cursor: totalThreats > 0 ? 'pointer' : 'not-allowed', opacity: totalThreats > 0 ? 1 : 0.4 }}
          >
            ↓ PDF Report
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ marginBottom: '24px' }}>
        <StatsRow stats={stats} />
      </div>

      {/* ── Charts Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: '16px', marginBottom: '16px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--secondary)', letterSpacing: '1px', marginBottom: '16px' }}>STRIDE DISTRIBUTION</div>
          <StrideChart threats={allThreats} />
        </div>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--secondary)', letterSpacing: '1px', marginBottom: '16px' }}>SEVERITY BY STATUS</div>
          <SeverityChart threats={allThreats} />
        </div>
      </div>

      {/* ── Risk Heatmap ── */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--secondary)', letterSpacing: '1px', marginBottom: '14px' }}>
          RISK HEATMAP — STRIDE × SEVERITY
        </div>
        <RiskHeatmap threats={allThreats} />
      </div>

      {/* ── Threats + Activity Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '16px', marginBottom: '16px' }}>
        {/* Top threats */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--secondary)', letterSpacing: '1px', marginBottom: '14px' }}>
            TOP UNMITIGATED THREATS
          </div>
          {topThreats.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--on-surface-muted)', fontSize: '13px' }}>
              {totalThreats > 0 ? '✓ All threats are mitigated or marked N/A.' : 'No threats found.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {topThreats.map(t => {
                const sc = SEV_COLORS[t.severity] ?? '#999';
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${STRIDE_COLORS[t.stride_category] ?? '#666'}` }}>
                    <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '3px', background: `${sc}18`, color: sc, border: `1px solid ${sc}40`, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {t.severity.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '12px', color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    <span style={{ fontSize: '10px', color: 'var(--on-surface-muted)', flexShrink: 0 }}>{modelTitle(t.model_id)}</span>
                    <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '10px', background: t.status === 'Open' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: t.status === 'Open' ? '#ef4444' : '#f59e0b', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {t.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* System + Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '11px', color: 'var(--secondary)', letterSpacing: '1px', marginBottom: '12px' }}>SYSTEM</div>
            {[
              { label: 'Total Models', value: String(totalModels) },
              { label: 'Active Models', value: String(activeModels) },
              { label: 'Role', value: user?.role ?? '—' },
              { label: 'User', value: user?.email ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '12px' }}>
                <span style={{ color: 'var(--on-surface-muted)' }}>{label}</span>
                <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px', textAlign: 'right' }}>{value}</span>
              </div>
            ))}
          </div>
          <div className="glass-panel" style={{ padding: '16px 20px', flex: 1 }}>
            <div style={{ fontSize: '11px', color: 'var(--secondary)', letterSpacing: '1px', marginBottom: '12px' }}>RECENT ACTIVITY</div>
            <ActivityLog logs={auditData?.logs ?? []} />
          </div>
        </div>
      </div>

      {/* ── Recent Scans ── */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--secondary)', letterSpacing: '1px', marginBottom: '14px' }}>
          RECENT VULNERABILITY SCANS
        </div>
        {recentScans.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--on-surface-muted)', fontSize: '13px' }}>
            No vulnerability scans found. Run a scan in the Scanner module to view activity.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recentScans.map(scan => {
              const sc = scan.status === 'error' ? '#ef4444' : scan.status === 'complete' ? '#22c55e' : '#f59e0b';
              return (
                <div key={scan.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${sc}` }}>
                  <span style={{ fontSize: '12px', color: '#e2e8f0', flex: 1, fontWeight: 600 }}>{scan.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--on-surface-muted)', width: '90px' }}>{scan.scan_type.toUpperCase()}</span>
                  <span style={{ fontSize: '11px', color: '#06b6d4', width: '120px' }}>{scan.packages_scanned} packages</span>
                  <span style={{ fontSize: '11px', color: scan.vulns_found > 0 ? '#ef4444' : '#22c55e', width: '100px', fontWeight: scan.vulns_found > 0 ? 700 : 400 }}>
                    {scan.vulns_found} vulns
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--on-surface-muted)', flexShrink: 0 }}>
                    {new Date(scan.created_at).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Recent Models ── */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ fontSize: '11px', color: 'var(--secondary)', letterSpacing: '1px', marginBottom: '14px' }}>
          RECENT MODELS
        </div>
        <RecentModels models={models} />
      </div>
    </div>
  );
}