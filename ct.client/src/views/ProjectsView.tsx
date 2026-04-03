import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listThreatModels, createThreatModel, importThreatDragonModel, type ThreatModelSummary } from '../api/threatmodels';
import { listPacks, listTemplates, applyTemplate, type DomainPack, type DomainTemplate } from '../api/domainPacks';
import CloudStorageBrowser from '../components/CloudStorageBrowser';

const PACK_ICONS: Record<string, string> = {
  generic: '⬡', aws: '☁', azure: '△', iot: '◉', k8s: '⎈',
};

export default function ProjectsView({ onOpenModel }: { onOpenModel?: (id: string, title: string) => void }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError]     = useState<string | null>(null);
  const [importing, setImporting]         = useState(false);
  const [creating, setCreating]           = useState(false);
  const [newTitle, setNewTitle]           = useState('');
  const [formError, setFormError]         = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCloud, setShowCloud]         = useState(false);
  const [selPack, setSelPack]             = useState<string>('generic');
  const [templates, setTemplates]         = useState<DomainTemplate[]>([]);
  const [tplLoading, setTplLoading]       = useState(false);
  const [tplTitle, setTplTitle]           = useState('');
  const [selectedTplId, setSelectedTplId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<ThreatModelSummary[]>({
    queryKey: ['threatmodels'],
    queryFn: listThreatModels,
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
    // Reset input so same file can be re-selected
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

  function handleCreate() {
    if (!newTitle.trim()) { setFormError('Title is required'); return; }
    createMutation.mutate({ title: newTitle.trim() });
  }

  const models = data ?? [];

  return (
    <div style={{ padding: '32px', paddingTop: '96px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '28px', marginBottom: '8px', color: '#fff' }}>Threat Models</h1>
          <p className="label-text" style={{ color: 'var(--on-surface-muted)', margin: 0 }}>Manage and create your architectural threat models.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Hidden file input for TD JSON import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button
            onClick={() => { setImportError(null); fileInputRef.current?.click(); }}
            disabled={importing}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--on-surface-muted)', padding: '9px 16px', borderRadius: '6px', cursor: importing ? 'not-allowed' : 'pointer', fontSize: '12px', fontFamily: 'var(--font-label)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {importing ? '↻ Importing…' : '↑ Import TD'}
          </button>
          <button
            onClick={() => setShowCloud(true)}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--on-surface-muted)', padding: '9px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-label)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
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
          <button onClick={() => setImportError(null)} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>×</button>
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

            {/* Pack selector */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '8px', flexShrink: 0, overflowX: 'auto' }}>
              {packs.map(p => (
                <button
                  key={p.slug}
                  onClick={() => loadTemplates(p.slug)}
                  style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${selPack === p.slug ? 'var(--secondary)' : 'rgba(255,255,255,0.1)'}`, background: selPack === p.slug ? 'rgba(179,102,255,0.12)' : 'transparent', color: selPack === p.slug ? 'var(--secondary)' : 'var(--on-surface-muted)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  {PACK_ICONS[p.slug] ?? '⬡'} {p.name}
                </button>
              ))}
            </div>

            {/* Template list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tplLoading && <p style={{ color: 'var(--on-surface-muted)', fontSize: '12px', margin: 0 }}>Loading…</p>}
              {!tplLoading && templates.length === 0 && (
                <p style={{ color: 'var(--on-surface-muted)', fontSize: '12px', margin: 0 }}>No templates for this pack.</p>
              )}
              {templates.map(t => (
                <div
                  key={t.id}
                  onClick={() => { setSelectedTplId(t.id); setTplTitle(t.name); }}
                  style={{ padding: '14px 16px', borderRadius: '8px', background: selectedTplId === t.id ? 'rgba(179,102,255,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedTplId === t.id ? 'rgba(179,102,255,0.4)' : 'rgba(255,255,255,0.07)'}`, cursor: 'pointer', transition: 'all 0.15s' }}
                >
                  <div style={{ fontSize: '14px', color: '#e2e8f0', fontWeight: 500 }}>{t.name}</div>
                  {t.description && <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', marginTop: '4px' }}>{t.description}</div>}
                  <div style={{ fontSize: '10px', color: 'var(--on-surface-muted)', marginTop: '6px' }}>
                    {(t.diagram_json as any)?.nodes?.length ?? 0} nodes · {(t.diagram_json as any)?.edges?.length ?? 0} edges
                  </div>
                </div>
              ))}
            </div>

            {/* Title + Apply */}
            {selectedTplId && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '8px', flexShrink: 0 }}>
                <input
                  type="text" value={tplTitle}
                  onChange={e => setTplTitle(e.target.value)}
                  placeholder="Model name…"
                  style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                />
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

      {/* Model list */}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {models.map((m: ThreatModelSummary) => (
          <div
            key={m.id}
            className="glass-panel"
            style={{ padding: '22px', transition: 'all 0.2s', borderTop: `2px solid ${m.is_archived ? 'rgba(255,255,255,0.1)' : 'var(--primary)'}` }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="label-text" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', color: m.is_archived ? 'var(--on-surface-muted)' : 'var(--primary)' }}>
                {m.is_archived ? 'Archived' : `v${m.version}`}
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
            {!m.is_archived && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: m.description ? 0 : '12px' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenModel && onOpenModel(m.id, m.title); }}
                  style={{ padding: '6px 16px', background: 'var(--primary)', border: 'none', color: '#000', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-label)', letterSpacing: '0.5px' }}
                >
                  Edit →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
