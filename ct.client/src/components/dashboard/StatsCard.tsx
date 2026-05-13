import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  color: string;
  sub?: string;
}

export default function StatsCard({ label, value, color, sub }: StatCardProps) {
  return (
    <div className="glass-panel" style={{ padding: '20px 22px' }}>
      <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', letterSpacing: '1px', marginBottom: '8px' }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: '32px', fontWeight: 700, color, fontFamily: 'var(--font-tech)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', marginTop: '6px' }}>{sub}</div>}
    </div>
  );
}

interface StatsRowProps {
  stats: { label: string; value: string | number; color: string; sub?: string }[];
}

export function StatsRow({ stats }: StatsRowProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)`, gap: '16px' }}>
      {stats.map((s) => (
        <StatsCard key={s.label} {...s} />
      ))}
    </div>
  );
}