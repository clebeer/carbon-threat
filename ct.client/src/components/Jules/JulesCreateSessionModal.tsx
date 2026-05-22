import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listSources } from '../../api/jules';
import { useJulesStore } from '../../store/julesStore';
import type { AutomationMode, JulesSession } from '../../api/jules';
import type { ScanFinding } from '../../api/scanner';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

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
    if (sources?.length && !sourceName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSourceName(sources[0].name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <Modal open onClose={onClose} title="Remediar com Jules" style={{ width: 500 }}>
      {/* Finding badge */}
      <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', color: 'var(--on-surface-muted)' }}>
        <span style={{ color: 'var(--error)', fontWeight: 'var(--weight-semibold)' as unknown as number }}>{finding.vuln_id}</span>
        {' — '}{finding.package_name}{finding.package_version ? `@${finding.package_version}` : ''}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Repository */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="jules-repo" style={labelStyle}>Repositório GitHub</label>
          {sourcesLoading && <Spinner label="Carregando repositórios" />}
          {sourcesError && (
            <p role="alert" style={{ color: 'var(--error)', fontSize: 'var(--text-xs)' }}>
              Não foi possível carregar os repositórios. Verifique a Jules API key.
            </p>
          )}
          {sources && (
            <select
              id="jules-repo"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              style={selectStyle}
            >
              {sources.map((s) => (
                <option key={s.name} value={s.name}>{s.displayName ?? s.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Automation mode */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <p style={{ ...labelStyle, marginBottom: 'var(--space-2)' }}>Modo de Automação</p>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {(['AUTO_CREATE_PR', 'REQUIRE_APPROVAL'] as AutomationMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  border: mode === m ? '1px solid var(--primary)' : '1px solid var(--border-medium)',
                  background: mode === m ? 'rgba(0,242,255,0.1)' : 'rgba(255,255,255,0.03)',
                  color: mode === m ? 'var(--primary)' : 'var(--on-surface-muted)',
                  fontSize: 'var(--text-xs)', fontFamily: 'var(--font-label)', letterSpacing: '0.3px',
                }}
              >
                {m === 'AUTO_CREATE_PR' ? 'Auto PR' : 'Aprovação Manual'}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt */}
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <label htmlFor="jules-prompt" style={labelStyle}>Prompt (editável)</label>
          <textarea
            id="jules-prompt"
            rows={4}
            value={promptText || defaultPrompt}
            onChange={(e) => setPromptText(e.target.value)}
            style={{ width: '100%', padding: 'var(--space-3)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', color: 'var(--on-surface)', fontSize: 'var(--text-xs)', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }}
          />
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--error)', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-4)' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={sourcesLoading || !sourceName}
          >
            Criar Sessão Jules
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-xs)',
  color: 'var(--on-surface-muted)',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  marginBottom: 'var(--space-1)',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-3) var(--space-4)',
  background: 'var(--surface-container)',
  border: '1px solid var(--border-medium)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--on-surface)',
  fontSize: 'var(--text-sm)',
};
