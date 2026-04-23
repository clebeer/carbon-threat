import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listThreatModels,
  listArchivedThreatModels,
  createThreatModel,
  archiveThreatModel,
  restoreThreatModel,
  exportThreatModel,
  importThreatDragonModel,
  type ThreatModelSummary,
} from '../api/threatmodels';
import { listPacks, listTemplates, applyTemplate, type DomainPack, type DomainTemplate } from '../api/domainPacks';
import CloudStorageBrowser from '../components/CloudStorageBrowser';
import { convertGliffyToReactFlow, isGliffyDiagram } from '../importers/gliffyImporter';
import { convertVsdxToReactFlow, isVsdxFile } from '../importers/visioImporter';
import { convertDrawioToReactFlow, isDrawioFile } from '../importers/drawioImporter';

const PACK_ICONS: Record<string, string> = {
  generic: '⬡', aws: '🟧', azure: '🔷', iot: '◉', k8s: '⎈',
  network: '🌐', 'cloud-infra': '🏗', gcp: '🔵',
};

const btnBase: React.CSSProperties = {
  padding: '5px 12px', borderRadius: '5px', fontSize: '11px',
  fontFamily: 'var(--font-label)', letterSpacing: '0.4px',
  cursor: 'pointer', transition: 'all 0.15s', border: '1px solid transparent',
};

