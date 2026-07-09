import React, { useState } from 'react';
import { Finding, FindingStatus, SlaState, Severity, sevClass, slaClass, severityLabel, slaLabel } from '../domain/types';

/* ── Icon (single-path SVG, stroke currentColor) ───────────────────────────── */
export function Icon({ path, size = 17, strokeWidth = 1.9 }: { path: string; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path.split('|').map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

export const ICONS = {
  dashboard: 'M3 3h7v7H3z|M14 3h7v7h-7z|M14 14h7v7h-7z|M3 14h7v7H3z',
  findings: 'M12 2 4 5v6c0 5 3.4 8.2 8 9.5 4.6-1.3 8-4.5 8-9.5V5z|M12 8v4|M12 16h.01',
  engagements: 'M12 2v4m0 12v4m10-10h-4M6 12H2|M17.07 6.93l-2.83 2.83M9.76 14.24l-2.83 2.83m0-10.14 2.83 2.83m4.48 4.48 2.83 2.83',
  products: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z|M3.27 6.96 12 12l8.73-5.04M12 22V12',
  import: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 9l5-5 5 5|M12 4v12',
  report: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M8 13h8M8 17h8',
  connectors: 'M9 2v6m6-6v6M5 8h14v3a7 7 0 0 1-7 7 7 7 0 0 1-7-7z|M12 18v4',
  admin: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  shield: 'M12 2 4 5v6c0 5 3.4 8.2 8 9.5 4.6-1.3 8-4.5 8-9.5V5z|M9 12l2 2 4-4',
  back: 'm15 18-6-6 6-6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z|m20 20-3-3',
  menu: 'M3 6h18M3 12h18M3 18h18',
  sun: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.36 6.36-.7-.7M6.34 6.34l-.7-.7m12.72 0-.7.7M6.34 17.66l-.7.7|M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  check: 'M20 6 9 17l-5-5',
  jira: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6',
  alert: 'M12 2 1 21h22L12 2z|M12 9v5|M12 18h.01',
  clock: 'M12 8v4l3 2|M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
} as const;

/* ── Button ────────────────────────────────────────────────────────────────── */
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  sm?: boolean;
  block?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}
export function Button({ variant = 'primary', sm, block, loading, icon, className = '', children, disabled, ...rest }: ButtonProps) {
  const cls = ['cd-btn', `cd-btn--${variant}`, sm && 'cd-btn--sm', block && 'cd-btn--block', className]
    .filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="cd-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} aria-hidden="true" />}
      {!loading && icon}
      {children}
    </button>
  );
}

/* ── Card / PageHeader ─────────────────────────────────────────────────────── */
export function Card({ pad = true, className = '', children, ...rest }: { pad?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`cd-card ${pad ? 'cd-card-pad' : ''} ${className}`} {...rest}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <div>
        <h1 className="cd-page-h1">{title}</h1>
        {subtitle && <p className="cd-page-sub">{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

/* ── Form controls ─────────────────────────────────────────────────────────── */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="cd-field">
      <span className="cd-label">{label}{hint && <span className="cd-hint"> {hint}</span>}</span>
      {children}
    </label>
  );
}
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="cd-input" {...props} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="cd-textarea" {...props} />;
}
export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="cd-select" {...props}>{children}</select>;
}
export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="cd-inputwrap">
      <input className="cd-input" type={show ? 'text' : 'password'} style={{ paddingRight: 44 }} {...props} />
      <button type="button" className="cd-reveal" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

/* ── Domain badges ─────────────────────────────────────────────────────────── */
export function SeverityChip({ severity }: { severity: Severity }) {
  return (
    <span className={`cd-chip ${sevClass(severity)}`}>
      <span className="cd-dot" />{severityLabel(severity)}
    </span>
  );
}
export function SlaBadge({ sla }: { sla: SlaState }) {
  return <span className={`cd-chip ${slaClass(sla)}`}>{slaLabel(sla)}</span>;
}
export function StatusPill({ status }: { status: FindingStatus | string }) {
  return <span className="cd-pill">{String(status).replace('_', ' ')}</span>;
}
export function Mono({ children, className = '', ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={`cd-mono ${className}`} {...rest}>{children}</span>;
}

/* ── StatCard / EmptyState / Spinner / Tabs ────────────────────────────────── */
export function StatCard({ label, value, sub, icon, iconColor, valueColor }: {
  label: string; value: React.ReactNode; sub?: string; icon?: React.ReactNode; iconColor?: string; valueColor?: string;
}) {
  return (
    <div className="cd-kpi">
      <div className="cd-kpi-label">
        {icon && <span className="cd-kpi-icon" style={{ background: iconColor ? `color-mix(in srgb, ${iconColor} 15%, transparent)` : 'var(--accent-soft)', color: iconColor ?? 'var(--accent-text)' }}>{icon}</span>}
        {label}
      </div>
      <div className="cd-kpi-value" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      {sub && <div className="cd-kpi-sub">{sub}</div>}
    </div>
  );
}
export function EmptyState({ title, message, action, icon }: { title: string; message?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="cd-empty">
      {icon && <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--text-3)' }}>{icon}</div>}
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      {message && <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 16px' }}>{message}</p>}
      {action}
    </div>
  );
}
export function Spinner() { return <span className="cd-spinner" role="status" aria-label="Loading" />; }

export interface TabDef { key: string; label: string; }
export function Tabs({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="cd-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={active === t.key} className="cd-tab" onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Convenience: severity count map for a finding list. */
export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  findings.forEach((f) => { c[f.severity]++; });
  return c;
}
