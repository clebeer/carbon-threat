import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getThreatModel, updateThreatModel } from '../../api/threatmodels';
import { suggestThreats, type ThreatSuggestion } from '../../api/ai';
import { useQuery } from '@tanstack/react-query';
import { listPacks, type DomainPack } from '../../api/domainPacks';
import { useAnalysisStore } from '../../store/analysisStore';
import ThreatPanel from './ThreatPanel';
import DomainSelector from './DomainSelector';

// ── Default node icons (generic pack fallback) ────────────────────────────────

const DefaultIcons: Record<string, React.ReactNode> = {
  db:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  server:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/></svg>,
  fw:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  user:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M20 21v-2a7 7 0 0 0-14 0v2"/></svg>,
  api:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 2l-4 5-4-5"/><line x1="12" y1="12" x2="12" y2="17"/></svg>,
  cloud:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>,
  browser: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="8" y1="3" x2="8" y2="9"/></svg>,
};

const DEFAULT_KIND_LABEL: Record<string, string> = {
  db: 'Database', server: 'Server', fw: 'Firewall', user: 'User / Actor',
  api: 'API Gateway', cloud: 'Cloud Service', browser: 'Web Client',
};

const DEFAULT_STENCIL: { kind: string; label: string }[] = [
  { kind: 'server', label: 'Server' },
  { kind: 'db',     label: 'Database' },
  { kind: 'fw',     label: 'Firewall' },
  { kind: 'user',   label: 'Actor' },
  { kind: 'api',    label: 'API' },
  { kind: 'cloud',  label: 'Cloud' },
  { kind: 'browser',label: 'Client' },
];

// ── Domain icon renderer ──────────────────────────────────────────────────────

function DomainIcon({ kind, pack }: { kind: string; pack?: DomainPack | null }) {
  const iconDef = pack?.icon_manifest?.nodeTypes?.[kind];
  if (iconDef) {
    return (
      <svg width="20" height="20" viewBox={iconDef.viewBox ?? '0 0 24 24'} fill="none" stroke={iconDef.color ?? 'currentColor'} strokeWidth="1.5">
        <path d={iconDef.svgPath} />
      </svg>
    );
  }
  return <>{DefaultIcons[kind] ?? DefaultIcons.server}</>;
}

// ── CyberNode ─────────────────────────────────────────────────────────────────

interface CyberNodeData {
  label: string;
  kind: string;
  selected?: boolean;
  highlighted?: boolean;
  packSlug?: string;
}

// Pack is passed via a ref to avoid re-creating nodeTypes on each render
let _activePack: DomainPack | null = null;

const CyberNode = ({ data, id }: NodeProps<CyberNodeData>) => {
  const highlightedNodeIds = useAnalysisStore(s => s.highlightedNodeIds);
  const isHighlighted = highlightedNodeIds.has(id);

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      <div
        className="ct-node"
        style={{
          borderColor: isHighlighted ? 'var(--error)' : data.selected ? 'var(--secondary)' : undefined,
          boxShadow: isHighlighted
            ? '0 0 20px rgba(255,77,79,0.6), 0 0 40px rgba(255,77,79,0.3)'
            : data.selected ? '0 0 18px var(--secondary)' : undefined,
          transition: 'box-shadow 0.2s, border-color 0.2s',
        }}
      >
        <DomainIcon kind={data.kind} pack={_activePack} />
      </div>
      <div className="ct-node-label">{data.label}</div>
      <Handle type="target" position={Position.Top}    style={{ background: 'var(--primary)', width: 8, height: 8, border: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--primary)', width: 8, height: 8, border: 'none' }} />
      <Handle type="source" position={Position.Right}  style={{ background: 'var(--primary)', width: 8, height: 8, border: 'none' }} id="r" />
      <Handle type="target" position={Position.Left}   style={{ background: 'var(--primary)', width: 8, height: 8, border: 'none' }} id="l" />
    </div>
  );
};

const nodeTypes = { cyber: CyberNode };

// ── Initial diagram ───────────────────────────────────────────────────────────

const INIT_NODES: Node<CyberNodeData>[] = [
  { id: '1', type: 'cyber', position: { x: 300, y: 150 }, data: { label: 'Web Server', kind: 'server' } },
  { id: '2', type: 'cyber', position: { x: 100, y: 320 }, data: { label: 'Database',   kind: 'db' } },
  { id: '3', type: 'cyber', position: { x: 500, y: 320 }, data: { label: 'Firewall',   kind: 'fw' } },
];

