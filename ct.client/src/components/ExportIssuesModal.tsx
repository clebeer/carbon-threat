import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  exportIssue,
  listIntegrations,
  type Platform,
  type IntegrationSummary,
} from '../api/integrations';

interface ExportIssuesModalProps {
  /** Pre-filled title (e.g. from the selected threat) */
  defaultTitle?: string;
  /** Pre-filled description */
  defaultDescription?: string;
  onClose: () => void;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  github:      'GitHub Issues',
  jira:        'Jira Software',
  servicenow:  'ServiceNow',
  openai:      'OpenAI',
  ollama:      'Ollama',
};

const PLATFORM_ICONS: Record<Platform, string> = {
  github:      '⌥',
  jira:        '⬡',
  servicenow:  '⚙',
  openai:      '◈',
  ollama:      '○',
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
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Modal panel — stop propagation so clicks inside don't close */}
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '520px', maxHeight: '80vh', overflowY: 'auto', padding: '32px', borderRadius: '16px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--secondary)', marginBottom: '4px' }}>EXPORT THREAT</div>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#fff', fontFamily: 'var(--font-display)' }}>Create Issue</h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--on-surface-muted)', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}
          >
            ×
          </button>
        </div>

        {/* Success state */}
        {successMsg ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>✓</div>
            <div style={{ color: 'var(--primary)', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>{successMsg}</div>
            <button
              onClick={onClose}
              style={{ marginTop: '16px', padding: '10px 24px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: '#000', fontWeight: 600, cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Platform selector */}
            <label style={labelStyle}>TARGET PLATFORM</label>
            {loadingConfigs ? (
              <div style={{ fontSize: '13px', color: 'var(--on-surface-muted)', marginBottom: '20px' }}>Loading integrations…</div>
            ) : enabledExportable.length === 0 ? (
              <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,77,79,0.08)', border: '1px solid rgba(255,77,79,0.2)', fontSize: '13px', color: 'var(--error)', marginBottom: '20px' }}>
                No integrations enabled. Go to <strong>Admin → Integrations</strong> to configure GitHub, Jira, or ServiceNow.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                {enabledExportable.map((c) => (
                  <button
                    key={c.platform}
                    onClick={() => setPlatform(c.platform)}
                    style={{
                      padding: '12px 8px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center',
                      border: platform === c.platform ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                      background: platform === c.platform ? 'rgba(0,242,255,0.1)' : 'rgba(255,255,255,0.03)',
                      color: platform === c.platform ? 'var(--primary)' : 'var(--on-surface-muted)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: '20px', marginBottom: '4px' }}>{PLATFORM_ICONS[c.platform]}</div>
                    <div style={{ fontSize: '12px', fontWeight: platform === c.platform ? 600 : 400 }}>
                      {PLATFORM_LABELS[c.platform]}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Title */}
            <label style={labelStyle}>ISSUE TITLE</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. [HIGH] SQL Injection in /api/users endpoint"
              style={inputStyle}
            />

            {/* Description */}
            <label style={{ ...labelStyle, marginTop: '16px' }}>DESCRIPTION</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the threat, affected components, and recommended mitigation…"
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-display)' }}
            />

            {/* Error */}
            {exportMutation.isError && (
              <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,77,79,0.08)', border: '1px solid rgba(255,77,79,0.2)', fontSize: '12px', color: 'var(--error)' }}>
                {(exportMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Export failed'}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={onClose}
                style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--on-surface-muted)', fontSize: '14px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => exportMutation.mutate()}
                disabled={!canExport || exportMutation.isPending}
                style={{
                  flex: 2, padding: '11px', borderRadius: '8px', border: 'none',
                  background: canExport && !exportMutation.isPending ? 'var(--primary)' : 'rgba(0,242,255,0.2)',
                  color: canExport && !exportMutation.isPending ? '#000' : 'var(--on-surface-muted)',
                  fontSize: '14px', fontWeight: 600, cursor: canExport && !exportMutation.isPending ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                {exportMutation.isPending ? 'Exporting…' : `Export to ${platform ? PLATFORM_LABELS[platform] : '—'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', letterSpacing: '0.8px',
  color: 'var(--on-surface-muted)', marginBottom: '8px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 14px',
  borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)', color: '#e2e8f0',
  fontSize: '13px', outline: 'none',
};
