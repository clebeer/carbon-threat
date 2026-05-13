import React from 'react';
import { STRIDE_CATEGORIES, STRIDE_COLORS, SEV_COLORS, SEV_ORDER } from './ThreatChart';

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

interface RiskHeatmapProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  threats: any[];
}

export default function RiskHeatmap({ threats }: RiskHeatmapProps) {
  const totalThreats = threats.length;

  const heatmapData = STRIDE_CATEGORIES.map(stride => ({
    stride,
    counts: SEV_ORDER.map(sev =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      threats.filter((t: any) => t.stride_category === stride && t.severity === sev).length
    ),
  }));
  const heatmapMax = Math.max(1, ...heatmapData.flatMap(row => row.counts));

  if (totalThreats === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--on-surface-muted)', fontSize: '13px' }}>
        Run Rule-Based Analysis on a model to populate threat data.
      </div>
    );
  }

  return (
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
  );
}