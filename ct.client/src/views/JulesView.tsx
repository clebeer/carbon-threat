import React, { useEffect, useState } from 'react';
import { useJulesStore } from '../store/julesStore';
import { JulesStatusBadge } from '../components/Jules/JulesStatusBadge';
import { JulesSessionDetail } from '../components/Jules/JulesSessionDetail';
import type { JulesSession } from '../api/jules';

export default function JulesView() {
  const { sessions, total, fetchSessions, fetchSessionDetail, startPolling, clearDetail } = useJulesStore();
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    fetchSessions()
      .catch(err => setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? (err as Error).message ?? 'Erro ao carregar sessões'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const TERMINAL = new Set(['done', 'error']);
    sessions.forEach(s => {
      if (!TERMINAL.has(s.status)) startPolling(s.id);
    });
  }, [sessions.length]);

  async function openDetail(session: JulesSession) {
    await fetchSessionDetail(session.id);
    setShowDetail(true);
  }

  function closeDetail() {
    clearDetail();
    setShowDetail(false);
    fetchSessions();
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 className="label-text glow-text-cyan" style={{ margin: 0, fontSize: '16px', letterSpacing: '2px' }}>
          JULES — REMEDIAÇÃO AUTOMÁTICA
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--on-surface-muted)' }}>
          Sessões de remediação de vulnerabilidades via Google Jules AI. Dispare sessões nas abas Scanner ou ATT&CK.
        </p>
      </div>

      {loading && <p style={{ color: 'var(--on-surface-muted)', fontSize: '13px' }}>Carregando sessões…</p>}

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: '8px', color: 'var(--error)', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {!loading && sessions.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--on-surface-muted)', fontSize: '13px' }}>
          Nenhuma sessão Jules criada ainda.<br />
          Clique em <strong>Jules</strong> em qualquer vulnerabilidade na aba Scanner para iniciar.
        </div>
      )}

      {sessions.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Finding', 'Repositório', 'Modo', 'Status', 'PR', 'Data', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--on-surface-muted)', fontWeight: 500, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr
                  key={s.id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => openDetail(s)}
                >
                  <td style={{ padding: '10px 12px', color: 'var(--primary)', fontFamily: 'monospace', fontSize: '11px' }}>
                    {s.finding_id.length > 24 ? `${s.finding_id.slice(0, 24)}…` : s.finding_id}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#e2e8f0', fontSize: '11px' }}>
                    {s.source_name.split('/').pop()}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--on-surface-muted)', fontSize: '11px' }}>
                    {s.automation_mode === 'AUTO_CREATE_PR' ? 'Auto PR' : 'Manual'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <JulesStatusBadge status={s.status} />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {s.pr_url
                      ? <a href={s.pr_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)', fontSize: '11px' }}>Ver PR →</a>
                      : <span style={{ color: 'var(--on-surface-muted)', fontSize: '11px' }}>–</span>
                    }
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--on-surface-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                    {new Date(s.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--on-surface-muted)', fontSize: '11px' }}>
                    Detalhes →
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: '11px', color: 'var(--on-surface-muted)', marginTop: '8px', textAlign: 'right' }}>
            {sessions.length} de {total} sessões
          </p>
        </div>
      )}

      {showDetail && <JulesSessionDetail onClose={closeDetail} />}
    </div>
  );
}
