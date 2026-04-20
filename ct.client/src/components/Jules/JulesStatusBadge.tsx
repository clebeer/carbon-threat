import React from 'react';
import type { JulesStatus } from '../../api/jules';

const STATUS_CONFIG: Record<JulesStatus, { label: string; color: string; pulse?: boolean }> = {
  pending:           { label: 'PENDING',          color: 'var(--on-surface-muted)' },
  planning:          { label: 'PLANNING',          color: 'var(--primary)', pulse: true },
  awaiting_approval: { label: 'AWAITING APPROVAL', color: '#f59e0b' },
  running:           { label: 'RUNNING',           color: 'var(--primary)', pulse: true },
  done:              { label: 'DONE',              color: '#52c41a' },
  error:             { label: 'ERROR',             color: 'var(--error)' },
};

export function JulesStatusBadge({ status }: { status: JulesStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '2px 8px', borderRadius: '4px', fontSize: '10px',
      fontFamily: 'var(--font-label)', letterSpacing: '0.5px',
      background: `${cfg.color}18`, color: cfg.color,
      border: `1px solid ${cfg.color}40`,
    }}>
      {cfg.pulse && (
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: cfg.color,
          animation: 'jules-pulse 1.4s ease-in-out infinite',
        }} />
      )}
      {cfg.label}
    </span>
  );
}
