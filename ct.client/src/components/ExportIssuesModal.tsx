import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  exportIssue,
  listIntegrations,
  type Platform,
  type IntegrationSummary,
} from '../api/integrations';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Spinner from './ui/Spinner';

interface ExportIssuesModalProps {
  defaultTitle?: string;
  defaultDescription?: string;
  onClose: () => void;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  github:      'GitHub Issues',
  jira:        'Jira Software',
  servicenow:  'ServiceNow',
  openai:      'OpenAI',
  ollama:      'Ollama',
  jules:       'Jules',
};

const PLATFORM_ICONS: Record<Platform, string> = {
  github:      '⌥',
  jira:        '⬡',
  servicenow:  '⚙',
  openai:      '◈',
  ollama:      '○',
  jules:       '◎',
};

const EXPORTABLE: Platform[] = ['github', 'jira', 'servicenow'];

export default function ExportIssuesModal({
  defaultTitle = '',
  defaultDescription = '',
  onClose,
}: ExportIssuesModalProps) {
  const [title, setTitle]             = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [platform, setPlatform]       = useState<Platform | ''>('');
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);

  const { data: configs = [], isLoading: loadingConfigs } = useQuery<IntegrationSummary[]>({
    queryKey: ['integrations'],
    queryFn: listIntegrations,
  });

  const enabledExportable = configs.filter(
    (c) => c.is_enabled && EXPORTABLE.includes(c.platform)
  );

  const exportMutation = useMutation({
    mutationFn: () => exportIssue(platform as Platform, title, description),
    onSuccess: (data) => setSuccessMsg(data.message),
  });

  const canExport = platform !== '' && title.trim().length > 0 && description.trim().length > 0;

  return (
    <Modal open onClose={onClose} title="Create Issue" style={{ width: 520, maxHeight: '80vh', overflowY: 'auto' }}>
      {/* Sub-label */}
      <div style={{ fontSize: 'var(--text-xs)', letterSpacing: '1px', color: 'var(--secondary)', marginBottom: 'var(--space-4)' }}>
        EXPORT THREAT
      </div>

      {/* Success state */}
      {successMsg ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
          <div style={{ fontSize: 32, marginBottom: 'var(--space-4)' }}>✓</div>
          <div style={{ color: 'var(--primary)', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)' as unknown as number, marginBottom: 'var(--space-2)' }}>
            {successMsg}
          </div>
          <Button variant="primary" style={{ marginTop: 'var(--space-4)' }} onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <>
          {/* Platform selector */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <p style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.8px', color: 'var(--on-surface-muted)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>
              Target Platform
            </p>
            {loadingConfigs ? (
              <Spinner label="Loading integrations" />
            ) : enabledExportable.length === 0 ? (
              <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'rgba(255,77,79,0.08)', border: '1px solid rgba(255,77,79,0.2)', fontSize: 'var(--text-sm)', color: 'var(--error)' }}>
                No integrations enabled. Go to <strong>Admin → Integrations</strong> to configure GitHub, Jira, or ServiceNow.
              </div>
            ) : (
              <div role="radiogroup" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                {enabledExportable.map((c) => (
                  <button
                    key={c.platform}
                    type="button"
                    role="radio"
                    aria-checked={platform === c.platform}
                    onClick={() => setPlatform(c.platform)}
                    style={{
                      padding: 'var(--space-3) var(--space-2)', borderRadius: 'var(--radius-md)',
                      cursor: 'pointer', textAlign: 'center',
                      border: platform === c.platform ? '1px solid var(--primary)' : '1px solid var(--border-medium)',
                      background: platform === c.platform ? 'rgba(0,242,255,0.1)' : 'rgba(255,255,255,0.03)',
                      color: platform === c.platform ? 'var(--primary)' : 'var(--on-surface-muted)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{PLATFORM_ICONS[c.platform]}</div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: platform === c.platform ? 'var(--weight-semibold)' as unknown as number : 400 }}>
                      {PLATFORM_LABELS[c.platform]}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="export-title" style={labelStyle}>Issue Title</label>
            <input
              id="export-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. [HIGH] SQL Injection in /api/users endpoint"
              style={inputStyle}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="export-description" style={labelStyle}>Description</label>
            <textarea
              id="export-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the threat, affected components, and recommended mitigation…"
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-display)' }}
            />
          </div>

          {/* Error */}
          {exportMutation.isError && (
            <p role="alert" style={{ marginBottom: 'var(--space-3)', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(255,77,79,0.08)', border: '1px solid rgba(255,77,79,0.2)', fontSize: 'var(--text-xs)', color: 'var(--error)' }}>
              {(exportMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Export failed'}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button variant="secondary" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              style={{ flex: 2 }}
              loading={exportMutation.isPending}
              disabled={!canExport}
              onClick={() => exportMutation.mutate()}
            >
              {exportMutation.isPending ? 'Exporting…' : `Export to ${platform ? PLATFORM_LABELS[platform] : '—'}`}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-xs)',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: 'var(--on-surface-muted)',
  marginBottom: 'var(--space-1)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: 'var(--space-3) var(--space-4)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-medium)',
  background: 'var(--surface-container)',
  color: 'var(--on-surface)',
  fontSize: 'var(--text-sm)',
  outline: 'none',
};
