import React from 'react';

export type BadgeVariant = 'info' | 'success' | 'warning' | 'error' | 'neutral';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const COLORS: Record<BadgeVariant, { fg: string; bg: string }> = {
  info: { fg: 'var(--primary)', bg: 'rgba(0, 242, 255, 0.12)' },
  success: { fg: 'var(--success)', bg: 'rgba(34, 197, 94, 0.14)' },
  warning: { fg: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.16)' },
  error: { fg: 'var(--error)', bg: 'rgba(255, 77, 79, 0.14)' },
  neutral: { fg: 'var(--on-surface-muted)', bg: 'rgba(255, 255, 255, 0.06)' },
};

/** Compact status/severity label with a semantic color scheme. */
const Badge = ({ variant = 'neutral', children, style }: BadgeProps) => {
  const { fg, bg } = COLORS[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px var(--space-2)',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-label)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-semibold)' as unknown as number,
        letterSpacing: '0.3px',
        color: fg,
        background: bg,
        ...style,
      }}
    >
      {children}
    </span>
  );
};

export default Badge;