export default function ProjectsView({ onOpenModel }: { onOpenModel?: (id: string, title: string) => void }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gliffyInputRef = useRef<HTMLInputElement>(null);
  const visioInputRef = useRef<HTMLInputElement>(null);
  const drawioInputRef = useRef<HTMLInputElement>(null);

  const [importError, setImportError]       = useState<string | null>(null);
  const [importing, setImporting]           = useState(false);
  const [creating, setCreating]             = useState(false);
  const [newTitle, setNewTitle]             = useState('');
  const [formError, setFormError]           = useState<string | null>(null);
  const [showTemplates, setShowTemplates]   = useState(false);
  const [showCloud, setShowCloud]           = useState(false);
  const [selPack, setSelPack]               = useState<string>('generic');
  const [templates, setTemplates]           = useState<DomainTemplate[]>([]);
  const [tplLoading, setTplLoading]         = useState(false);
  const [tplTitle, setTplTitle]             = useState('');
  const [selectedTplId, setSelectedTplId]   = useState<string | null>(null);
  const [showArchived, setShowArchived]     = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<ThreatModelSummary | null>(null);
  const [exportingId, setExportingId]       = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<ThreatModelSummary[]>({
    queryKey: ['threatmodels'],
    queryFn: listThreatModels,
  });

  const { data: archivedData = [], isLoading: archivedLoading } = useQuery<ThreatModelSummary[]>({
    queryKey: ['threatmodels-archived'],
    queryFn: listArchivedThreatModels,
    enabled: showArchived,
  });

  const { data: packs = [] } = useQuery<DomainPack[]>({
    queryKey: ['domain-packs'],
    queryFn: listPacks,
    staleTime: Infinity,
  });

  const createMutation = useMutation({
    mutationFn: createThreatModel,
    onSuccess: (model) => {
      qc.invalidateQueries({ queryKey: ['threatmodels'] });
      setCreating(false);
      setNewTitle('');
      setFormError(null);
      onOpenModel?.(model.id, model.title);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveThreatModel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['threatmodels'] });
      qc.invalidateQueries({ queryKey: ['threatmodels-archived'] });
      setConfirmArchive(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreThreatModel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['threatmodels'] });
      qc.invalidateQueries({ queryKey: ['threatmodels-archived'] });
    },
  });

  async function handleExport(m: ThreatModelSummary) {
    setExportingId(m.id);
    try {
      await exportThreatModel(m.id, m.title);
    } finally {
      setExportingId(null);
    }
  }

  async function loadTemplates(slug: string) {
    setSelPack(slug);
    setTplLoading(true);
    setSelectedTplId(null);
    try {
      const tpls = await listTemplates(slug);
      setTemplates(tpls);
    } catch {
      setTemplates([]);
    } finally {
      setTplLoading(false);
    }
  }

  async function handleApplyTemplate() {
    if (!selectedTplId || !tplTitle.trim()) return;
    try {
      const model = await applyTemplate(selPack, selectedTplId, tplTitle.trim());
      qc.invalidateQueries({ queryKey: ['threatmodels'] });
      setShowTemplates(false);
      setTplTitle('');
      setSelectedTplId(null);
      onOpenModel?.(model.id, model.title);
    } catch {
      setFormError('Failed to apply template');
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError(null);
    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = await importThreatDragonModel(json);
      qc.invalidateQueries({ queryKey: ['threatmodels'] });
      onOpenModel?.(result.model.id, result.model.title);
    } catch (err: any) {
      setImportError(err?.response?.data?.error ?? err?.message ?? 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  async function handleGliffyImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError(null);
    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const { nodes, edges, stats, warnings } = convertGliffyToReactFlow(json);
      const title = file.name.replace(/\.[^.]+$/, '');
      const model = await createThreatModel({
        title,
        content: { nodes, edges } as unknown as Record<string, unknown>,
      });
      qc.invalidateQueries({ queryKey: ['threatmodels'] });
      onOpenModel?.(model.id, model.title);
      if (warnings.length > 0) console.warn('Gliffy import warnings:', warnings);
      if (stats.skipped > 0) console.info(`Gliffy: skipped ${stats.skipped} objects`);
    } catch (err: any) {
      setImportError(err?.message ?? 'Gliffy import failed');
    } finally {
      setImporting(false);
    }
  }

  async function handleVisioImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError(null);
    setImporting(true);
    try {
      const { nodes, edges, stats, warnings } = await convertVsdxToReactFlow(file);
      const title = file.name.replace(/\.[^.]+$/, '');
      const model = await createThreatModel({
        title,
        content: { nodes, edges } as unknown as Record<string, unknown>,
      });
      qc.invalidateQueries({ queryKey: ['threatmodels'] });
      onOpenModel?.(model.id, model.title);
      if (warnings.length > 0) console.warn('Visio import warnings:', warnings);
      if (stats.skipped > 0) console.info(`Visio: skipped ${stats.skipped} objects`);
    } catch (err: any) {
      setImportError(err?.message ?? 'Visio import failed');
    } finally {
      setImporting(false);
    }
  }

  async function handleDrawioImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError(null);
    setImporting(true);
    try {
      const text = await file.text();
      const { nodes, edges, stats, warnings } = convertDrawioToReactFlow(text);
      const title = file.name.replace(/\.[^.]+$/, '');
      const model = await createThreatModel({
        title,
        content: { nodes, edges } as unknown as Record<string, unknown>,
      });
      qc.invalidateQueries({ queryKey: ['threatmodels'] });
      onOpenModel?.(model.id, model.title);
      if (warnings.length > 0) console.warn('Draw.io import warnings:', warnings);
      if (stats.skipped > 0) console.info(`Draw.io: skipped ${stats.skipped} objects`);
    } catch (err: any) {
      setImportError(err?.message ?? 'Draw.io import failed');
    } finally {
      setImporting(false);
    }
  }

  function handleCreate() {
    if (!newTitle.trim()) { setFormError('Title is required'); return; }
    createMutation.mutate({ title: newTitle.trim() });
  }

  const models = data ?? [];

  return (
    <div style={{ padding: '32px', paddingTop: '96px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>

      {/* Archive confirmation dialog */}
      {confirmArchive && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)' }}>
          <div className="glass-panel" style={{ width: '400px', padding: '28px', borderRadius: '12px', border: '1px solid rgba(255,180,0,0.25)' }}>
            <p style={{ fontSize: '11px', color: 'rgba(255,180,0,0.8)', letterSpacing: '1px', margin: '0 0 6px 0', fontFamily: 'var(--font-label)' }}>ARCHIVE PROJECT</p>
            <p style={{ fontSize: '16px', color: '#fff', fontWeight: 600, margin: '0 0 8px 0' }}>{confirmArchive.title}</p>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-muted)', margin: '0 0 24px 0', lineHeight: 1.6 }}>
              This model will be moved to the archive. You can restore it at any time from the Archived section.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmArchive(null)}
                style={{ ...btnBase, background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: 'var(--on-surface-muted)', padding: '9px 18px' }}>
                Cancel
              </button>
              <button
                onClick={() => archiveMutation.mutate(confirmArchive.id)}
                disabled={archiveMutation.isPending}
                style={{ ...btnBase, background: 'rgba(255,180,0,0.15)', borderColor: 'rgba(255,180,0,0.4)', color: 'rgba(255,200,50,0.9)', padding: '9px 18px' }}>
                {archiveMutation.isPending ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '28px', marginBottom: '8px', color: '#fff' }}>Threat Models</h1>
          <p className="label-text" style={{ color: 'var(--on-surface-muted)', margin: 0 }}>Manage and create your architectural threat models.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportFile} />
          <input ref={gliffyInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleGliffyImport} />
          <input ref={visioInputRef} type="file" accept=".vsdx,application/vnd.ms-visio.drawing" style={{ display: 'none' }} onChange={handleVisioImport} />
          <input ref={drawioInputRef} type="file" accept=".drawio,.xml" style={{ display: 'none' }} onChange={handleDrawioImport} />
          <button
            onClick={() => { setImportError(null); fileInputRef.current?.click(); }}
            disabled={importing}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--on-surface-muted)', padding: '9px 16px', borderRadius: '6px', cursor: importing ? 'not-allowed' : 'pointer', fontSize: '12px', fontFamily: 'var(--font-label)', letterSpacing: '0.5px' }}
          >
            {importing ? '↻ Importing…' : '↑ Import TD'}
          </button>
          <button
            onClick={() => { setImportError(null); gliffyInputRef.current?.click(); }}
            disabled={importing}
            title="Import Gliffy diagram (.json)"
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--on-surface-muted)', padding: '9px 16px', borderRadius: '6px', cursor: importing ? 'not-allowed' : 'pointer', fontSize: '12px', fontFamily: 'var(--font-label)', letterSpacing: '0.5px' }}
          >
            {importing ? '↻ …' : '◇ Gliffy'}
          </button>
          <button
            onClick={() => { setImportError(null); visioInputRef.current?.click(); }}
            disabled={importing}
            title="Import Visio diagram (.vsdx)"
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--on-surface-muted)', padding: '9px 16px', borderRadius: '6px', cursor: importing ? 'not-allowed' : 'pointer', fontSize: '12px', fontFamily: 'var(--font-label)', letterSpacing: '0.5px' }}
          >
            {importing ? '↻ …' : '⊞ Visio'}
          </button>
          <button
            onClick={() => { setImportError(null); drawioInputRef.current?.click(); }}
            disabled={importing}
            title="Import Draw.io diagram (.drawio)"
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--on-surface-muted)', padding: '9px 16px', borderRadius: '6px', cursor: importing ? 'not-allowed' : 'pointer', fontSize: '12px', fontFamily: 'var(--font-label)', letterSpacing: '0.5px' }}
          >
            {importing ? '↻ …' : '✎ Draw.io'}
          </button>
          <button
            onClick={() => setShowCloud(true)}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--on-surface-muted)', padding: '9px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-label)', letterSpacing: '0.5px' }}
          >
            ☁ Cloud Storage
          </button>
          <button
            onClick={() => { setShowTemplates(true); loadTemplates(selPack || 'generic'); }}
            style={{ background: 'transparent', border: '1px solid rgba(179,102,255,0.4)', color: 'var(--secondary)', padding: '9px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-label)', letterSpacing: '0.5px' }}
          >
            ⬡ From Template
          </button>
          <button
            onClick={() => { setCreating(true); setFormError(null); }}
            style={{ background: 'var(--primary)', border: 'none', color: '#000', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'var(--font-label)', fontSize: '13px' }}
          >
            + New Model
          </button>
        </div>
      </div>

      {/* Import error banner */}
      {importError && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,77,79,0.08)', border: '1px solid var(--error)', borderRadius: '8px', color: 'var(--error)', fontSize: '13px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Import failed: {importError}</span>
          <button onClick={() => setImportError(null)} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
      )}

      {/* New model form */}
      {creating && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--on-surface-muted)', fontFamily: 'var(--font-label)', letterSpacing: '0.5px' }}>NEW THREAT MODEL</p>
          <input
            type="text" value={newTitle}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)}
            placeholder="Model title…"
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleCreate()}
            autoFocus
            style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '14px', outline: 'none' }}
          />
          {formError && <span style={{ fontSize: '12px', color: 'var(--error)' }}>{formError}</span>}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => { setCreating(false); setNewTitle(''); setFormError(null); }}
              style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--on-surface-muted)', borderRadius: '4px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={createMutation.isPending}
              style={{ padding: '8px 16px', background: 'var(--primary)', border: 'none', color: '#000', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}>
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Template picker modal */}
      {showTemplates && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
          <div className="glass-panel" style={{ width: '540px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--secondary)', letterSpacing: '1px' }}>DOMAIN TEMPLATES</div>
                <div style={{ fontSize: '16px', color: '#fff', fontWeight: 600, marginTop: '2px' }}>New Model from Template</div>
              </div>
              <button onClick={() => setShowTemplates(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--on-surface-muted)', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>×</button>
            </div>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '8px', flexShrink: 0, overflowX: 'auto' }}>
              {packs.map(p => (
                <button key={p.slug} onClick={() => loadTemplates(p.slug)}
                  style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${selPack === p.slug ? 'var(--secondary)' : 'rgba(255,255,255,0.1)'}`, background: selPack === p.slug ? 'rgba(179,102,255,0.12)' : 'transparent', color: selPack === p.slug ? 'var(--secondary)' : 'var(--on-surface-muted)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {PACK_ICONS[p.slug] ?? '⬡'} {p.name}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tplLoading && <p style={{ color: 'var(--on-surface-muted)', fontSize: '12px', margin: 0 }}>Loading…</p>}
              {!tplLoading && templates.length === 0 && <p style={{ color: 'var(--on-surface-muted)', fontSize: '12px', margin: 0 }}>No templates for this pack.</p>}
              {templates.map(t => (
                <div key={t.id} onClick={() => { setSelectedTplId(t.id); setTplTitle(t.name); }}
                  style={{ padding: '14px 16px', borderRadius: '8px', background: selectedTplId === t.id ? 'rgba(179,102,255,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedTplId === t.id ? 'rgba(179,102,255,0.4)' : 'rgba(255,255,255,0.07)'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: '14px', color: '#e2e8f0', fontWeight: 500 }}>{t.name}</div>
                  {t.description && <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', marginTop: '4px' }}>{t.description}</div>}
                  <div style={{ fontSize: '10px', color: 'var(--on-surface-muted)', marginTop: '6px' }}>
                    {(t.diagram_json as any)?.nodes?.length ?? 0} nodes · {(t.diagram_json as any)?.edges?.length ?? 0} edges
                  </div>
                </div>
              ))}
            </div>
            {selectedTplId && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '8px', flexShrink: 0 }}>
                <input type="text" value={tplTitle} onChange={e => setTplTitle(e.target.value)} placeholder="Model name…"
                  style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
                <button onClick={handleApplyTemplate} disabled={!tplTitle.trim()}
                  style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: tplTitle.trim() ? 'var(--secondary)' : 'rgba(255,255,255,0.1)', color: tplTitle.trim() ? '#000' : 'var(--on-surface-muted)', fontWeight: 700, fontSize: '13px', cursor: tplTitle.trim() ? 'pointer' : 'not-allowed' }}>
                  Create →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cloud Storage Browser modal */}
      {showCloud && (
        <CloudStorageBrowser
          onClose={() => setShowCloud(false)}
          onImported={(id, title) => {
            setShowCloud(false);
            qc.invalidateQueries({ queryKey: ['threatmodels'] });
            onOpenModel?.(id, title);
          }}
        />
      )}

      {/* Active models */}
      {isLoading && <p style={{ color: 'var(--on-surface-muted)', fontSize: '14px' }}>Loading models…</p>}
      {isError && (
        <div style={{ padding: '16px', background: 'rgba(255,77,79,0.08)', border: '1px solid var(--error)', borderRadius: '8px', color: 'var(--error)', fontSize: '13px' }}>
          Failed to load threat models.
        </div>
      )}
      {!isLoading && !isError && models.length === 0 && (
        <div style={{ padding: '48px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
          <p style={{ color: 'var(--on-surface-muted)', fontSize: '14px', margin: 0 }}>No threat models yet. Create the first one.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        {models.map((m: ThreatModelSummary) => (
          <div key={m.id} className="glass-panel" style={{ padding: '22px', transition: 'all 0.2s', borderTop: '2px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="label-text" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--primary)' }}>
                v{m.version}
              </span>
              <span className="tech-text" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                {new Date(m.updated_at).toLocaleDateString()}
              </span>
            </div>
            <h3 style={{ fontSize: '17px', margin: '0 0 10px 0', color: '#fff', fontWeight: 600 }}>{m.title}</h3>
            {m.description && (
              <p style={{ fontSize: '13px', color: 'var(--on-surface-muted)', margin: '0 0 12px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.description}
              </p>
            )}
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: m.description ? 0 : '12px', flexWrap: 'wrap' }}>
              {/* Remote — export to JSON file */}
              <button
                onClick={() => handleExport(m)}
                disabled={exportingId === m.id}
                title="Export JSON (Remote)"
                style={{ ...btnBase, background: 'transparent', borderColor: 'rgba(255,255,255,0.12)', color: 'var(--on-surface-muted)', padding: '5px 10px' }}
              >
                {exportingId === m.id ? '…' : '↓ Remote'}
              </button>
              {/* Archive */}
              <button
                onClick={() => setConfirmArchive(m)}
                title="Archive this model"
                style={{ ...btnBase, background: 'transparent', borderColor: 'rgba(255,180,0,0.25)', color: 'rgba(255,200,80,0.7)', padding: '5px 10px' }}
              >
                Archive
              </button>
              {/* Edit → Modeling */}
              <button
                onClick={() => onOpenModel?.(m.id, m.title)}
                style={{ ...btnBase, background: 'var(--primary)', borderColor: 'transparent', color: '#000', fontWeight: 'bold', padding: '6px 14px' }}
              >
                Edit →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Archived section toggle */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '24px' }}>
        <button
          onClick={() => setShowArchived(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: 'var(--on-surface-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-label)', letterSpacing: '0.5px', padding: 0, marginBottom: showArchived ? '20px' : 0 }}
        >
          <span style={{ display: 'inline-block', transform: showArchived ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontSize: '10px' }}>▶</span>
          Archived models
          {archivedData.length > 0 && (
            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: 'rgba(255,255,255,0.07)', color: 'var(--on-surface-muted)' }}>
              {archivedData.length}
            </span>
          )}
        </button>

        {showArchived && (
          <>
            {archivedLoading && <p style={{ color: 'var(--on-surface-muted)', fontSize: '13px' }}>Loading archived…</p>}
            {!archivedLoading && archivedData.length === 0 && (
              <p style={{ color: 'var(--on-surface-muted)', fontSize: '13px', margin: 0 }}>No archived models.</p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {archivedData.map((m: ThreatModelSummary) => (
                <div key={m.id} className="glass-panel" style={{ padding: '20px', opacity: 0.75, borderTop: '2px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span className="label-text" style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--on-surface-muted)' }}>
                      Archived · v{m.version}
                    </span>
                    <span className="tech-text" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
                      {new Date(m.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '16px', margin: '0 0 8px 0', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{m.title}</h3>
                  {m.description && (
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', margin: '0 0 10px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: m.description ? 0 : '10px' }}>
                    <button
                      onClick={() => handleExport(m)}
                      disabled={exportingId === m.id}
                      title="Export JSON"
                      style={{ ...btnBase, background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: 'var(--on-surface-muted)', padding: '5px 10px' }}
                    >
                      {exportingId === m.id ? '…' : '↓ Remote'}
                    </button>
                    <button
                      onClick={() => restoreMutation.mutate(m.id)}
                      disabled={restoreMutation.isPending && restoreMutation.variables === m.id}
                      style={{ ...btnBase, background: 'rgba(0,242,255,0.08)', borderColor: 'rgba(0,242,255,0.2)', color: 'var(--primary)', padding: '5px 12px' }}
                    >
                      {restoreMutation.isPending && restoreMutation.variables === m.id ? 'Restoring…' : '↩ Restore'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
