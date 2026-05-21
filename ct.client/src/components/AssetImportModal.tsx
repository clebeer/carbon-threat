import React, { useState, useCallback, useRef } from 'react';
import { parseAssetJSON, parseAssetCSV, type ImportedAsset, type ImportAssetsResult } from '../importers/assetListImporter';
import { importAssets } from '../api/assets';

interface AssetImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function AssetImportModal({ open, onClose, onImported }: AssetImportModalProps) {
  const [rawText, setRawText] = useState('');
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [preview, setPreview] = useState<ImportAssetsResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleParse = useCallback(() => {
    setError('');
    const result = format === 'json' ? parseAssetJSON(rawText) : parseAssetCSV(rawText);
    setPreview(result);
  }, [rawText, format]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const detectedFormat = ext === 'csv' ? 'csv' : 'json';
    setFormat(detectedFormat);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRawText(text);
      const result = detectedFormat === 'json' ? parseAssetJSON(text) : parseAssetCSV(text);
      setPreview(result);
    };
    reader.readAsText(file);
  }, []);

  const handleImport = useCallback(async () => {
    if (!preview || preview.assets.length === 0) return;
    setImporting(true);
    setError('');

    try {
      await importAssets(rawText, format);
      onImported();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [preview, rawText, format, onImported, onClose]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const detectedFormat = ext === 'csv' ? 'csv' : 'json';
    setFormat(detectedFormat);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRawText(text);
      const result = detectedFormat === 'json' ? parseAssetJSON(text) : parseAssetCSV(text);
      setPreview(result);
    };
    reader.readAsText(file);
  }, []);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="glass-panel"
        style={{ width: '600px', maxHeight: '80vh', overflowY: 'auto', padding: '24px', borderRadius: '12px' }}
      >
        <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '16px' }}>Import Assets</h3>

        {/* File upload */}
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '8px', padding: '24px', textAlign: 'center',
            cursor: 'pointer', marginBottom: '16px', color: 'var(--on-surface-muted)', fontSize: '13px',
          }}
        >
          Drop a JSON/CSV file here or click to browse
          <input ref={fileRef} type="file" accept=".json,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
        </div>

        {/* Format toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={() => setFormat('json')}
            style={{
              padding: '6px 16px', borderRadius: '6px', border: '1px solid',
              borderColor: format === 'json' ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
              background: format === 'json' ? 'rgba(0,242,255,0.1)' : 'transparent',
              color: format === 'json' ? 'var(--primary)' : 'var(--on-surface-muted)',
              cursor: 'pointer', fontSize: '12px',
            }}
          >JSON</button>
          <button
            onClick={() => setFormat('csv')}
            style={{
              padding: '6px 16px', borderRadius: '6px', border: '1px solid',
              borderColor: format === 'csv' ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
              background: format === 'csv' ? 'rgba(0,242,255,0.1)' : 'transparent',
              color: format === 'csv' ? 'var(--primary)' : 'var(--on-surface-muted)',
              cursor: 'pointer', fontSize: '12px',
            }}
          >CSV</button>
        </div>

        {/* Text area */}
        <textarea
          value={rawText}
          onChange={(e) => { setRawText(e.target.value); setPreview(null); setError(''); }}
          placeholder={format === 'json' ? '[{"name": "Web Server", "kind": "server", "description": "..."}]' : 'name,kind,description\nWeb Server,server,Main web server'}
          style={{
            width: '100%', height: '120px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px', padding: '12px', color: '#e2e8f0', fontSize: '12px', fontFamily: 'monospace',
            resize: 'vertical', marginBottom: '12px',
          }}
        />

        <button
          onClick={handleParse}
          disabled={!rawText.trim()}
          title={!rawText.trim() ? 'Paste JSON or CSV data to parse' : undefined}
          style={{
            padding: '8px 20px', borderRadius: '6px', border: 'none',
            background: rawText.trim() ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
            color: rawText.trim() ? '#000' : 'var(--on-surface-muted)',
            cursor: rawText.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 700, marginBottom: '16px',
          }}
        >Preview</button>

        {/* Preview */}
        {preview && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: '8px' }}>
              Found {preview.stats.valid} valid assets ({preview.stats.skipped} skipped)
            </div>
            {preview.warnings.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                {preview.warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: '11px', color: '#f59e0b' }}>⚠ {w}</div>
                ))}
              </div>
            )}
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {preview.assets.slice(0, 20).map((asset: ImportedAsset, i: number) => (
                <div key={i} style={{ display: 'flex', gap: '8px', padding: '6px 10px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', fontSize: '12px' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{asset.name}</span>
                  <span style={{ color: 'var(--on-surface-muted)' }}>{asset.kind}</span>
                  {asset.description && <span style={{ color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.description}</span>}
                </div>
              ))}
              {preview.assets.length > 20 && (
                <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', padding: '4px' }}>
                  …and {preview.assets.length - 20} more
                </div>
              )}
            </div>
          </div>
        )}

        {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>{error}</div>}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--on-surface-muted)', cursor: 'pointer', fontSize: '12px' }}
          >Cancel</button>
          <button
            onClick={handleImport}
            disabled={!preview || preview.assets.length === 0 || importing}
            title={!preview || preview.assets.length === 0 ? 'No assets to import' : importing ? 'Importing assets...' : undefined}
            style={{
              padding: '8px 20px', borderRadius: '6px', border: 'none',
              background: (preview && preview.assets.length > 0 && !importing) ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
              color: (preview && preview.assets.length > 0 && !importing) ? '#000' : 'var(--on-surface-muted)',
              cursor: (preview && preview.assets.length > 0 && !importing) ? 'pointer' : 'not-allowed',
              fontSize: '12px', fontWeight: 700,
            }}
          >{importing ? 'Importing…' : 'Import'}</button>
        </div>
      </div>
    </div>
  );
}