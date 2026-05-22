import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from './Badge';
import Spinner from './Spinner';

describe('Badge', () => {
  it('renders its content', () => {
    render(<Badge variant="error">Critical</Badge>);
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });
});

describe('Spinner', () => {
  it('exposes an accessible status role with a default label', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveAccessibleName('Loading');
  });

  it('supports a custom label', () => {
    render(<Spinner label="Saving" />);
    expect(screen.getByRole('status')).toHaveAccessibleName('Saving');
  });
});
