import React from 'react';

export interface SpinnerProps {
  /** Diameter in px. Defaults to 16. */
  size?: number;
  /** Stroke color. Defaults to currentColor so it inherits the button/text color. */
  color?: string;
  /** Accessible label announced to screen readers. Defaults to "Loading". */
  label?: string;
}

/**
 * Indeterminate loading spinner. Renders an accessible status region so screen
 * readers announce the loading state.
 */
const Spinner = ({ size = 16, color = 'currentColor', label = 'Loading' }: SpinnerProps) => (
  <span
    role="status"
    aria-live="polite"
    aria-label={label}
    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
  >
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-full)',
        border: `${Math.max(2, Math.round(size / 8))}px solid var(--border-medium)`,
        borderTopColor: color,
        display: 'inline-block',
        animation: 'ct-spin 0.6s linear infinite',
      }}
    />
  </span>
);

export default Spinner;
