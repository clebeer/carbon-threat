import React from 'react';
import { Icon, ICONS, StatCard, Spinner } from '../../ui/primitives';
import { useDashboard } from '../../api/carbon';
import { SEVERITY_ORDER, Severity, severityLabel } from '../../domain/types';

const SEV_VAR: Record<Severity, string> = {
  critical: 'var(--sev-critical)', high: 'var(--sev-high)', medium: 'var(--sev-medium)', low: 'var(--sev-low)', info: 'var(--sev-info)',
};

function Donut({ bySeverity, total }: { bySeverity: Record<Severity, number>; total: number }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const present = SEVERITY_ORDER.filter((k) => bySeverity[k] > 0);
  const fracs = present.map((k) => bySeverity[k] / total);
  // Cumulative start offset per segment, computed functionally (no mutable accumulator).
  const segs = present.map((k, i) => {
    const startFrac = fracs.slice(0, i).reduce((a, b) => a + b, 0);
    return { color: SEV_VAR[k], dash: `${(fracs[i] * C).toFixed(2)} ${C.toFixed(2)}`, rot: -90 + startFrac * 360 };
  });
  return (
    <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
      <svg width="140" height="140" viewBox="0 0 120 120" role="img" aria-label="Findings by severity">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--hover)" strokeWidth="16" />
        {segs.map((s, i) => (
          <circle key={i} cx="60" cy="60" r={R} fill="none" stroke={s.color} strokeWidth="16"
            strokeDasharray={s.dash} transform={`rotate(${s.rot.toFixed(2)} 60 60)`} strokeLinecap="butt" />
        ))}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{total}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>findings</div>
      </div>
    </div>
  );
}

export default function DashboardView() {
  const { data, isLoading } = useDashboard();

  if (isLoading || !data) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>;
  }

  const { total, bySeverity, bySla, inTriage } = data;
  const critHigh = bySeverity.critical + bySeverity.high;
  const slaSegs = [
    { label: 'On track', value: bySla.on_track, color: 'var(--success)' },
    { label: 'At risk', value: bySla.at_risk, color: 'var(--warning)' },
    { label: 'Breached', value: bySla.breached, color: 'var(--danger)' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="cd-page-h1">Dashboard</h1>
          <p className="cd-page-sub">Executive overview · carbon-dojo</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="cd-select" style={{ width: 'auto' }} aria-label="Organization"><option>Acme Corp</option></select>
          <select className="cd-select" style={{ width: 'auto' }} aria-label="Business unit"><option>Plataforma</option></select>
          <select className="cd-select" style={{ width: 'auto' }} aria-label="Product"><option>carbon-dojo</option></select>
        </div>
      </div>

      {/* KPIs */}
      <div className="cd-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', marginBottom: 14 }}>
        <StatCard label="Total findings" value={total} sub="across carbon-dojo" icon={<Icon path={ICONS.report} size={15} />} />
        <StatCard label="Critical & High" value={critHigh} sub="need priority triage" icon={<Icon path={ICONS.alert} size={15} />} iconColor="var(--sev-high)" valueColor="var(--sev-high)" />
        <StatCard label="SLA breached" value={bySla.breached} sub="past remediation deadline" icon={<Icon path={ICONS.clock} size={15} />} iconColor="var(--danger)" valueColor="var(--danger)" />
        <StatCard label="In triage" value={inTriage} sub="awaiting disposition" icon={<Icon path={ICONS.check} size={15} />} iconColor="var(--success)" />
      </div>

      {/* Charts */}
      <div className="cd-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', marginBottom: 14 }}>
        <div className="cd-card cd-card-pad">
          <h3 className="cd-h3" style={{ marginBottom: 4 }}>Findings by severity</h3>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 16px' }}>Distribution across the open backlog</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <Donut bySeverity={bySeverity} total={total} />
            <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SEVERITY_ORDER.map((k) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: SEV_VAR[k] }} />
                  <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1 }}>{severityLabel(k)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{bySeverity[k]}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)', width: 40, textAlign: 'right' }}>{Math.round((bySeverity[k] / total) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="cd-card cd-card-pad">
          <h3 className="cd-h3" style={{ marginBottom: 4 }}>SLA status</h3>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 18px' }}>Remediation against severity-based SLA</p>
          <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 18 }}>
            {slaSegs.map((s) => <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {slaSegs.map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
                <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* By business unit */}
      <div className="cd-card cd-card-pad">
        <h3 className="cd-h3" style={{ marginBottom: 16 }}>Findings by business unit</h3>
        <div style={{ overflowX: 'auto' }} className="cd-scroll">
          <div style={{ minWidth: 560 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(6,1fr)', gap: 8, padding: '0 4px 10px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              <span>Business unit</span><span style={{ textAlign: 'right' }}>Total</span><span style={{ textAlign: 'right' }}>Crit</span><span style={{ textAlign: 'right' }}>High</span><span style={{ textAlign: 'right' }}>Med</span><span style={{ textAlign: 'right' }}>Low</span><span style={{ textAlign: 'right' }}>Breached</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(6,1fr)', gap: 8, padding: '14px 4px', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Plataforma</span>
              <span style={{ textAlign: 'right', fontWeight: 600 }}>{total}</span>
              <span style={{ textAlign: 'right', color: 'var(--text-2)' }}>{bySeverity.critical}</span>
              <span style={{ textAlign: 'right', color: 'var(--text-2)' }}>{bySeverity.high}</span>
              <span style={{ textAlign: 'right', color: 'var(--text-2)' }}>{bySeverity.medium}</span>
              <span style={{ textAlign: 'right', color: 'var(--text-2)' }}>{bySeverity.low}</span>
              <span style={{ textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>{bySla.breached}</span>
            </div>
            <div style={{ height: 6, borderRadius: 4, overflow: 'hidden', display: 'flex', background: 'var(--hover)', margin: '0 4px' }}>
              {SEVERITY_ORDER.filter((k) => k !== 'info').map((k) => (
                <div key={k} style={{ width: `${(bySeverity[k] / total) * 100}%`, background: SEV_VAR[k] }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
