import React from 'react';

export interface TableColumn<T> {
  /** Stable key; also used to read the cell value when `render` is omitted. */
  key: keyof T & string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  /** Reads a stable React key from each row. */
  rowKey: (row: T) => string;
  /** Accessible description of the table for screen readers. */
  caption?: string;
  /** Shown when `rows` is empty. */
  emptyMessage?: string;
}

const cellBase: React.CSSProperties = {
  padding: 'var(--space-3) var(--space-4)',
  textAlign: 'left',
  fontSize: 'var(--text-sm)',
};

/** Semantic data table (<table>/<th scope>) to replace ad-hoc <div> lists. */
function Table<T>({ columns, rows, rowKey, caption, emptyMessage = 'No data' }: TableProps<T>) {
  if (rows.length === 0) {
    return (
      <p style={{ color: 'var(--on-surface-muted)', fontSize: 'var(--text-sm)', padding: 'var(--space-4)' }}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      {caption && <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{caption}</caption>}
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              scope="col"
              style={{
                ...cellBase,
                textAlign: col.align ?? 'left',
                color: 'var(--on-surface-muted)',
                fontFamily: 'var(--font-label)',
                fontSize: 'var(--text-xs)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                borderBottom: '1px solid var(--border-medium)',
              }}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {columns.map((col) => (
              <td key={col.key} style={{ ...cellBase, textAlign: col.align ?? 'left', color: 'var(--on-surface)' }}>
                {col.render ? col.render(row) : String(row[col.key] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default Table;
