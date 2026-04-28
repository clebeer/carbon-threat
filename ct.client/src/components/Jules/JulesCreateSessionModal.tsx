import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listSources } from '../../api/jules';
import { useJulesStore } from '../../store/julesStore';
import type { AutomationMode, JulesSession } from '../../api/jules';
import type { ScanFinding } from '../../api/scanner';

interface Props {
  finding: ScanFinding;
  onClose: () => void;
  onCreated?: (session: JulesSession) => void;
}

export function JulesCreateSessionModal({ finding, onClose, onCreated }: Props) {
  const [sourceName, setSourceName] = useState('');
  const [mode, setMode]             = useState<AutomationMode>('AUTO_CREATE_PR');
  const [promptText, setPromptText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const createSession = useJulesStore(s => s.createSession);

  const { data: sources, isLoading: sourcesLoading, error: sourcesError } = useQuery({
    queryKey: ['jules-sources'],
    queryFn:  listSources,
    retry: false,
  });

  useEffect(() => {
    if (sources?.length && !sourceName) setSourceName(sources[0].name);
  }, [sources]);

  const defaultPrompt = `Fix vulnerability ${finding.vuln_id}: ${finding.title ?? 'security vulnerability'} in package ${finding.package_name}${finding.package_version ? `@${finding.package_version}` : ''}.${finding.fixed_version ? ` Upgrade to ${finding.fixed_version}.` : ''}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceName) { setError('Selecione um repositório'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const session = await createSession({
        finding_id:      finding.id,
        source_name:     sourceName,
        automation_mode: mode,
        prompt_override: promptText.trim() && promptText.trim() !== defaultPrompt ? promptText.trim() : undefined,
      });
      onCreated?.(session);
      onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Falha ao criar sessão');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--surface)', border: '1px solid rgba(0,242,255,0.2)', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '500px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: 'var(--primary)', fontFamily: 'var(--font-label)', letterSpacing: '1px', fontSize: '14px' }}>
            REMEDIAR COM JULES
          </h3>
          <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--on-surface-muted)', cursor: 'pointer', fontSize: '18px' }}>×</button>
        </div>

        <div style={{ marginBottom: '16px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '12px', color: 'var(--on-surface-muted)' }}>
          <span style={{ color: 'var(--error)', fontWeight: 600 }}>{finding.vuln_id}</span>
          {' — '}{finding.package_name}{finding.package_version ? `@${finding.package_version}` : ''}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Source */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--on-surface-muted)', marginBottom: '6px', letterSpacing: '0.5px' }}>
              REPOSITÓRIO GITHUB
            </label>
            {sourcesLoading && <p style={{ color: 'var(--on-surface-muted)', fontSize: '12px' }}>Carregando repositórios…</p>}
            {sourcesError && <p style={{ color: 'var(--error)', fontSize: '12px' }}>Não foi possível carregar os repositórios. Verifique a Jules API key.</p>}
            {sources && (
              <select
                value={sourceName}
                onChange={e => setSourceName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#e2e8f0', fontSize: '13px' }}
              >
                {sources.map(s => (
                  <option key={s.name} value={s.name}>{s.displayName ?? s.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Mode toggle */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--on-surface-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>
              MODO DE AUTOMAÇÃO
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['AUTO_CREATE_PR', 'REQUIRE_APPROVAL'] as AutomationMode[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '6px', cursor: 'pointer',
                    border: mode === m ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                    background: mode === m ? 'rgba(0,242,255,0.1)' : 'rgba(255,255,255,0.03)',
                    color: mode === m ? 'var(--primary)' : 'var(--on-surface-muted)',
                    fontSize: '11px', fontFamily: 'var(--font-label)', letterSpacing: '0.3px',
                  }}
                >
                  {m === 'AUTO_CREATE_PR' ? 'Auto PR' : 'Aprovação Manual'}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--on-surface-muted)', marginBottom: '6px', letterSpacing: '0.5px' }}>
              PROMPT (editável)
            </label>
            <textarea
              rows={4}
              value={promptText || defaultPrompt}
              onChange={e => setPromptText(e.target.value)}
              style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#e2e8f0', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }}
            />
          </div>

          {error && (
            <p style={{ color: 'var(--error)', fontSize: '12px', marginBottom: '14px' }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--on-surface-muted)', cursor: 'pointer', fontSize: '13px' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || sourcesLoading || !sourceName}
              style={{
                padding: '8px 20px', borderRadius: '6px', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                background: submitting ? 'rgba(0,242,255,0.3)' : 'var(--primary)', color: '#000', fontWeight: 600, fontSize: '13px',
              }}
            >
              {submitting ? 'Criando…' : 'Criar Sessão Jules'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
