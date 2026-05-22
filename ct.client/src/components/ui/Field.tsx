import React, { useId } from 'react';

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Validation message; when set, marks the input invalid and is announced. */
  error?: string;
  /** Helper text shown below the input when there is no error. */
  hint?: string;
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

/**
 * Labeled text input. Always associates a real <label> with the control and
 * wires aria-invalid / aria-describedby so errors and hints are accessible.
 */
const Field = ({ label, error, hint, required, id, style, ...rest }: FieldProps) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedById = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <label htmlFor={inputId} style={labelStyle}>
        {label}
        {required && <span aria-hidden="true" style={{ color: 'var(--error)', marginLeft: 4 }}>*</span>}
      </label>
      <input
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedById}
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
      />
      {error && (
        <p id={describedById} role="alert" style={{ margin: 'var(--space-1) 0 0', color: 'var(--error)', fontSize: 'var(--text-xs)' }}>
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={describedById} style={{ margin: 'var(--space-1) 0 0', color: 'var(--on-surface-hint)', fontSize: 'var(--text-xs)' }}>
          {hint}
        </p>
      )}
    </div>
  );
};

export default Field;
