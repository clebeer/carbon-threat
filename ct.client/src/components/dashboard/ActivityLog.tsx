import React from 'react';

interface AuditRow {
  id: number;
  action: string;
  entity_type: string;
  created_at: string;
}

interface ActivityLogProps {
  logs: AuditRow[];
}

export default function ActivityLog({ logs }: ActivityLogProps) {
  if (logs.length === 0) {
    return (
      <p style={{ color: 'var(--on-surface-muted)', fontSize: '12px', margin: 0 }}>No recent activity.</p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {logs.slice(0, 5).map((log) => (
        <div key={log.id} style={{ fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--on-surface-muted)', flexShrink: 0, fontSize: '10px', paddingTop: '1px' }}>
            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span style={{ color: 'var(--primary)', flexShrink: 0 }}>{log.action}</span>
          <span style={{ color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.entity_type}</span>
        </div>
      ))}
    </div>
  );
}

export type { AuditRow };