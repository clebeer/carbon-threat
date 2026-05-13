import React from 'react';
import { type ThreatModelSummary } from '../../api/threatmodels';

interface RecentModelsProps {
  models: ThreatModelSummary[];
}

export default function RecentModels({ models }: RecentModelsProps) {
  const recent = [...models]
    .sort((a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime())
    .slice(0, 5);

  if (recent.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--on-surface-muted)', fontSize: '13px' }}>
        No threat models found. Create one to get started.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {recent.map(m => (
        <div key={m.id} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 12px', borderRadius: '6px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: '12px', color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
            {m.title}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--on-surface-muted)', flexShrink: 0 }}>
            {m.is_archived ? 'Archived' : 'Active'}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--on-surface-muted)', flexShrink: 0 }}>
            {new Date(m.updated_at ?? m.created_at).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  );
}