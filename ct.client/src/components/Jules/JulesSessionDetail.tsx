import React from 'react';
import { useJulesStore } from '../../store/julesStore';
import { JulesStatusBadge } from './JulesStatusBadge';
import { JulesActivityFeed } from './JulesActivityFeed';

export function JulesSessionDetail({ onClose }: { onClose: () => void }) {
  const session      = useJulesStore(s => s.detailSession);
  const activities   = useJulesStore(s => s.detailActivities);
  const approvePlan  = useJulesStore(s => s.approvePlan);
  const deleteSession = useJulesStore(s => s.deleteSession);

  if (!session) return null;

  async function handleApprove() {
    await approvePlan(session!.id);
  }

  async function handleDelete() {
    if (confirm('Remover esta sessão Jules do histórico?')) {
      await deleteSession(session!.id);
      onClose();
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'flex-end', zIndex: 900, background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '480px', maxWidth: '100vw', background: 'var(--surface)', borderLeft: '1px solid rgba(0,242,255,0.15)', padding: '28px', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--primary)', fontFamily: 'var(--font-label)', letterSpacing: '1px' }}>
              SESSÃO JULES
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--on-surface-muted)' }}>
              {session.finding_id} · {session.source_name.split('/').pop()}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--on-surface-muted)', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>

        {/* Status + PR link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <JulesStatusBadge status={session.status} />
          {session.pr_url && (
            <a href={session.pr_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--primary)' }}>
              Ver PR →
            </a>
          )}
        </div>

        {/* Approve plan button */}
        {session.status === 'awaiting_approval' && (
          <button
            onClick={handleApprove}
            style={{
              width: '100%', padding: '10px', marginBottom: '20px',
              background: '#f59e0b', border: 'none', borderRadius: '6px',
              color: '#000', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            }}
          >
            Aprovar Plano Jules
          </button>
        )}

        {/* Prompt */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--on-surface-muted)', letterSpacing: '0.5px' }}>PROMPT</p>
          <pre style={{ margin: 0, padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '11px', color: '#e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {session.prompt}
          </pre>
        </div>

        {/* Plan summary */}
        {session.plan_summary && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--on-surface-muted)', letterSpacing: '0.5px' }}>PLANO</p>
            <pre style={{ margin: 0, padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '11px', color: '#e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {session.plan_summary}
            </pre>
          </div>
        )}

        {/* Activities */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--on-surface-muted)', letterSpacing: '0.5px' }}>ATIVIDADES</p>
          <JulesActivityFeed activities={activities} />
        </div>

        {/* Delete */}
        <button
          onClick={handleDelete}
          style={{ padding: '6px 14px', border: '1px solid rgba(255,80,80,0.3)', borderRadius: '6px', background: 'transparent', color: 'var(--error)', cursor: 'pointer', fontSize: '12px' }}
        >
          Remover Sessão
        </button>
      </div>
    </div>
  );
}
