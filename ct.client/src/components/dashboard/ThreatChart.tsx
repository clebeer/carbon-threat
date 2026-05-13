import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';

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

const STATUS_COLORS: Record<string, string> = {
  Open:           '#ef4444',
  Investigating:  '#f59e0b',
  Mitigated:      '#22c55e',
  'Not Applicable':'#64748b',
};

const SEV_COLORS: Record<string, string> = {
  Critical: '#ef4444',
  High:     '#f97316',
  Medium:   '#f59e0b',
  Low:      '#00f2ff',
};

const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface-container)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 12px', fontSize: '12px' }}>
      <div style={{ color: SEV_COLORS[label] ?? '#fff', fontWeight: 600, marginBottom: '4px' }}>{label}</div>
      {payload.map((p: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
        <div key={p.name} style={{ color: STATUS_COLORS[p.name] ?? '#e2e8f0' }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
};

interface ThreatChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  threats: any[];
}

export function StrideChart({ threats }: ThreatChartProps) {
  const strideData = STRIDE_CATEGORIES
    .map(cat => ({ name: cat, value: threats.filter((t: any) => t.stride_category === cat).length })) // eslint-disable-line @typescript-eslint/no-explicit-any
    .filter(d => d.value > 0);

  if (strideData.length === 0) {
    return (
      <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-surface-muted)', fontSize: '13px' }}>
        No threat data
      </div>
    );
  }

  return (
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
  );
}

export function SeverityChart({ threats }: ThreatChartProps) {
  const severityBarData = SEV_ORDER.map(sev => ({
    sev,
    Open:          threats.filter((t: any) => t.severity === sev && t.status === 'Open').length, // eslint-disable-line @typescript-eslint/no-explicit-any
    Investigating: threats.filter((t: any) => t.severity === sev && t.status === 'Investigating').length, // eslint-disable-line @typescript-eslint/no-explicit-any
    Mitigated:     threats.filter((t: any) => t.severity === sev && t.status === 'Mitigated').length, // eslint-disable-line @typescript-eslint/no-explicit-any
  })).filter(d => d.Open + d.Investigating + d.Mitigated > 0);

  if (severityBarData.length === 0) {
    return (
      <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-surface-muted)', fontSize: '13px' }}>
        No threat data
      </div>
    );
  }

  return (
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
  );
}

export { STRIDE_COLORS, SEV_COLORS, SEV_ORDER, STATUS_COLORS, STRIDE_CATEGORIES };