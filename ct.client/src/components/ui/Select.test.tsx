import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Select from './Select';

const options = [
  { value: 'admin', label: 'Administrator' },
  { value: 'analyst', label: 'Analyst' },
];

describe('Select', () => {
  it('associates the label and renders options', () => {
    render(<Select label="Role" options={options} />);
    const select = screen.getByLabelText('Role');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Administrator' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Analyst' })).toBeInTheDocument();
  });

  it('calls onChange with the selected value', async () => {
    const onChange = vi.fn();
    render(<Select label="Role" options={options} value="admin" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Role'), 'analyst');
    expect(onChange).toHaveBeenCalled();
  });
});
