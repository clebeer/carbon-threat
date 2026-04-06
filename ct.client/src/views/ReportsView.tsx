import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import { listThreatModels, getThreatModel, type ThreatModelSummary } from '../api/threatmodels';
import { listThreats, type Threat } from '../api/threats';
import { apiClient } from '../api/client';
import ExportIssuesModal from '../components/ExportIssuesModal';

// ── PDF helpers ───────────────────────────────────────────────────────────────

const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low'] as const;

const SEV_RGB: Record<string, [number, number, number]> = {
  Critical: [239, 68, 68],
  High:     [249, 115, 22],
  Medium:   [245, 158, 11],
  Low:      [0, 242, 255],
};

const STATUS_RGB: Record<string, [number, number, number]> = {
  Open:            [239, 68, 68],
  Investigating:   [245, 158, 11],
  Mitigated:       [34, 197, 94],
  'Not Applicable':[100, 116, 139],
};

function generateModelPDF(model: ThreatModelSummary, threats: Threat[]) {
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W    = 210;
  const now  = new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
  let   y    = 20;

  // ── Cover header ────────────────────────────────────────────────────────────
  doc.setFillColor(10, 15, 28);
  doc.rect(0, 0, W, 44, 'F');
  doc.setTextColor(0, 242, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('CarbonThreat', 15, 17);
  doc.setFontSize(13);
  doc.setTextColor(220, 230, 245);
  doc.text(model.title, 15, 28);
  doc.setFontSize(9);
  doc.setTextColor(120, 130, 150);
  doc.text(`v${model.version}  ·  Generated: ${now}`, 15, 38);
  y = 54;

  // ── Summary stats ───────────────────────────────────────────────────────────
  const total      = threats.length;
  const open       = threats.filter(t => t.status === 'Open').length;
  const mitigated  = threats.filter(t => t.status === 'Mitigated').length;
  const critical   = threats.filter(t => t.severity === 'Critical').length;
  const owaspCount = threats.reduce((n, t) => n + (t.owasp_refs?.length ?? 0), 0);
  const mitigPct   = total > 0 ? Math.round((mitigated / total) * 100) : 0;

  doc.setTextColor(0, 242, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('SUMMARY', 15, y);
  y += 7;

  const summaryItems: [string, string][] = [
    ['Total Threats',     String(total)],
    ['Open',             String(open)],
    ['Mitigated',        `${mitigated} (${mitigPct}%)`],
    ['Critical',         String(critical)],
    ['OWASP References', String(owaspCount)],
  ];
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
    doc.setFontSize(9);
    doc.text(label, x + 3, yy);
    doc.setTextColor(220, 230, 245);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x + colW - 3, yy, { align: 'right' });
  });
  y += Math.ceil(summaryItems.length / 2) * 10 + 10;

  // ── Description ─────────────────────────────────────────────────────────────
  if (model.description) {
    doc.setTextColor(0, 242, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPTION', 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(180, 190, 210);
    const lines = doc.splitTextToSize(model.description, W - 30) as string[];
    lines.forEach((line: string) => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(line, 15, y);
      y += 5;
    });
    y += 6;
  }

  // ── Severity breakdown ───────────────────────────────────────────────────────
  if (total > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setTextColor(0, 242, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('SEVERITY BREAKDOWN', 15, y);
    y += 7;

    const sevCounts = SEV_ORDER.map(s => ({
      sev: s,
      count: threats.filter(t => t.severity === s).length,
    }));
    const maxCount = Math.max(1, ...sevCounts.map(d => d.count));
    sevCounts.forEach(({ sev, count }) => {
      if (count === 0) return;
      const barW = ((W - 90) * count) / maxCount;
      doc.setFillColor(30, 36, 54);
      doc.roundedRect(15, y - 4, W - 30, 7, 1, 1, 'F');
      doc.setFillColor(...SEV_RGB[sev]);
      if (barW > 0) doc.roundedRect(75, y - 4, barW, 7, 1, 1, 'F');
      doc.setTextColor(160, 170, 190);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(sev, 17, y);
      doc.setTextColor(...SEV_RGB[sev]);
      doc.setFont('helvetica', 'bold');
      doc.text(String(count), W - 17, y, { align: 'right' });
      y += 9;
    });
    y += 6;
  }

  // ── Threat table ─────────────────────────────────────────────────────────────
  if (threats.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setTextColor(0, 242, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('THREAT LIST', 15, y);
    y += 7;

    // Table header
    doc.setFillColor(20, 26, 42);
    doc.rect(15, y - 4, W - 30, 8, 'F');
    doc.setTextColor(120, 130, 150);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('THREAT', 17, y);
    doc.text('STRIDE', 100, y);
    doc.text('SEVERITY', 130, y);
    doc.text('STATUS', 162, y);
    y += 8;

    const sorted = [...threats].sort(
      (a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity)
    );

    sorted.forEach((t, idx) => {
      if (y > 275) { doc.addPage(); y = 20; }
      const bg = idx % 2 === 0 ? [16, 20, 34] : [20, 26, 44];
      doc.setFillColor(...(bg as [number, number, number]));
      doc.rect(15, y - 4, W - 30, 9, 'F');

      // Title (truncated)
      const titleText = doc.splitTextToSize(t.title, 78)[0] as string;
      doc.setTextColor(210, 220, 235);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(titleText, 17, y);

      // STRIDE
      doc.setTextColor(160, 170, 190);
      doc.text(t.stride_category.slice(0, 14), 100, y);

      // Severity badge
      doc.setTextColor(...(SEV_RGB[t.severity] ?? [160, 170, 190]));
      doc.setFont('helvetica', 'bold');
      doc.text(t.severity, 130, y);

      // Status badge
      doc.setTextColor(...(STATUS_RGB[t.status] ?? [160, 170, 190]));
      doc.text(t.status, 162, y);

      // Mitigation (if any), indented on next row
      if (t.mitigation) {
        y += 6;
        if (y > 275) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(100, 110, 130);
        const mitLines = doc.splitTextToSize(`  → ${t.mitigation}`, W - 36) as string[];
        doc.text(mitLines[0], 19, y);
      }

      y += 7;
    });
  }

  // ── Page footers ─────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(80, 90, 110);
    doc.text(`CarbonThreat — ${model.title}`, 15, 291);
    doc.text(`Page ${p} of ${totalPages}`, W - 15, 291, { align: 'right' });
  }

  const slug = model.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  doc.save(`carbonthreat-${slug}-v${model.version}.pdf`);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReportsView() {
  const [exportModal, setExportModal]     = useState<{ title: string; description: string } | null>(null);
  const [downloading, setDownloading]     = useState<string | null>(null);   // model id being PDF-downloaded
  const [sarifing, setSarifing]           = useState<string | null>(null);   // model id being SARIF-downloaded
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { data: models, isLoading, isError } = useQuery<ThreatModelSummary[]>({
    queryKey: ['threatmodels'],
    queryFn: listThreatModels,
  });

  const activeModels = models?.filter((m: ThreatModelSummary) => !m.is_archived) ?? [];

  async function handleSarif(model: ThreatModelSummary) {
    setSarifing(model.id);
    setDownloadError(null);
    try {
      const { data } = await apiClient.get(`/threatmodels/${model.id}/sarif`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const slug = model.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      a.download = `carbonthreat-${slug}.sarif.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setDownloadError(`SARIF export failed for "${model.title}": ${err?.message ?? 'unknown error'}`);
    } finally {
      setSarifing(null);
    }
  }

  async function handleDownload(model: ThreatModelSummary) {
    setDownloading(model.id);
    setDownloadError(null);
    try {
      const threats = await listThreats({ modelId: model.id });
      generateModelPDF(model, threats);
    } catch (err: any) {
      setDownloadError(`Failed to generate report for "${model.title}": ${err?.message ?? 'unknown error'}`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div style={{ padding: '32px', paddingTop: '96px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '28px', marginBottom: '8px', color: '#fff' }}>Reports</h1>
          <p className="label-text" style={{ color: 'var(--on-surface-muted)', margin: 0 }}>
            Download threat modeling documentation and export findings to issue trackers.
          </p>
        </div>
        <button
          onClick={() => setExportModal({ title: '', description: '' })}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 18px', borderRadius: '8px', cursor: 'pointer',
            border: '1px solid rgba(179,102,255,0.4)',
            background: 'rgba(179,102,255,0.1)', color: 'var(--secondary)',
            fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', whiteSpace: 'nowrap',
          }}
        >
          <span>⬡</span> Export Issues
        </button>
      </div>

      {downloadError && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,77,79,0.08)', border: '1px solid var(--error)', borderRadius: '8px', color: 'var(--error)', fontSize: '13px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{downloadError}</span>
          <button onClick={() => setDownloadError(null)} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>×</button>
        </div>
      )}

      {isLoading && (
        <p style={{ color: 'var(--on-surface-muted)', fontSize: '13px' }}>Loading models…</p>
      )}

      {isError && (
        <div style={{ padding: '16px', background: 'rgba(255,77,79,0.08)', border: '1px solid var(--error)', borderRadius: '8px', color: 'var(--error)', fontSize: '13px', marginBottom: '24px' }}>
          Failed to load threat models.
        </div>
      )}

      {!isLoading && activeModels.length === 0 && !isError && (
        <div style={{ padding: '48px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
          <p style={{ color: 'var(--on-surface-muted)', fontSize: '14px', margin: 0 }}>
            No active threat models. Create a model in the Projects section to generate reports.
          </p>
        </div>
      )}

      {activeModels.length > 0 && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ color: 'var(--on-surface-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {(['MODEL', 'LAST UPDATED', 'VERSION', 'ACTIONS'] as const).map(h => (
                  <th key={h} style={{ padding: '14px 8px', fontFamily: 'var(--font-label)', fontSize: '11px', letterSpacing: '1px', textAlign: h === 'ACTIONS' ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeModels.map((m: ThreatModelSummary) => {
                const isThisDownloading = downloading === m.id;
                const isThisSarifing    = sarifing === m.id;
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '14px 8px', color: '#fff', fontWeight: 500 }}>{m.title}</td>
                    <td className="tech-text" style={{ padding: '14px 8px', color: 'var(--on-surface-muted)', fontSize: '13px' }}>
                      {new Date(m.updated_at).toLocaleDateString()}
                    </td>
                    <td className="tech-text" style={{ padding: '14px 8px', color: 'var(--primary)' }}>v{m.version}</td>
                    <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleDownload(m)}
                          disabled={isThisDownloading}
                          style={{
                            background: 'transparent',
                            border: `1px solid ${isThisDownloading ? 'rgba(255,255,255,0.08)' : 'rgba(0,242,255,0.3)'}`,
                            color: isThisDownloading ? 'var(--on-surface-muted)' : 'var(--primary)',
                            padding: '6px 12px', borderRadius: '4px',
                            cursor: isThisDownloading ? 'not-allowed' : 'pointer',
                            fontFamily: 'var(--font-label)', fontSize: '12px',
                          }}
                        >
                          {isThisDownloading ? '↻ Building…' : '↓ PDF'}
                        </button>
                        <button
                          onClick={() => handleSarif(m)}
                          disabled={isThisSarifing}
                          title="Download SARIF for GitHub Advanced Security / GitLab SAST"
                          style={{
                            background: 'transparent',
                            border: `1px solid ${isThisSarifing ? 'rgba(255,255,255,0.08)' : 'rgba(245,158,11,0.4)'}`,
                            color: isThisSarifing ? 'var(--on-surface-muted)' : '#f59e0b',
                            padding: '6px 12px', borderRadius: '4px',
                            cursor: isThisSarifing ? 'not-allowed' : 'pointer',
                            fontFamily: 'var(--font-label)', fontSize: '12px',
                          }}
                        >
                          {isThisSarifing ? '↻ …' : '↓ SARIF'}
                        </button>
                        <button
                          onClick={() => setExportModal({
                            title:       `[THREAT] ${m.title}`,
                            description: `Exporting findings from model: "${m.title}" (v${m.version}, updated ${new Date(m.updated_at).toLocaleDateString()}).`,
                          })}
                          style={{ background: 'transparent', border: '1px solid rgba(179,102,255,0.3)', color: 'var(--secondary)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-label)', fontSize: '12px' }}
                        >
                          Export Issues
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {exportModal !== null && (
        <ExportIssuesModal
          defaultTitle={exportModal.title}
          defaultDescription={exportModal.description}
          onClose={() => setExportModal(null)}
        />
      )}
    </div>
  );
}
