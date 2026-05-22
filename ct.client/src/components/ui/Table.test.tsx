import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Table, { type TableColumn } from './Table';

interface Row { id: string; name: string; role: string; }

const columns: TableColumn<Row>[] = [
  { key: 'name', header: 'Name' },
  { key: 'role', header: 'Role', render: (r) => r.role.toUpperCase() },
];

const rows: Row[] = [
  { id: '1', name: 'Alice', role: 'admin' },
  { id: '2', name: 'Bob', role: 'viewer' },
];

describe('Table', () => {
  it('renders column headers as scoped <th>', () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.id} />);
    const header = screen.getByRole('columnheader', { name: 'Name' });
    expect(header).toHaveAttribute('scope', 'col');
  });

  it('renders one row per item and applies custom render', () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument(); // render() upper-cased it
  });

  it('shows the empty message when there are no rows', () => {
    render(<Table columns={columns} rows={[]} rowKey={(r) => r.id} emptyMessage="No users yet" />);
    expect(screen.getByText('No users yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