const INIT_EDGES: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'smoothstep', animated: true,  style: { stroke: 'var(--primary)',   strokeWidth: 2 } },
  { id: 'e1-3', source: '1', target: '3', type: 'smoothstep', animated: false, style: { stroke: 'var(--secondary)', strokeWidth: 2 } },
];

// ── Severity badge ────────────────────────────────────────────────────────────

const SEV_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  High:   { bg: 'rgba(255,77,79,0.12)',  text: 'var(--error)',   border: 'rgba(255,77,79,0.3)' },
  Medium: { bg: 'rgba(250,173,20,0.12)', text: '#faad14',        border: 'rgba(250,173,20,0.3)' },
  Low:    { bg: 'rgba(0,242,255,0.08)',  text: 'var(--primary)', border: 'rgba(0,242,255,0.2)' },
};

function SeverityBadge({ severity }: { severity: string }) {
  const c = SEV_COLORS[severity] ?? SEV_COLORS.Medium;
  return (
    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontWeight: 600, letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
      {severity.toUpperCase()}
    </span>
  );
}

// ── AI Suggestions panel ──────────────────────────────────────────────────────

interface AIPanelProps {
  node: Node<CyberNodeData>;
  onClose: () => void;
  onAccept: (threat: ThreatSuggestion) => void;
}

