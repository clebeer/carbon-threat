import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Field from './Field';

describe('Field', () => {
  it('associates the label with the input', () => {
    render(<Field label="Email" />);
    // getByLabelText only resolves when label/input are correctly associated
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('marks the input invalid and announces the error', () => {
    render(<Field label="Email" error="Required field" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Required field');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
  });

  it('exposes a hint via aria-describedby when there is no error', () => {
    render(<Field label="Password" hint="Min 12 chars" />);
    const input = screen.getByLabelText('Password');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent('Min 12 chars');
  });

  it('reflects the required attribute', () => {
    render(<Field label="Email" required />);
    expect(screen.getByLabelText(/Email/)).toBeRequired();
  });
});
