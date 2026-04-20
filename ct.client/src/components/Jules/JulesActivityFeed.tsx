import React from 'react';
import type { JulesActivity } from '../../api/jules';

export function JulesActivityFeed({ activities }: { activities: JulesActivity[] }) {
  if (!activities.length) {
    return (
      <p style={{ fontSize: '12px', color: 'var(--on-surface-muted)', textAlign: 'center', padding: '20px 0' }}>
        Aguardando atividades do Jules…
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {activities.map((a, i) => (
        <div key={i} style={{
          padding: '10px 12px', background: 'rgba(255,255,255,0.03)',
          borderRadius: '6px', borderLeft: '2px solid rgba(0,242,255,0.3)',
        }}>
          <div style={{ fontSize: '10px', color: 'var(--on-surface-muted)', marginBottom: '4px', letterSpacing: '0.3px' }}>
            {a.activityType ?? a.type ?? 'ACTIVITY'}
            {a.createTime && ` · ${new Date(a.createTime).toLocaleTimeString()}`}
          </div>
          {a.message && <p style={{ margin: 0, fontSize: '12px', color: '#e2e8f0' }}>{a.message}</p>}
          {a.plan?.description && <p style={{ margin: 0, fontSize: '12px', color: '#e2e8f0' }}>{a.plan.description}</p>}
          {a.pullRequest?.url && (
            <a href={a.pullRequest.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--primary)' }}>
              Ver Pull Request →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
