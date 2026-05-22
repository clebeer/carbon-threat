import React, { useId } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 'var(--space-1)',
  fontFamily: 'var(--font-label)',
  fontSize: 'var(--text-xs)',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: 'var(--on-surface-muted)',
};

/** Labeled native <select>. Native control keeps keyboard + a11y behavior intact. */
const Select = ({ label, options, error, required, id, style, ...rest }: SelectProps) => {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <label htmlFor={selectId} style={labelStyle}>
        {label}
        {required && <span aria-hidden="true" style={{ color: 'var(--error)', marginLeft: 4 }}>*</span>}
      </label>
      <select
        id={selectId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${error ? 'var(--error)' : 'var(--border-medium)'}`,
          background: 'var(--surface-container)',
          color: 'var(--on-surface)',
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-display)',
          ...style,
        }}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && (
        <p id={errorId} role="alert" style={{ margin: 'var(--space-1) 0 0', color: 'var(--error)', fontSize: 'var(--text-xs)' }}>
          {error}
        </p>
      )}
    </div>
  );
};

export default Select;
