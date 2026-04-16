import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import { listThreatModels, getThreatModel, type ThreatModelSummary } from '../api/threatmodels';
import { listThreats, type Threat } from '../api/threats';
import { apiClient } from '../api/client';
import ExportIssuesModal from '../components/ExportIssuesModal';

// ── PDF helpers ───────────────────────────────────────────────────────────────

const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low'] as const;

const STRIDE_ORDER = [
  'Spoofing', 'Tampering', 'Repudiation',
  'Information Disclosure', 'Denial of Service', 'Elevation of Privilege',
] as const;

const SEV_RGB: Record<string, [number, number, number]> = {
  Critical: [239, 68, 68],
  High:     [249, 115, 22],
  Medium:   [245, 158, 11],
  Low:      [56, 189, 248],
};

const STATUS_RGB: Record<string, [number, number, number]> = {
  Open:             [239, 68, 68],
  Investigating:    [245, 158, 11],
  Mitigated:        [34, 197, 94],
  'Not Applicable': [100, 116, 139],
};

const STRIDE_RGB: Record<string, [number, number, number]> = {
  'Spoofing':               [168, 85, 247],
  'Tampering':              [239, 68, 68],
  'Repudiation':            [249, 115, 22],
  'Information Disclosure': [56, 189, 248],
  'Denial of Service':      [245, 158, 11],
  'Elevation of Privilege': [34, 197, 94],
};

// Page dimensions & layout constants
const W         = 210;
const MARGIN    = 15;
const CONTENT_W = W - MARGIN * 2;
const FOOTER_Y  = 291;
const PAGE_BOT  = 278;

function addFooter(doc: InstanceType<typeof jsPDF>, title: string) {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    // Footer rule
    doc.setDrawColor(30, 36, 54);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, FOOTER_Y - 4, W - MARGIN, FOOTER_Y - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(70, 80, 100);
    doc.text(`CarbonThreat  ·  ${title}`, MARGIN, FOOTER_Y);
    doc.text(`${p} / ${total}`, W - MARGIN, FOOTER_Y, { align: 'right' });
  }
}

function sectionHeader(doc: InstanceType<typeof jsPDF>, label: string, y: number): number {
  doc.setFillColor(18, 24, 40);
  doc.rect(MARGIN, y - 5, CONTENT_W, 10, 'F');
  // Accent bar
  doc.setFillColor(0, 200, 220);
  doc.rect(MARGIN, y - 5, 3, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 220, 240);
  doc.text(label, MARGIN + 6, y + 1);
  return y + 14;
}

function badge(
  doc: InstanceType<typeof jsPDF>,
  text: string,
  x: number,
  y: number,
  rgb: [number, number, number],
) {
  const pad = 3;
  doc.setFontSize(7.5);
  const tw = doc.getTextWidth(text);
  doc.setFillColor(rgb[0], rgb[1], rgb[2], 0.15 as any);
  // Approximate background with low-opacity fill via a light tint
  doc.setFillColor(
    Math.min(255, Math.round(rgb[0] * 0.2 + 12)),
    Math.min(255, Math.round(rgb[1] * 0.2 + 18)),
    Math.min(255, Math.round(rgb[2] * 0.2 + 30)),
  );
  doc.roundedRect(x, y - 4, tw + pad * 2, 6, 1, 1, 'F');
  doc.setTextColor(...rgb);
  doc.setFont('helvetica', 'bold');
  doc.text(text, x + pad, y);
  return tw + pad * 2 + 4; // consumed width + gap
}

