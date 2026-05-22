import React from 'react';
import Spinner from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, sets aria-busy and disables the button. */
  loading?: boolean;
  /** Optional leading icon (decorative). */
  icon?: React.ReactNode;
}

const SIZES: Record<ButtonSize, React.CSSProperties> = {
  // min-height keeps a >=40px touch target (lg reaches the 44px recommendation).
  sm: { minHeight: 36, padding: '0 var(--space-3)', fontSize: 'var(--text-xs)' },
  md: { minHeight: 40, padding: '0 var(--space-4)', fontSize: 'var(--text-sm)' },
  lg: { minHeight: 44, padding: '0 var(--space-5)', fontSize: 'var(--text-md)' },
};

const VARIANTS: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: 'var(--primary)', color: 'var(--on-primary)', border: '1px solid transparent' },
  secondary: { background: 'transparent', color: 'var(--on-surface)', border: '1px solid var(--border-medium)' },
  ghost: { background: 'transparent', color: 'var(--on-surface-muted)', border: '1px solid transparent' },
  danger: { background: 'var(--error)', color: '#ffffff', border: '1px solid transparent' },
};

/**
 * Primary action button. Always renders a real <button> (keyboard + focus ring
 * come for free). Use `loading` for async actions — it disables and announces busy.
 */
const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  children,
  style,
  type = 'button',
  ...rest
}: ButtonProps) => {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-display)',
        fontWeight: 'var(--weight-semibold)' as unknown as number,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.55 : 1,
        transition: 'opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease',
        ...SIZES[size],
        ...VARIANTS[variant],
        ...style,
      }}
      {...rest}
    >
      {loading && <Spinner size={14} />}
      {!loading && icon && <span aria-hidden="true" style={{ display: 'inline-flex' }}>{icon}</span>}
      {children}
    </button>
  );
};

export default Button;
