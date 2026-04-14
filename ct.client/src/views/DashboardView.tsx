import React, { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import jsPDF from 'jspdf';
import { apiClient } from '../api/client';
import { listThreatModels, type ThreatModelSummary } from '../api/threatmodels';
import { listThreats, type Threat } from '../api/threats';
import { listScans, type ScanRun } from '../api/scanner';
import { useAuthStore } from '../store/authStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const STRIDE_CATEGORIES = [
  'Spoofing', 'Tampering', 'Repudiation',
  'Information Disclosure', 'DoS', 'Elevation of Privilege',
] as const;

const STRIDE_COLORS: Record<string, string> = {
  Spoofing:               '#3b82f6',
  Tampering:              '#f59e0b',
  Repudiation:            '#8b5cf6',
  'Information Disclosure': '#ef4444',
  DoS:                    '#f97316',
  'Elevation of Privilege': '#ec4899',
};

const SEV_ORDER  = ['Critical', 'High', 'Medium', 'Low'] as const;
const SEV_COLORS: Record<string, string> = {
  Critical: '#ef4444',
  High:     '#f97316',
  Medium:   '#f59e0b',
  Low:      '#00f2ff',
};

const STATUS_COLORS: Record<string, string> = {
  Open:           '#ef4444',
  Investigating:  '#f59e0b',
  Mitigated:      '#22c55e',
  'Not Applicable':'#64748b',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function heatmapColor(count: number, max: number): string {
  if (count === 0 || max === 0) return 'rgba(255,255,255,0.03)';
  const intensity = count / max;
  if (intensity > 0.75) return 'rgba(239,68,68,0.45)';
  if (intensity > 0.5)  return 'rgba(249,115,22,0.35)';
  if (intensity > 0.25) return 'rgba(245,158,11,0.28)';
  return 'rgba(0,242,255,0.15)';
}

function heatmapBorder(count: number, max: number): string {
  if (count === 0 || max === 0) return 'rgba(255,255,255,0.06)';
  const intensity = count / max;
  if (intensity > 0.75) return 'rgba(239,68,68,0.5)';
  if (intensity > 0.5)  return 'rgba(249,115,22,0.4)';
  if (intensity > 0.25) return 'rgba(245,158,11,0.35)';
  return 'rgba(0,242,255,0.25)';
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

interface StatCardProps { label: string; value: string | number; color: string; sub?: string }
function StatCard({ label, value, color, sub }: StatCardProps) {
  return (
    <div className="glass-panel" style={{ padding: '20px 22px' }}>
      <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', letterSpacing: '1px', marginBottom: '8px' }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: '32px', fontWeight: 700, color, fontFamily: 'var(--font-tech)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', marginTop: '6px' }}>{sub}</div>}
    </div>
  );
}

const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div style={{ background: 'var(--surface-container)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#e2e8f0' }}>
      <div style={{ color: STRIDE_COLORS[name] ?? '#fff', fontWeight: 600 }}>{name}</div>
      <div>{value} threat{value !== 1 ? 's' : ''}</div>
    </div>
  );
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface-container)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 12px', fontSize: '12px' }}>
      <div style={{ color: SEV_COLORS[label] ?? '#fff', fontWeight: 600, marginBottom: '4px' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: STATUS_COLORS[p.name] ?? '#e2e8f0' }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

interface HealthzResponse { status: string; uptime?: number }
interface AuditRow { id: number; action: string; entity_type: string; created_at: string }

export default function DashboardView() {
  const user      = useAuthStore((s: any) => s.user);
  const dashRef   = useRef<HTMLDivElement>(null);

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

  // Scanner Computed
  const totalScans = allScans.length;
  const totalVulnsFound = allScans.reduce((acc, scan) => acc + (scan.vulns_found || 0), 0);
  const totalPackagesScanned = allScans.reduce((acc, scan) => acc + (scan.packages_scanned || 0), 0);
  const recentScans = [...allScans].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  // STRIDE pie data
  const strideData = STRIDE_CATEGORIES
    .map(cat => ({ name: cat, value: allThreats.filter(t => t.stride_category === cat).length }))
    .filter(d => d.value > 0);

  // Severity × Status bar data
  const severityBarData = SEV_ORDER.map(sev => ({
    sev,
    Open:          allThreats.filter(t => t.severity === sev && t.status === 'Open').length,
    Investigating: allThreats.filter(t => t.severity === sev && t.status === 'Investigating').length,
    Mitigated:     allThreats.filter(t => t.severity === sev && t.status === 'Mitigated').length,
  })).filter(d => d.Open + d.Investigating + d.Mitigated > 0);

  // Risk heatmap: STRIDE (rows) × Severity (cols)
  const heatmapData = STRIDE_CATEGORIES.map(stride => ({
    stride,
    counts: SEV_ORDER.map(sev =>
      allThreats.filter(t => t.stride_category === stride && t.severity === sev).length
    ),
  }));
  const heatmapMax = Math.max(1, ...heatmapData.flatMap(row => row.counts));

  // Top unmitigated threats (Critical/High first)
  const topThreats = allThreats
    .filter(t => t.status === 'Open' || t.status === 'Investigating')
    .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity))
    .slice(0, 8);

  const modelTitle = (id: string) => models.find(m => m.id === id)?.title ?? id.slice(0, 8) + '…';

  const serverStatus = healthError ? 'Degraded' : health ? 'Operational' : 'Checking…';
  const statusColor  = healthError ? 'var(--error)' : health ? 'var(--primary)' : 'var(--on-surface-muted)';

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

    // Header
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

    // Summary section
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

    // STRIDE distribution
    doc.setTextColor(0, 242, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('STRIDE DISTRIBUTION', 15, y);
    y += 8;
    const strideAll = STRIDE_CATEGORIES.map(cat => ({
      cat,
      count: allThreats.filter(t => t.stride_category === cat).length,
    }));
    const maxStride = Math.max(1, ...strideAll.map(d => d.count));
    strideAll.forEach(({ cat, count }) => {
      if (count === 0) return;
      const barW = ((W - 90) * count) / maxStride;
      doc.setFillColor(30, 36, 54);
      doc.roundedRect(15, y - 4, W - 30, 7, 1, 1, 'F');
      const rgb = hexToRgb(STRIDE_COLORS[cat] ?? '#666');
      doc.setFillColor(...rgb);
      if (barW > 0) doc.roundedRect(75, y - 4, barW, 7, 1, 1, 'F');
      doc.setTextColor(160, 170, 190);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(cat, 17, y);
      doc.setTextColor(...rgb);
      doc.setFont('helvetica', 'bold');
      doc.text(String(count), W - 17, y, { align: 'right' });
      y += 9;
    });
    y += 6;

    // Top threats table
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setTextColor(0, 242, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('TOP UNMITIGATED THREATS', 15, y);
    y += 8;

    const tableThreats = allThreats
      .filter(t => t.status === 'Open' || t.status === 'Investigating')
      .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity))
      .slice(0, 12);

    if (tableThreats.length === 0) {
      doc.setTextColor(160, 170, 190);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('No open threats.', 15, y);
    } else {
      // Table header
      doc.setFillColor(18, 24, 40);
      doc.rect(15, y - 5, W - 30, 8, 'F');
      doc.setTextColor(0, 242, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('TITLE', 18, y);
      doc.text('SEV', 130, y);
      doc.text('CATEGORY', 148, y);
      doc.text('STATUS', 185, y);
      y += 6;

      tableThreats.forEach(t => {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.setFillColor(22, 28, 44);
        doc.rect(15, y - 4, W - 30, 7, 'F');
        doc.setTextColor(210, 220, 235);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const title = t.title.length > 50 ? t.title.slice(0, 47) + '…' : t.title;
        doc.text(title, 18, y);
        const sevRgb = hexToRgb(SEV_COLORS[t.severity] ?? '#999');
        doc.setTextColor(...sevRgb);
        doc.setFont('helvetica', 'bold');
        doc.text(t.severity, 130, y);
        doc.setTextColor(160, 170, 190);
        doc.setFont('helvetica', 'normal');
        const cat = t.stride_category.length > 16 ? t.stride_category.slice(0, 14) + '…' : t.stride_category;
        doc.text(cat, 148, y);
        doc.setTextColor(t.status === 'Open' ? 239 : 245, t.status === 'Open' ? 68 : 158, t.status === 'Open' ? 68 : 11);
        doc.text(t.status, 185, y);
        y += 8;
      });
    }

    // Footer
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
            onClick={exportCSV}
            disabled={totalThreats === 0}
            style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'var(--on-surface-muted)', fontSize: '12px', cursor: totalThreats > 0 ? 'pointer' : 'not-allowed', opacity: totalThreats > 0 ? 1 : 0.4 }}
          >
            ↓ CSV
          </button>
          <button
            onClick={exportPDF}
            disabled={totalThreats === 0}
            style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: totalThreats > 0 ? 'var(--primary)' : 'rgba(255,255,255,0.1)', color: totalThreats > 0 ? '#000' : 'var(--on-surface-muted)', fontSize: '12px', fontWeight: 700, cursor: totalThreats > 0 ? 'pointer' : 'not-allowed', opacity: totalThreats > 0 ? 1 : 0.4 }}
          >
            ↓ PDF Report
          </button>
        </div>
      </div>

      {/* ── Row 1: Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <StatCard label="Total Threats"  value={totalThreats} color="var(--primary)"   sub={`across ${activeModels} active model${activeModels !== 1 ? 's' : ''}`} />
        <StatCard label="Open Threats"   value={openThreats}  color="#ef4444"          sub="require attention" />
        <StatCard label="Mitigated"      value={mitigated}    color="#22c55e"          sub={`${mitigationPct}% mitigation rate`} />
        <StatCard label="Critical Risk"  value={critical}     color="#ec4899"          sub="highest severity" />
        
        <StatCard label="Total Scans"    value={totalScans}   color="#a855f7"          sub="OSV vulnerability scans" />
        <StatCard label="Total Vulns"    value={totalVulnsFound} color="#f97316"       sub="vulnerabilities found" />
        <StatCard label="Scanned Pkgs"   value={totalPackagesScanned} color="#06b6d4"  sub="dependencies checked" />
        <StatCard label="OWASP Refs"     value={owaspRefCount} color="#f59e0b"         sub="standards mapped" />
      </div>

      {/* ── Row 2: STRIDE + Severity charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '20px', marginBottom: '24px' }}>

        {/* STRIDE donut */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--secondary)', letterSpacing: '1px', marginBottom: '16px' }}>STRIDE DISTRIBUTION</div>
          {strideData.length === 0 ? (
            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-surface-muted)', fontSize: '13px' }}>
              No threat data
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={strideData} cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={3} dataKey="value">
                    {strideData.map(entry => (
                      <Cell key={entry.name} fill={STRIDE_COLORS[entry.name] ?? '#666'} stroke="transparent" />
                    ))}
                  </Pie>
                  <ReTooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                {strideData.map(d => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: STRIDE_COLORS[d.name] ?? '#666', flexShrink: 0 }} />
                      <span style={{ fontSize: '10px', color: 'var(--on-surface-muted)', lineHeight: 1.2 }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: STRIDE_COLORS[d.name] ?? '#fff' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Severity × Status bar chart */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--secondary)', letterSpacing: '1px', marginBottom: '16px' }}>SEVERITY BY STATUS</div>
          {severityBarData.length === 0 ? (
            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-surface-muted)', fontSize: '13px' }}>
              No threat data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={severityBarData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="sev" tick={{ fill: 'var(--on-surface-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--on-surface-muted)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <ReTooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Legend wrapperStyle={{ fontSize: '10px', color: 'var(--on-surface-muted)' }} />
                <Bar dataKey="Open"          fill={STATUS_COLORS.Open}          radius={[3, 3, 0, 0]} />
                <Bar dataKey="Investigating" fill={STATUS_COLORS.Investigating}  radius={[3, 3, 0, 0]} />
                <Bar dataKey="Mitigated"     fill={STATUS_COLORS.Mitigated}      radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row 3: Risk heatmap ── */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', color: 'var(--secondary)', letterSpacing: '1px', marginBottom: '14px' }}>
          RISK HEATMAP — STRIDE × SEVERITY
        </div>
        {totalThreats === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--on-surface-muted)', fontSize: '13px' }}>
            Run Rule-Based Analysis on a model to populate threat data.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: '4px', width: '100%', minWidth: '500px' }}>
              <thead>
                <tr>
                  <th style={{ width: '160px', textAlign: 'left', fontSize: '9px', color: 'var(--on-surface-muted)', letterSpacing: '0.5px', paddingBottom: '4px', fontWeight: 400 }}>STRIDE \ SEVERITY</th>
                  {SEV_ORDER.map(sev => (
                    <th key={sev} style={{ textAlign: 'center', fontSize: '10px', color: SEV_COLORS[sev], fontWeight: 700, paddingBottom: '4px', letterSpacing: '0.5px' }}>{sev}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.map(({ stride, counts }) => (
                  <tr key={stride}>
                    <td style={{ fontSize: '11px', color: STRIDE_COLORS[stride] ?? 'var(--on-surface-muted)', padding: '4px 8px 4px 0', whiteSpace: 'nowrap' }}>{stride}</td>
                    {counts.map((count, ci) => (
                      <td
                        key={ci}
                        title={`${stride} × ${SEV_ORDER[ci]}: ${count}`}
                        style={{
                          textAlign: 'center',
                          padding: '10px 16px',
                          borderRadius: '6px',
                          background: heatmapColor(count, heatmapMax),
                          border: `1px solid ${heatmapBorder(count, heatmapMax)}`,
                          fontSize: count > 0 ? '14px' : '11px',
                          fontWeight: count > 0 ? 700 : 400,
                          color: count > 0 ? '#fff' : 'rgba(255,255,255,0.18)',
                          transition: 'all 0.15s',
                          cursor: count > 0 ? 'default' : 'default',
                        }}
                      >
                        {count > 0 ? count : '·'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: '16px', marginTop: '10px', justifyContent: 'flex-end' }}>
              {[
                { label: 'High risk', color: 'rgba(239,68,68,0.45)', border: 'rgba(239,68,68,0.5)' },
                { label: 'Medium risk', color: 'rgba(249,115,22,0.35)', border: 'rgba(249,115,22,0.4)' },
                { label: 'Low risk', color: 'rgba(0,242,255,0.15)', border: 'rgba(0,242,255,0.25)' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--on-surface-muted)' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: l.color, border: `1px solid ${l.border}` }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Row 4: Top unmitigated + System info ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '20px', marginBottom: '24px' }}>

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

        {/* System + recent activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Quick stats */}
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

          {/* Recent activity */}
          <div className="glass-panel" style={{ padding: '16px 20px', flex: 1 }}>
            <div style={{ fontSize: '11px', color: 'var(--secondary)', letterSpacing: '1px', marginBottom: '12px' }}>RECENT ACTIVITY</div>
            {(auditData?.logs ?? []).length === 0 ? (
              <p style={{ color: 'var(--on-surface-muted)', fontSize: '12px', margin: 0 }}>No recent activity.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(auditData?.logs ?? []).slice(0, 5).map((log: AuditRow) => (
                  <div key={log.id} style={{ fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--on-surface-muted)', flexShrink: 0, fontSize: '10px', paddingTop: '1px' }}>
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ color: 'var(--primary)', flexShrink: 0 }}>{log.action}</span>
                    <span style={{ color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.entity_type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 5: Recent Scans ── */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
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
               const statusColor = scan.status === 'error' ? '#ef4444' : scan.status === 'complete' ? '#22c55e' : '#f59e0b';
               return (
                <div key={scan.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${statusColor}` }}>
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

    </div>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [isNaN(r) ? 128 : r, isNaN(g) ? 128 : g, isNaN(b) ? 128 : b];
}