function generateModelPDF(model: ThreatModelSummary, threats: Threat[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const now = new Date().toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGE 1 — COVER
  // ─────────────────────────────────────────────────────────────────────────────

  // Background
  doc.setFillColor(8, 12, 24);
  doc.rect(0, 0, W, 297, 'F');

  // Top accent strip
  doc.setFillColor(0, 180, 200);
  doc.rect(0, 0, W, 2, 'F');

  // Left sidebar
  doc.setFillColor(12, 18, 34);
  doc.rect(0, 2, 6, 295, 'F');

  // Product wordmark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(0, 220, 240);
  doc.text('Carbon', 22, 45);
  doc.setTextColor(255, 255, 255);
  doc.text('Threat', 22 + doc.getTextWidth('Carbon') + 2, 45);

  // Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 100, 130);
  doc.text('Enterprise Threat Modeling Platform', 22, 53);

  // Divider
  doc.setDrawColor(0, 180, 200);
  doc.setLineWidth(0.5);
  doc.line(22, 58, W - 22, 58);

  // Report type label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 180, 200);
  doc.text('THREAT MODEL REPORT', 22, 70);

  // Model title
  const titleLines = doc.splitTextToSize(model.title, W - 44) as string[];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(220, 230, 250);
  let ty = 82;
  titleLines.slice(0, 3).forEach((line: string) => {
    doc.text(line, 22, ty);
    ty += 10;
  });

  // Meta info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 100, 130);
  doc.text(`Version  v${model.version}`, 22, ty + 6);
  doc.text(`Generated  ${now}`, 22, ty + 13);
  doc.text(
    `Last updated  ${new Date(model.updated_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    22,
    ty + 20,
  );

  // ── Cover summary stats grid ──────────────────────────────────────────────
  const total     = threats.length;
  const open      = threats.filter(t => t.status === 'Open').length;
  const mitigated = threats.filter(t => t.status === 'Mitigated').length;
  const critical  = threats.filter(t => t.severity === 'Critical').length;
  const high      = threats.filter(t => t.severity === 'High').length;
  const mitigPct  = total > 0 ? Math.round((mitigated / total) * 100) : 0;

  const stats: { label: string; value: string; rgb: [number, number, number] }[] = [
    { label: 'Total Threats',    value: String(total),             rgb: [0, 220, 240] },
    { label: 'Open',             value: String(open),              rgb: [239, 68, 68] },
    { label: 'Critical',         value: String(critical),          rgb: [239, 68, 68] },
    { label: 'High',             value: String(high),              rgb: [249, 115, 22] },
    { label: 'Mitigated',        value: `${mitigated} (${mitigPct}%)`, rgb: [34, 197, 94] },
  ];

  const cardW = (CONTENT_W - 8) / 3;
  const cardH = 22;
  const startX = 22;
  let statsY = ty + 38;

  stats.forEach((s, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx  = startX + col * (cardW + 4);
    const cy  = statsY + row * (cardH + 4);

    doc.setFillColor(14, 20, 38);
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, 'F');
    // Top accent
    doc.setFillColor(...s.rgb);
    doc.roundedRect(cx, cy, cardW, 2, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...s.rgb);
    doc.text(s.value, cx + cardW / 2, cy + 14, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 120, 150);
    doc.text(s.label.toUpperCase(), cx + cardW / 2, cy + 20, { align: 'center' });
  });

  // Cover page footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(40, 50, 70);
  doc.text('CONFIDENTIAL  ·  CarbonThreat', 22, 287);
  doc.text(now, W - 22, 287, { align: 'right' });

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGE 2 — EXECUTIVE SUMMARY
  // ─────────────────────────────────────────────────────────────────────────────
  doc.addPage();
  doc.setFillColor(8, 12, 24);
  doc.rect(0, 0, W, 297, 'F');

  let y = 22;

  // Page heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 220, 240);
  doc.text('Executive Summary', MARGIN, y);
  y += 14;

  // ── Description ─────────────────────────────────────────────────────────────
  if (model.description) {
    y = sectionHeader(doc, 'DESCRIPTION', y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(170, 185, 210);
    const descLines = doc.splitTextToSize(model.description, CONTENT_W) as string[];
    descLines.forEach((line: string) => {
      if (y > PAGE_BOT) { doc.addPage(); doc.setFillColor(8, 12, 24); doc.rect(0, 0, W, 297, 'F'); y = 22; }
      doc.text(line, MARGIN, y);
      y += 5;
    });
    y += 8;
  }

  // ── Severity distribution ─────────────────────────────────────────────────
  if (total > 0) {
    if (y > PAGE_BOT - 50) { doc.addPage(); doc.setFillColor(8, 12, 24); doc.rect(0, 0, W, 297, 'F'); y = 22; }
    y = sectionHeader(doc, 'SEVERITY DISTRIBUTION', y);

    const sevCounts = SEV_ORDER.map(s => ({ sev: s, count: threats.filter(t => t.severity === s).length }));
    const maxCount  = Math.max(1, ...sevCounts.map(d => d.count));
    const barAreaW  = CONTENT_W - 50;

    sevCounts.forEach(({ sev, count }) => {
      if (count === 0) return;
      if (y > PAGE_BOT) { doc.addPage(); doc.setFillColor(8, 12, 24); doc.rect(0, 0, W, 297, 'F'); y = 22; }

      const barW = (barAreaW * count) / maxCount;
      const pct  = Math.round((count / total) * 100);

      // Row background
      doc.setFillColor(14, 20, 38);
      doc.roundedRect(MARGIN, y - 5, CONTENT_W, 9, 1, 1, 'F');

      // Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...SEV_RGB[sev]);
      doc.text(sev, MARGIN + 3, y);

      // Bar track
      doc.setFillColor(22, 28, 46);
      doc.roundedRect(MARGIN + 32, y - 3.5, barAreaW, 6, 1, 1, 'F');

      // Bar fill
      if (barW > 0) {
        doc.setFillColor(...SEV_RGB[sev]);
        doc.roundedRect(MARGIN + 32, y - 3.5, barW, 6, 1, 1, 'F');
      }

      // Count + pct
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(180, 195, 215);
      doc.text(`${count}  (${pct}%)`, W - MARGIN - 2, y, { align: 'right' });

      y += 11;
    });
    y += 6;
  }

  // ── STRIDE distribution ───────────────────────────────────────────────────
  if (total > 0) {
    if (y > PAGE_BOT - 70) { doc.addPage(); doc.setFillColor(8, 12, 24); doc.rect(0, 0, W, 297, 'F'); y = 22; }
    y = sectionHeader(doc, 'STRIDE DISTRIBUTION', y);

    const strideCounts = STRIDE_ORDER.map(s => ({
      stride: s,
      count: threats.filter(t => t.stride_category === s).length,
    }));
    const maxStride  = Math.max(1, ...strideCounts.map(d => d.count));
    const sBarAreaW  = CONTENT_W - 70;

    strideCounts.forEach(({ stride, count }) => {
      if (count === 0) return;
      if (y > PAGE_BOT) { doc.addPage(); doc.setFillColor(8, 12, 24); doc.rect(0, 0, W, 297, 'F'); y = 22; }

      const barW = (sBarAreaW * count) / maxStride;
      const pct  = Math.round((count / total) * 100);
      const rgb  = STRIDE_RGB[stride] ?? [100, 120, 150];

      doc.setFillColor(14, 20, 38);
      doc.roundedRect(MARGIN, y - 5, CONTENT_W, 9, 1, 1, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(160, 175, 200);
      doc.text(stride.length > 20 ? stride.slice(0, 20) + '…' : stride, MARGIN + 3, y);

      doc.setFillColor(22, 28, 46);
      doc.roundedRect(MARGIN + 52, y - 3.5, sBarAreaW, 6, 1, 1, 'F');

      if (barW > 0) {
        doc.setFillColor(...rgb);
        doc.roundedRect(MARGIN + 52, y - 3.5, barW, 6, 1, 1, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...rgb);
      doc.text(`${count}  (${pct}%)`, W - MARGIN - 2, y, { align: 'right' });

      y += 11;
    });
    y += 6;
  }

  // ── Status summary ────────────────────────────────────────────────────────
  if (total > 0) {
    if (y > PAGE_BOT - 40) { doc.addPage(); doc.setFillColor(8, 12, 24); doc.rect(0, 0, W, 297, 'F'); y = 22; }
    y = sectionHeader(doc, 'STATUS OVERVIEW', y);

    const statuses = ['Open', 'Investigating', 'Mitigated', 'Not Applicable'] as const;
    const statusCounts = statuses.map(s => ({
      status: s,
      count:  threats.filter(t => t.status === s).length,
    }));
    const cardWidth = (CONTENT_W - 6) / 4;

    statusCounts.forEach(({ status, count }, i) => {
      const cx = MARGIN + i * (cardWidth + 2);
      doc.setFillColor(14, 20, 38);
      doc.roundedRect(cx, y, cardWidth, 18, 2, 2, 'F');
      const rgb = STATUS_RGB[status] ?? [100, 116, 139];
      doc.setFillColor(...rgb);
      doc.roundedRect(cx, y + 16, cardWidth, 2, 1, 1, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...rgb);
      doc.text(String(count), cx + cardWidth / 2, y + 10, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 120, 150);
      doc.text(status.toUpperCase(), cx + cardWidth / 2, y + 15, { align: 'center' });
    });
    y += 28;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGES 3+ — THREAT DETAIL CARDS
  // ─────────────────────────────────────────────────────────────────────────────
  if (threats.length > 0) {
    doc.addPage();
    doc.setFillColor(8, 12, 24);
    doc.rect(0, 0, W, 297, 'F');
    y = 22;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 220, 240);
    doc.text('Threat Catalog', MARGIN, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 100, 130);
    doc.text(`${threats.length} threat${threats.length === 1 ? '' : 's'} · sorted by severity`, MARGIN, y);
    y += 12;

    const sorted = [...threats].sort(
      (a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity),
    );

    sorted.forEach((t) => {
      // Estimate card height
      const titleLines    = doc.splitTextToSize(t.title, CONTENT_W - 10) as string[];
      const descLines     = t.description
        ? (doc.splitTextToSize(t.description, CONTENT_W - 10) as string[])
        : [];
      const mitLines      = t.mitigation
        ? (doc.splitTextToSize(t.mitigation, CONTENT_W - 14) as string[])
        : [];
      const owaspLines    = t.owasp_refs?.length
        ? t.owasp_refs.map(r => `  • [${r.ref}] ${r.title}`)
        : [];

      const titleH  = titleLines.length * 5.5;
      const descH   = descLines.length > 0 ? descLines.length * 4.8 + 8 : 0;
      const mitH    = mitLines.length > 0 ? mitLines.length * 4.8 + 8 : 0;
      const owaspH  = owaspLines.length > 0 ? owaspLines.length * 4.8 + 8 : 0;
      const cardH   = 8 + titleH + 10 + descH + mitH + owaspH + 4;

      if (y + cardH > PAGE_BOT) {
        doc.addPage();
        doc.setFillColor(8, 12, 24);
        doc.rect(0, 0, W, 297, 'F');
        y = 22;
      }

      const sevRgb  = SEV_RGB[t.severity]  ?? [160, 170, 190];
      const statRgb = STATUS_RGB[t.status] ?? [160, 170, 190];

      // Card background
      doc.setFillColor(13, 18, 32);
      doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 2, 2, 'F');

      // Left severity stripe
      doc.setFillColor(...sevRgb);
      doc.roundedRect(MARGIN, y, 3, cardH, 1, 1, 'F');

      let cy = y + 7;

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(220, 232, 252);
      titleLines.forEach((line: string) => {
        doc.text(line, MARGIN + 7, cy);
        cy += 5.5;
      });

      // Badge row
      cy += 2;
      let bx = MARGIN + 7;

      // Severity badge
      bx += badge(doc, t.severity.toUpperCase(), bx, cy, sevRgb);

      // Status badge
      bx += badge(doc, t.status.toUpperCase(), bx, cy, statRgb);

      // STRIDE badge
      const strideRgb = STRIDE_RGB[t.stride_category] ?? [100, 120, 150];
      badge(doc, t.stride_category.toUpperCase(), bx, cy, strideRgb);

      cy += 10;

      // Description
      if (descLines.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(0, 180, 200);
        doc.text('DESCRIPTION', MARGIN + 7, cy);
        cy += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 165, 195);
        descLines.forEach((line: string) => {
          doc.text(line, MARGIN + 7, cy);
          cy += 4.8;
        });
        cy += 3;
      }

      // Mitigation
      if (mitLines.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(34, 197, 94);
        doc.text('MITIGATION', MARGIN + 7, cy);
        cy += 5;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(120, 160, 130);
        mitLines.forEach((line: string) => {
          doc.text(line, MARGIN + 10, cy);
          cy += 4.8;
        });
        cy += 3;
      }

      // OWASP references
      if (owaspLines.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(56, 189, 248);
        doc.text('OWASP REFERENCES', MARGIN + 7, cy);
        cy += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 150, 180);
        owaspLines.forEach((line: string) => {
          doc.text(line, MARGIN + 7, cy);
          cy += 4.8;
        });
      }

      y += cardH + 5;
    });
  }

  // ── Add footers to all pages ──────────────────────────────────────────────
  addFooter(doc, model.title);

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
