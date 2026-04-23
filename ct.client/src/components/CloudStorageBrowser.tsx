import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getCloudStatus, getAuthUrl, listCloudFiles, importCloudFile, exportModelToCloud, disconnectCloud,
  type CloudProvider, type CloudFile,
} from '../api/cloudStorage';
import { listThreatModels, type ThreatModelSummary } from '../api/threatmodels';

interface Props {
  onClose: () => void;
  onImported?: (modelId: string, title: string) => void;
}

const PROVIDER_META: Record<CloudProvider, { name: string; icon: string; color: string }> = {
  google_drive: { name: 'Google Drive', icon: '△', color: '#4285F4' },
  onedrive:     { name: 'OneDrive',     icon: '☁', color: '#0078D4' },
};

function CloudProviderTab({
  provider,
  onImported,
}: {
  provider: CloudProvider;
  onImported?: (modelId: string, title: string) => void;
}) {
  const meta = PROVIDER_META[provider];
  const [connecting, setConnecting] = useState(false);
  const [importTitle, setImportTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<CloudFile | null>(null);
  const [exportModelId, setExportModelId] = useState<string>('');
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['cloud-status', provider],
    queryFn: () => getCloudStatus(provider),
  });

  const { data: files = [], isLoading: filesLoading, refetch: refetchFiles } = useQuery({
    queryKey: ['cloud-files', provider],
    queryFn: () => listCloudFiles(provider),
    enabled: status?.connected === true,
  });

  const { data: models = [] } = useQuery<ThreatModelSummary[]>({
    queryKey: ['threatmodels'],
    queryFn: listThreatModels,
    enabled: status?.connected === true,
  });

  function showMsg(text: string, ok = true) {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 4000);
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const authUrl = await getAuthUrl(provider);
      const popup = window.open(authUrl, 'cloud_auth', 'width=600,height=700,scrollbars=yes');
      const listener = (e: MessageEvent) => {
        if (e.data?.type === 'CLOUD_AUTH_SUCCESS' && e.data?.provider === provider) {
          window.removeEventListener('message', listener);
          popup?.close();
          refetchStatus();
          refetchFiles();
        }
      };
      window.addEventListener('message', listener);
      // Fallback: poll for popup close
      const timer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(timer);
          window.removeEventListener('message', listener);
          refetchStatus();
          setConnecting(false);
        }
      }, 800);
    } catch {
      showMsg('Failed to get auth URL. Check server configuration.', false);
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectCloud(provider);
      refetchStatus();
      showMsg(`Disconnected from ${meta.name}`);
    } catch {
      showMsg('Disconnect failed', false);
    }
  }

  async function handleImport() {
    if (!selectedFile || !importTitle.trim()) return;
    try {
      const { id, title } = await importCloudFile(provider, selectedFile.id, importTitle.trim());
      showMsg(`Imported "${title}" successfully`);
      setSelectedFile(null);
      setImportTitle('');
      onImported?.(id, title);
    } catch {
      showMsg('Import failed', false);
    }
  }

  async function handleExport() {
    if (!exportModelId) return;
    try {
      const { fileName } = await exportModelToCloud(provider, exportModelId);
      showMsg(`Exported as "${fileName}"`);
    } catch {
      showMsg('Export failed', false);
    }
  }

  if (!status?.connected) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '48px', color: meta.color }}>{meta.icon}</div>
        <div>
          <p style={{ color: '#e2e8f0', fontSize: '16px', margin: '0 0 6px', fontWeight: 500 }}>Connect {meta.name}</p>
          <p style={{ color: 'var(--on-surface-muted)', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
            Authorize CarbonThreat to read and write threat model files in your {meta.name}.
          </p>
        </div>
        {actionMsg && (
          <div style={{ fontSize: '12px', color: actionMsg.ok ? '#22c55e' : 'var(--error)', padding: '8px 14px', borderRadius: '6px', background: actionMsg.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${actionMsg.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
            {actionMsg.text}
          </div>
        )}
        <button
          onClick={handleConnect}
          disabled={connecting}
          style={{ padding: '10px 28px', borderRadius: '8px', border: 'none', background: meta.color, color: '#fff', fontSize: '14px', fontWeight: 600, cursor: connecting ? 'not-allowed' : 'pointer', opacity: connecting ? 0.7 : 1 }}
        >
          {connecting ? 'Opening auth window…' : `Connect ${meta.name}`}
        </button>
        <div style={{ padding: '10px 14px', background: 'rgba(179,102,255,0.05)', border: '1px solid rgba(179,102,255,0.2)', borderRadius: '6px', fontSize: '11px', color: 'var(--on-surface-muted)', lineHeight: 1.6, maxWidth: '320px', textAlign: 'left' }}>
          <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>Next release:</span>{' '}
          OAuth credentials (<code style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>GOOGLE_CLIENT_ID</code> / <code style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>MICROSOFT_CLIENT_ID</code>) will be configurable directly in Settings → Integrations, without requiring server restarts.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
      {/* Connected header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
        <div>
          <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>✓ Connected</span>
          {status.email && <span style={{ fontSize: '11px', color: 'var(--on-surface-muted)', marginLeft: '8px' }}>{status.email}</span>}
        </div>
        <button onClick={handleDisconnect} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
          Disconnect
        </button>
      </div>

      {actionMsg && (
        <div style={{ fontSize: '12px', color: actionMsg.ok ? '#22c55e' : 'var(--error)', padding: '8px 14px', borderRadius: '6px', background: actionMsg.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${actionMsg.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
          {actionMsg.text}
        </div>
      )}

      {/* Import section */}
      <div>
        <div style={{ fontSize: '11px', color: 'var(--secondary)', letterSpacing: '0.5px', marginBottom: '10px' }}>IMPORT FROM {meta.name.toUpperCase()}</div>
        {filesLoading && <p style={{ color: 'var(--on-surface-muted)', fontSize: '12px', margin: 0 }}>Loading files…</p>}
        {!filesLoading && files.length === 0 && (
          <p style={{ color: 'var(--on-surface-muted)', fontSize: '12px', margin: 0 }}>No JSON files found in your {meta.name}.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', marginBottom: '10px' }}>
          {files.map(f => (
            <div
              key={f.id}
              onClick={() => { setSelectedFile(f); setImportTitle(f.name.replace(/\.json$/i, '')); }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '6px', background: selectedFile?.id === f.id ? 'rgba(0,242,255,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedFile?.id === f.id ? 'rgba(0,242,255,0.3)' : 'rgba(255,255,255,0.07)'}`, cursor: 'pointer' }}
            >
              <span style={{ fontSize: '13px', color: '#e2e8f0' }}>📄 {f.name}</span>
              <span style={{ fontSize: '10px', color: 'var(--on-surface-muted)' }}>{new Date(f.modifiedTime).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
        {selectedFile && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={importTitle}
              onChange={e => setImportTitle(e.target.value)}
              placeholder="Model title…"
              style={{ flex: 1, padding: '7px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
            />
            <button onClick={handleImport} disabled={!importTitle.trim()}
              style={{ padding: '7px 16px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: '#000', fontWeight: 700, fontSize: '12px', cursor: importTitle.trim() ? 'pointer' : 'not-allowed', opacity: importTitle.trim() ? 1 : 0.5 }}>
              Import
            </button>
          </div>
        )}
      </div>

      {/* Export section */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--secondary)', letterSpacing: '0.5px', marginBottom: '10px' }}>EXPORT TO {meta.name.toUpperCase()}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select value={exportModelId} onChange={e => setExportModelId(e.target.value)}
            style={{ flex: 1, padding: '7px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: exportModelId ? '#e2e8f0' : 'var(--on-surface-muted)', borderRadius: '6px', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
            <option value="">Select a model…</option>
            {models.filter(m => !m.is_archived).map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
          <button onClick={handleExport} disabled={!exportModelId}
            style={{ padding: '7px 16px', borderRadius: '6px', border: `1px solid ${meta.color}40`, background: exportModelId ? `${meta.color}18` : 'transparent', color: exportModelId ? meta.color : 'var(--on-surface-muted)', fontWeight: 700, fontSize: '12px', cursor: exportModelId ? 'pointer' : 'not-allowed' }}>
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CloudStorageBrowser({ onClose, onImported }: Props) {
  const [activeProvider, setActiveProvider] = useState<CloudProvider>('google_drive');

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
      <div className="glass-panel" style={{ width: '520px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', borderRadius: '12px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--secondary)', letterSpacing: '1px' }}>CLOUD STORAGE</div>
            <div style={{ fontSize: '16px', color: '#fff', fontWeight: 600, marginTop: '2px' }}>Import / Export Models</div>
          </div>
          <button aria-label="Close" onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--on-surface-muted)', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>×</button>
        </div>

        {/* Provider tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {(Object.keys(PROVIDER_META) as CloudProvider[]).map(p => {
            const m = PROVIDER_META[p];
            return (
              <button
                key={p}
                onClick={() => setActiveProvider(p)}
                style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none', borderBottom: `2px solid ${activeProvider === p ? m.color : 'transparent'}`, background: activeProvider === p ? `${m.color}10` : 'transparent', color: activeProvider === p ? m.color : 'var(--on-surface-muted)', fontSize: '13px', fontWeight: activeProvider === p ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                <span>{m.icon}</span>
                <span>{m.name}</span>
              </button>
            );
          })}
        </div>

        {/* Provider content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <CloudProviderTab provider={activeProvider} onImported={(id, title) => { onImported?.(id, title); }} />
        </div>
      </div>
    </div>
  );
}
