import React, { useState, useCallback, useRef } from 'react';
import { parseAssetJSON, parseAssetCSV, type ImportedAsset, type ImportAssetsResult } from '../importers/assetListImporter';
import { importAssets } from '../api/assets';
import Modal from './ui/Modal';
import Button from './ui/Button';

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

  return (
    <Modal open={open} onClose={onClose} title="Import Assets" style={{ width: 600, maxHeight: '80vh', overflowY: 'auto' }}>
      <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        {/* File upload drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: '2px dashed rgba(255,255,255,0.15)', borderRadius: 'var(--radius-md)',
            padding: 'var(--space-6)', textAlign: 'center', cursor: 'pointer',
            marginBottom: 'var(--space-4)', color: 'var(--on-surface-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Drop a JSON/CSV file here or click to browse
          <input ref={fileRef} type="file" accept=".json,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
        </div>

        {/* Format toggle */}
        <div role="radiogroup" aria-label="Import format" style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          {(['json', 'csv'] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              role="radio"
              aria-checked={format === fmt}
              onClick={() => setFormat(fmt)}
              style={{
                padding: '6px 16px', borderRadius: 'var(--radius-md)', border: '1px solid',
                borderColor: format === fmt ? 'var(--primary)' : 'var(--border-medium)',
                background: format === fmt ? 'rgba(0,242,255,0.1)' : 'transparent',
                color: format === fmt ? 'var(--primary)' : 'var(--on-surface-muted)',
                cursor: 'pointer', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-label)',
                letterSpacing: '0.5px', textTransform: 'uppercase',
              }}
            >
              {fmt}
            </button>
          ))}
        </div>

        {/* Text area */}
        <textarea
          aria-label="Asset data"
          value={rawText}
          onChange={(e) => { setRawText(e.target.value); setPreview(null); setError(''); }}
          placeholder={format === 'json'
            ? '[{"name": "Web Server", "kind": "server", "description": "..."}]'
            : 'name,kind,description\nWeb Server,server,Main web server'}
          style={{
            width: '100%', height: '120px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)', color: 'var(--on-surface)', fontSize: 'var(--text-xs)',
            fontFamily: 'monospace', resize: 'vertical', marginBottom: 'var(--space-3)',
            boxSizing: 'border-box',
          }}
        />

        <Button
          variant="secondary"
          size="sm"
          disabled={!rawText.trim()}
          title={!rawText.trim() ? "Enter asset data to preview" : undefined}
          onClick={handleParse}
          style={{ marginBottom: 'var(--space-4)' }}
        >
          Preview
        </Button>

        {/* Preview */}
        {preview && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--on-surface-muted)', marginBottom: 'var(--space-2)' }}>
              Found {preview.stats.valid} valid assets ({preview.stats.skipped} skipped)
            </div>
            {preview.warnings.length > 0 && (
              <div style={{ marginBottom: 'var(--space-2)' }}>
                {preview.warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 'var(--text-xs)', color: 'var(--warning)' }}>⚠ {w}</div>
                ))}
              </div>
            )}
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {preview.assets.slice(0, 20).map((asset: ImportedAsset, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.03)', fontSize: 'var(--text-xs)' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 'var(--weight-semibold)' as unknown as number }}>{asset.name}</span>
                  <span style={{ color: 'var(--on-surface-muted)' }}>{asset.kind}</span>
                  {asset.description && (
                    <span style={{ color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {asset.description}
                    </span>
                  )}
                </div>
              ))}
              {preview.assets.length > 20 && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--on-surface-muted)', padding: 4 }}>
                  …and {preview.assets.length - 20} more
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" style={{ color: 'var(--error)', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-3)' }}>
            {error}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={importing}
            disabled={!preview || preview.assets.length === 0}
            title={(!preview || preview.assets.length === 0) ? "Preview valid assets before importing" : undefined}
            onClick={handleImport}
          >
            Import
          </Button>
        </div>
      </div>
    </Modal>
  );
}