function AISuggestionsPanel({ node, onClose, onAccept }: AIPanelProps) {
  const [loading, setSuggLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ThreatSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  const kindLabel = DEFAULT_KIND_LABEL[node.data.kind] ?? node.data.kind;

  async function handleAnalyse() {
    setSuggLoading(true);
    setError(null);
    setSuggestions([]);
    setAccepted(new Set());
    setRejected(new Set());
    try {
      const result = await suggestThreats(node.id, node.data.label, node.data.kind);
      setSuggestions(result.suggestions);
    } catch {
      setError('AI service unavailable. Configure a provider in Settings → Integrations.');
    } finally {
      setSuggLoading(false);
    }
  }

  return (
    <div className="glass-panel" style={{ position: 'absolute', top: 0, right: 0, width: '320px', height: '100%', zIndex: 50, display: 'flex', flexDirection: 'column', borderRadius: 0, borderTop: 'none', borderRight: 'none', borderBottom: 'none', borderLeft: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto' }}>
      <div style={{ padding: '18px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--secondary)', marginBottom: '4px' }}>AI THREAT ANALYSIS</div>
          <div style={{ fontSize: '15px', color: '#fff', fontFamily: 'var(--font-tech)' }}>{node.data.label}</div>
          <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', marginTop: '2px' }}>{kindLabel} component</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--on-surface-muted)', width: '24px', height: '24px', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 }}>×</button>
      </div>
      <div style={{ padding: '14px 18px', flexShrink: 0 }}>
        <button onClick={handleAnalyse} disabled={loading} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(179,102,255,0.3)', background: loading ? 'rgba(179,102,255,0.3)' : 'rgba(179,102,255,0.12)', color: 'var(--secondary)', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.5px' }}>
          {loading ? '⟳  Analysing…' : '✦  Run STRIDE Analysis'}
        </button>
      </div>
      {error && (
        <div style={{ margin: '0 18px 14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,77,79,0.08)', border: '1px solid rgba(255,77,79,0.2)', fontSize: '12px', color: 'var(--error)' }}>
          {error}
        </div>
      )}
      {suggestions.length === 0 && !loading && !error && (
        <div style={{ padding: '0 18px', fontSize: '12px', color: 'var(--on-surface-muted)', lineHeight: 1.6 }}>
          Click "Run STRIDE Analysis" to get AI-generated threat suggestions for this component.
        </div>
      )}
      <div style={{ flex: 1, padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {suggestions.map((t: ThreatSuggestion, idx: number) => {
          const isAcc = accepted.has(idx);
          const isRej = rejected.has(idx);
          return (
            <div key={idx} style={{ padding: '12px', borderRadius: '8px', background: isAcc ? 'rgba(0,242,255,0.06)' : isRej ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isAcc ? 'rgba(0,242,255,0.2)' : isRej ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.08)'}`, opacity: isRej ? 0.4 : 1, transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '5px' }}>
                <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>{t.title}</span>
                <SeverityBadge severity={t.severity} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--secondary)', marginBottom: '5px' }}>{t.strideCategory}</div>
              {t.mitigation && <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', lineHeight: 1.5, marginBottom: '8px' }}>{t.mitigation}</div>}
              {!isAcc && !isRej && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => { setAccepted((s: Set<number>) => new Set(s).add(idx)); onAccept(t); }} style={{ flex: 1, padding: '4px', borderRadius: '4px', border: '1px solid rgba(0,242,255,0.3)', background: 'transparent', color: 'var(--primary)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>Accept</button>
                  <button onClick={() => setRejected((s: Set<number>) => new Set(s).add(idx))} style={{ flex: 1, padding: '4px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--on-surface-muted)', fontSize: '11px', cursor: 'pointer' }}>Dismiss</button>
                </div>
              )}
              {isAcc && <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>✓ Added to model</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Node stencil ──────────────────────────────────────────────────────────────

function NodeStencil({ onAdd, pack }: { onAdd: (kind: string) => void; pack?: DomainPack | null }) {
  const stencilItems = pack?.icon_manifest?.nodeTypes
    ? Object.entries(pack.icon_manifest.nodeTypes).map(([kind, def]) => ({ kind, label: def.label }))
    : DEFAULT_STENCIL;

  return (
    <div className="glass-panel" style={{ width: '72px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 6px', gap: '6px', borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderLeft: 'none', borderRight: '1px solid rgba(255,255,255,0.06)', zIndex: 20, overflowY: 'auto' }}>
      <div style={{ fontSize: '9px', letterSpacing: '1px', color: 'var(--on-surface-muted)', marginBottom: '6px', textTransform: 'uppercase', textAlign: 'center' }}>ADD</div>
      {stencilItems.map(({ kind, label }) => (
        <button
          key={kind}
          title={`Add ${label}`}
          onClick={() => onAdd(kind)}
          style={{ width: '56px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '8px 4px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'var(--on-surface-muted)', cursor: 'pointer', transition: 'all 0.15s', fontSize: '10px' }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.borderColor = 'rgba(0,242,255,0.4)'; e.currentTarget.style.color = 'var(--primary)'; }}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--on-surface-muted)'; }}
        >
          <DomainIcon kind={kind} pack={pack} />
          <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Rename modal ──────────────────────────────────────────────────────────────

function RenameModal({ current, onConfirm, onCancel }: { current: string; onConfirm: (n: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(current);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
      <div className="glass-panel" style={{ padding: '24px', width: '320px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--on-surface-muted)', fontFamily: 'var(--font-label)', letterSpacing: '0.5px' }}>RENAME NODE</p>
        <input
          autoFocus
          type="text"
          value={val}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') onConfirm(val); if (e.key === 'Escape') onCancel(); }}
          style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '14px', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--on-surface-muted)', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onConfirm(val)} style={{ flex: 1, padding: '8px', background: 'var(--primary)', border: 'none', color: '#000', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}>Rename</button>
        </div>
      </div>
    </div>
  );
}

// ── Main canvas ───────────────────────────────────────────────────────────────

let nodeCounter = INIT_NODES.length;

export default function ThreatFlow({ modelId, modelTitle }: { modelId?: string | null; modelTitle?: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CyberNodeData>(INIT_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INIT_EDGES);
  const [selectedNode, setSelectedNode] = useState<Node<CyberNodeData> | null>(null);
  const [acceptedThreats, setAcceptedThreats] = useState<ThreatSuggestion[]>([]);
  const [renaming, setRenaming] = useState<Node<CyberNodeData> | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showThreatPanel, setShowThreatPanel] = useState(false);
  const [activePack, setActivePack] = useState<string>(() => {
    if (modelId) return localStorage.getItem(`ct_pack_${modelId}`) ?? 'generic';
    return 'generic';
  });
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { highlightedEdgeIds, clearHighlight, setHighlight, setNodeFilter, selectedNodeId } = useAnalysisStore();

  // Load active domain pack
  const { data: packs = [] } = useQuery<DomainPack[]>({
    queryKey: ['domain-packs'],
    queryFn: async () => {
      const { listPacks } = await import('../../api/domainPacks');
      return listPacks();
    },
    staleTime: Infinity,
  });

  const currentPack = packs.find(p => p.slug === activePack) ?? null;
  // Sync to module-level ref for nodeTypes (avoid re-creating nodeTypes)
  _activePack = currentPack;

  function handlePackChange(slug: string) {
    setActivePack(slug);
    if (modelId) localStorage.setItem(`ct_pack_${modelId}`, slug);
  }

  // Load model content
  useEffect(() => {
    if (!modelId) return;
    setActivePack(localStorage.getItem(`ct_pack_${modelId}`) ?? 'generic');
    getThreatModel(modelId).then(({ content }) => {
      const loadedNodes = (content as any)?.nodes;
      const loadedEdges = (content as any)?.edges;
      if (Array.isArray(loadedNodes) && loadedNodes.length > 0) {
        setNodes(loadedNodes);
        setEdges(Array.isArray(loadedEdges) ? loadedEdges : []);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  // Apply edge highlights from analysis store
  const displayEdges = edges.map(e => ({
    ...e,
    style: {
      ...e.style,
      stroke: highlightedEdgeIds.has(e.id) ? 'rgba(255,77,79,0.9)' : e.style?.stroke,
      strokeWidth: highlightedEdgeIds.has(e.id) ? 3 : (e.style?.strokeWidth ?? 2),
    },
    animated: highlightedEdgeIds.has(e.id) ? true : e.animated,
  }));

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds: Edge[]) => addEdge({ ...params, type: 'smoothstep', animated: true, style: { stroke: 'var(--primary)', strokeWidth: 2 } }, eds));
  }, [setEdges]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node<CyberNodeData>) => {
    if (showThreatPanel) {
      // F2: when threat panel is open, clicking a node filters threats by that node
      if (selectedNodeId === node.id) {
        clearHighlight();
      } else {
        setNodeFilter(node.id, node.data.label);
        setHighlight([node.id], []);
      }
      return;
    }
    // Normal mode: open AI analysis panel
    clearHighlight();
    setSelectedNode((prev: Node<CyberNodeData> | null) => prev?.id === node.id ? null : node);
    setNodes((ns: Node<CyberNodeData>[]) => ns.map((n: Node<CyberNodeData>) => ({ ...n, data: { ...n.data, selected: n.id === node.id } })));
  }, [showThreatPanel, selectedNodeId, setNodes, clearHighlight, setNodeFilter, setHighlight]);

  const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node<CyberNodeData>) => {
    setRenaming(node);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setNodes((ns: Node<CyberNodeData>[]) => ns.map((n: Node<CyberNodeData>) => ({ ...n, data: { ...n.data, selected: false } })));
  }, [setNodes]);

  const addNode = useCallback((kind: string) => {
    nodeCounter += 1;
    const id = String(nodeCounter);
    const offset = (nodeCounter % 5) * 40;
    const label = currentPack?.icon_manifest?.nodeTypes?.[kind]?.label ?? DEFAULT_KIND_LABEL[kind] ?? kind;
    const newNode: Node<CyberNodeData> = {
      id,
      type: 'cyber',
      position: { x: 280 + offset, y: 220 + offset },
      data: { label, kind, selected: false },
    };
    setNodes((ns: Node<CyberNodeData>[]) => [...ns, newNode]);
  }, [setNodes, currentPack]);

  const handleNodesDelete = useCallback((deleted: Node<CyberNodeData>[]) => {
    if (selectedNode && deleted.some((d: Node<CyberNodeData>) => d.id === selectedNode.id)) {
      setSelectedNode(null);
    }
  }, [selectedNode]);

  const handleRenameConfirm = useCallback((name: string) => {
    if (!renaming || !name.trim()) { setRenaming(null); return; }
    setNodes((ns: Node<CyberNodeData>[]) => ns.map((n: Node<CyberNodeData>) => n.id === renaming.id ? { ...n, data: { ...n.data, label: name.trim() } } : n));
    if (selectedNode?.id === renaming.id) {
      setSelectedNode((prev: Node<CyberNodeData> | null) => prev ? { ...prev, data: { ...prev.data, label: name.trim() } } : null);
    }
    setRenaming(null);
  }, [renaming, selectedNode, setNodes]);

  const handleSave = useCallback(async () => {
    if (!modelId) return;
    setSaveStatus('saving');
    try {
      await updateThreatModel(modelId, { content: { nodes, edges } });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [modelId, nodes, edges]);

  const aiPanelOpen = Boolean(selectedNode) && !showThreatPanel;
  const threatPanelOpen = showThreatPanel && Boolean(modelId);

  return (
    <div style={{ width: '100%', height: '100%', paddingTop: '64px', position: 'relative', display: 'flex' }}>
      {/* Left stencil */}
      <NodeStencil onAdd={addNode} pack={currentPack} />

      {/* Canvas */}
      <div ref={reactFlowWrapper} style={{ flex: 1, position: 'relative' }}>

        {/* Toolbar overlay */}
        <div style={{ position: 'absolute', top: '12px', right: threatPanelOpen ? '356px' : '12px', zIndex: 30, display: 'flex', gap: '8px', alignItems: 'center', transition: 'right 0.2s' }}>
          {modelId && (
            <DomainSelector activePack={activePack} onPackChange={handlePackChange} />
          )}
          {modelId && (
            <button
              onClick={() => { setShowThreatPanel(v => !v); if (!showThreatPanel) { setSelectedNode(null); clearHighlight(); } }}
              style={{ padding: '5px 12px', borderRadius: '6px', border: `1px solid ${threatPanelOpen ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`, background: threatPanelOpen ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)', color: threatPanelOpen ? '#ef4444' : 'var(--on-surface-muted)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-label)', letterSpacing: '0.5px', transition: 'all 0.15s' }}
            >
              {threatPanelOpen ? '× Threats' : '⚡ Threats'}
            </button>
          )}
          {saveStatus === 'saved' && <span style={{ fontSize: '12px', color: '#52c41a' }}>✓ Saved</span>}
          {saveStatus === 'error' && <span style={{ fontSize: '12px', color: 'var(--error)' }}>Save failed</span>}
          {modelId && (
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              style={{ padding: '7px 16px', background: 'var(--primary)', border: 'none', color: '#000', fontWeight: 'bold', borderRadius: '6px', cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer', fontSize: '13px', fontFamily: 'var(--font-label)', opacity: saveStatus === 'saving' ? 0.6 : 1 }}
            >
              {saveStatus === 'saving' ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>

        {!modelId && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 5 }}>
            <p style={{ color: 'var(--on-surface-muted)', fontSize: '14px', margin: 0 }}>
              Selecione um modelo em <strong style={{ color: 'var(--primary)' }}>Projects</strong> para começar a editar
            </p>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onPaneClick={handlePaneClick}
          onNodesDelete={handleNodesDelete}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          defaultEdgeOptions={{ type: 'smoothstep' }}
        >
          <Background color="rgba(255,255,255,0.04)" gap={32} size={1} />
          <Controls style={{ background: 'var(--surface-container-high)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
          <MiniMap nodeColor={() => 'var(--primary)'} style={{ background: 'var(--surface-container-high)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }} />
        </ReactFlow>

        {/* Accepted threats log (AI) */}
        {acceptedThreats.length > 0 && !threatPanelOpen && (
          <div style={{ position: 'absolute', bottom: '24px', left: '24px', zIndex: 20 }}>
            <div className="glass-panel" style={{ padding: '14px', maxWidth: '360px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--primary)', marginBottom: '8px' }}>AI THREATS LOG ({acceptedThreats.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '160px', overflowY: 'auto' }}>
                {acceptedThreats.map((t: ThreatSuggestion, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px' }}>
                    <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    <SeverityBadge severity={t.severity} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!aiPanelOpen && !threatPanelOpen && (
          <div style={{ position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', fontSize: '11px', color: 'var(--on-surface-muted)', background: 'rgba(0,0,0,0.45)', padding: '5px 14px', borderRadius: '20px', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10 }}>
            Drag nodes · Connect handles · Double-click to rename · Del to remove
          </div>
        )}
      </div>

      {/* AI panel (node-level) */}
      {aiPanelOpen && selectedNode && (
        <AISuggestionsPanel
          node={selectedNode}
          onClose={handlePaneClick}
          onAccept={(t: ThreatSuggestion) => setAcceptedThreats((ts: ThreatSuggestion[]) => [...ts, t])}
        />
      )}

      {/* Threat panel (model-level, rule-based) */}
      {threatPanelOpen && modelId && (
        <ThreatPanel modelId={modelId} onClose={() => setShowThreatPanel(false)} />
      )}

      {/* Rename modal */}
      {renaming && (
        <RenameModal
          current={renaming.data.label}
          onConfirm={handleRenameConfirm}
          onCancel={() => setRenaming(null)}
        />
      )}
    </div>
  );
}
