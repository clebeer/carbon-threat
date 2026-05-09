import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng, toSvg } from 'html-to-image';
import { getThreatModel, updateThreatModel } from '../../api/threatmodels';
import { type ThreatSuggestion } from '../../api/ai';
import { useQuery } from '@tanstack/react-query';
import { type DomainPack } from '../../api/domainPacks';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import ThreatPanel from './ThreatPanel';
import DomainSelector from './DomainSelector';
import { convertDrawioToReactFlow, isDrawioFile } from '../../importers/drawioImporter';
import { convertGliffyToReactFlow, isGliffyDiagram } from '../../importers/gliffyImporter';
import { convertVsdxToReactFlow, isVsdxFile } from '../../importers/visioImporter';

// ── Extracted modules ────────────────────────────────────────────────────────
import { DEFAULT_KIND_LABEL } from './assets/kindLabels';
import { miniMapNodeColor } from './assets/kindColors';
import { EDGE_TYPES_LIST, EDGE_TYPE_STYLES } from './assets/edgeTypes';
import { CyberNode, type CyberNodeData, cyberNodeState } from './CyberNode';
import { TrustBoundaryNode } from './TrustBoundaryNode';
import { DataFlowEdge } from './DataFlowEdge';
import { AISuggestionsPanel, SeverityBadge } from './AISuggestionsPanel';
import { NodeStencil } from './NodeStencil';
import { RenameModal } from './RenameModal';
import { EdgeLabelModal } from './EdgeLabelModal';
import { layoutWithDagre, layoutWithElk, alignNodes } from './hooks/useLayout';
import { ErrorBoundary } from '../ErrorBoundary';

// ── Node & edge type registries ──────────────────────────────────────────────

const nodeTypes = { cyber: CyberNode, 'trust-boundary': TrustBoundaryNode };
const edgeTypes = { 'data-flow': DataFlowEdge };

// ── Initial diagram ─────────────────────────────────────────────────────────

const INIT_NODES: Node<CyberNodeData>[] = [
  { id: '1', type: 'cyber', position: { x: 300, y: 150 }, data: { label: 'Web Server', kind: 'server' } },
  { id: '2', type: 'cyber', position: { x: 100, y: 320 }, data: { label: 'Database',   kind: 'db' } },
  { id: '3', type: 'cyber', position: { x: 500, y: 320 }, data: { label: 'Firewall',   kind: 'fw' } },
];

const INIT_EDGES: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'data-flow', animated: true,  style: { stroke: 'var(--primary)',   strokeWidth: 2 }, data: { label: 'SQL' } },
  { id: 'e1-3', source: '1', target: '3', type: 'data-flow', animated: false, style: { stroke: 'var(--secondary)', strokeWidth: 2 }, data: { label: 'HTTPS' } },
];

let nodeCounter = INIT_NODES.length;

// ── Main canvas ─────────────────────────────────────────────────────────────

export default function ThreatFlow(props: { modelId?: string | null; modelTitle?: string }) {
  return (
    <ReactFlowProvider>
      <ThreatFlowInner {...props} />
    </ReactFlowProvider>
  );
}

function ThreatFlowInner({ modelId, modelTitle }: { modelId?: string | null; modelTitle?: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CyberNodeData>(INIT_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INIT_EDGES);
  const [selectedNode, setSelectedNode] = useState<Node<CyberNodeData> | null>(null);
  const [acceptedThreats, setAcceptedThreats] = useState<ThreatSuggestion[]>([]);
  const [renaming, setRenaming] = useState<Node<CyberNodeData> | null>(null);
  const [editingEdge, setEditingEdge] = useState<Edge | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [activeEdgeType, setActiveEdgeType] = useState<string>('data-flow');
  const [showThreatPanel, setShowThreatPanel] = useState(false);
  const [activePack, setActivePack] = useState<string>(() => {
    if (modelId) return localStorage.getItem(`ct_pack_${modelId}`) ?? 'generic';
    return 'generic';
  });
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const { highlightedEdgeIds, clearHighlight, setHighlight, setNodeFilter, selectedNodeId } = useAnalysisStore();

  // Export diagram as PNG or SVG
  const exportImage = useCallback(async (format: 'png' | 'svg') => {
    const el = document.querySelector('.react-flow') as HTMLElement | null;
    if (!el) return;
    try {
      const fn = format === 'png' ? toPng : toSvg;
      const dataUrl = await fn(el, { backgroundColor: '#0a0a14' });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${modelTitle ?? 'diagram'}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [modelTitle]);

  // Undo / Redo
  const { undo, redo, canUndo, canRedo, pushSnapshot } = useUndoRedo(nodes, edges, setNodes, setEdges);

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

  function handlePackChange(slug: string) {
    setActivePack(slug);
    if (modelId) localStorage.setItem(`ct_pack_${modelId}`, slug);
  }

  // Load model content
  useEffect(() => {
    if (!modelId) return;
    setActivePack(localStorage.getItem(`ct_pack_${modelId}`) ?? 'generic');
    getThreatModel(modelId).then(({ content }) => {
      const loadedNodes = (content as Record<string, unknown>)?.nodes;
      const loadedEdges = (content as Record<string, unknown>)?.edges;
      if (Array.isArray(loadedNodes) && loadedNodes.length > 0) {
        setNodes(loadedNodes as Node<CyberNodeData>[]);
        setEdges(Array.isArray(loadedEdges) ? (loadedEdges as Edge[]) : []);
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
    pushSnapshot();
    const style = EDGE_TYPE_STYLES[activeEdgeType] ?? EDGE_TYPE_STYLES['data-flow'];
    setEdges((eds: Edge[]) => addEdge({
      ...params,
      type: 'data-flow',
      animated: activeEdgeType === 'data-flow',
      style: { ...style },
      data: { label: '', edgeType: activeEdgeType },
    }, eds));
  }, [setEdges, pushSnapshot, activeEdgeType]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node<CyberNodeData>) => {
    if (showThreatPanel) {
      if (selectedNodeId === node.id) {
        clearHighlight();
      } else {
        setNodeFilter(node.id, node.data.label);
        setHighlight([node.id], []);
      }
      return;
    }
    clearHighlight();
    setSelectedNode((prev: Node<CyberNodeData> | null) => prev?.id === node.id ? null : node);
    setNodes((ns: Node<CyberNodeData>[]) => ns.map((n: Node<CyberNodeData>) => ({ ...n, data: { ...n.data, selected: n.id === node.id } })));
  }, [showThreatPanel, selectedNodeId, setNodes, clearHighlight, setNodeFilter, setHighlight]);

  const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node<CyberNodeData>) => {
    setRenaming(node);
  }, []);

  const handleEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setEditingEdge(edge);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setNodes((ns: Node<CyberNodeData>[]) => ns.map((n: Node<CyberNodeData>) => ({ ...n, data: { ...n.data, selected: false } })));
  }, [setNodes]);

  const addNode = useCallback((kind: string, position?: { x: number; y: number }) => {
    pushSnapshot();
    nodeCounter += 1;
    const id = String(nodeCounter);
    const label = currentPack?.icon_manifest?.nodeTypes?.[kind]?.label ?? DEFAULT_KIND_LABEL[kind] ?? kind;
    const newNode: Node<CyberNodeData> = {
      id,
      type: 'cyber',
      position: position ?? { x: 280 + (nodeCounter % 5) * 40, y: 220 + (nodeCounter % 5) * 40 },
      data: { label, kind, selected: false },
    };
    setNodes((ns: Node<CyberNodeData>[]) => [...ns, newNode]);
  }, [setNodes, currentPack, pushSnapshot]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData('application/reactflow-kind');
    if (!kind) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addNode(kind, position);
  }, [screenToFlowPosition, addNode]);

  const handleNodesDelete = useCallback((deleted: Node<CyberNodeData>[]) => {
    pushSnapshot();
    if (selectedNode && deleted.some((d: Node<CyberNodeData>) => d.id === selectedNode.id)) {
      setSelectedNode(null);
    }
  }, [selectedNode, pushSnapshot]);

  const handleRenameConfirm = useCallback((name: string) => {
    if (!renaming || !name.trim()) { setRenaming(null); return; }
    pushSnapshot();
    setNodes((ns: Node<CyberNodeData>[]) => ns.map((n: Node<CyberNodeData>) => n.id === renaming.id ? { ...n, data: { ...n.data, label: name.trim() } } : n));
    if (selectedNode?.id === renaming.id) {
      setSelectedNode((prev: Node<CyberNodeData> | null) => prev ? { ...prev, data: { ...prev.data, label: name.trim() } } : null);
    }
    setRenaming(null);
  }, [renaming, selectedNode, setNodes, pushSnapshot]);

  const handleEdgeLabelConfirm = useCallback((label: string) => {
    if (!editingEdge) { setEditingEdge(null); return; }
    pushSnapshot();
    setEdges((es: Edge[]) => es.map((e: Edge) =>
      e.id === editingEdge.id
        ? { ...e, data: { ...(e.data as Record<string, unknown>), label }, type: 'data-flow' }
        : e
    ));
    setEditingEdge(null);
  }, [editingEdge, setEdges, pushSnapshot]);

  const handleAutoLayout = useCallback(() => {
    pushSnapshot();
    const laidOut = layoutWithDagre(nodes, edges);
    setNodes(laidOut);
  }, [nodes, edges, setNodes, pushSnapshot]);

  const handleElkLayout = useCallback(async () => {
    pushSnapshot();
    const laidOut = await layoutWithElk(nodes, edges);
    setNodes(laidOut);
  }, [nodes, edges, setNodes, pushSnapshot]);

  const handleAlign = useCallback((dir: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom' | 'distribute-h' | 'distribute-v') => {
    pushSnapshot();
    const sel = nodes.filter(n => n.data?.selected);
    if (sel.length < 2) return;
    const aligned = alignNodes(sel, dir);
    setNodes((ns: Node<CyberNodeData>[]) => ns.map(n => {
      const a = aligned.find(al => al.id === n.id);
      return a ? { ...n, position: a.position } : n;
    }));
  }, [nodes, setNodes, pushSnapshot]);

  // Wire shared refs for sub-components
  cyberNodeState.activePack = currentPack;

  // Wire toolbar actions for mini-toolbar
  const toolbarActions = {
    onDelete: (id: string) => { pushSnapshot(); setNodes((ns: Node<CyberNodeData>[]) => ns.filter(n => n.id !== id)); },
    onDuplicate: (id: string) => { const n = nodes.find(n => n.id === id); if (n) addNode(n.data.kind, { x: n.position.x + 120, y: n.position.y + 40 }); },
    onRename: (id: string) => { const n = nodes.find(n => n.id === id); if (n) setRenaming(n); },
    onConnect: (id: string) => { setSelectedNode(nodes.find(n => n.id === id) ?? null); },
  };
  cyberNodeState.toolbarActions = toolbarActions;

  // ── Import diagram from external formats ──────────────────────────────────
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pushSnapshot();
    try {
      let imported: { nodes: Node[]; edges: Edge[] };

      if (isVsdxFile(file)) {
        const result = await convertVsdxToReactFlow(file);
        imported = { nodes: result.nodes, edges: result.edges };
      } else {
        const text = await file.text();
        try {
          const json = JSON.parse(text);
          if (isGliffyDiagram(json)) {
            const result = convertGliffyToReactFlow(json);
            imported = { nodes: result.nodes, edges: result.edges };
          } else if (isDrawioFile(text)) {
            const result = convertDrawioToReactFlow(text);
            imported = { nodes: result.nodes, edges: result.edges };
          } else {
            alert('Unsupported JSON format. Use Draw.io XML, Gliffy JSON, or Visio VSDX.');
            return;
          }
        } catch {
          if (isDrawioFile(text)) {
            const result = convertDrawioToReactFlow(text);
            imported = { nodes: result.nodes, edges: result.edges };
          } else {
            alert('Unsupported file format. Use .drawio, .xml (Draw.io), .json (Gliffy), or .vsdx (Visio).');
            return;
          }
        }
      }

      const offsetX = nodes.length > 0 ? Math.max(...nodes.map(n => n.position.x)) + 200 : 0;
      const mappedNodes = imported.nodes.map((n, i) => ({
        ...n,
        id: String(++nodeCounter),
        type: 'cyber',
        position: { x: (n.position?.x ?? 0) + offsetX, y: n.position?.y ?? i * 80 },
        data: { label: n.data?.label ?? n.data?.kind ?? 'Node', kind: n.data?.kind ?? 'server', selected: false },
      })) as Node<CyberNodeData>[];

      const idMap = new Map(imported.nodes.map((n, i) => [n.id, mappedNodes[i].id]));
      const mappedEdges = imported.edges
        .filter(e => idMap.has(e.source) && idMap.has(e.target))
        .map(e => ({
          ...e,
          id: `ie-${++nodeCounter}`,
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
          type: 'data-flow',
          animated: true,
          style: { stroke: 'var(--primary)', strokeWidth: 2 },
        }));

      setNodes(ns => [...ns, ...mappedNodes]);
      setEdges(es => [...es, ...mappedEdges]);
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import failed. Check the file format and try again.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [nodes, setNodes, setEdges, pushSnapshot]);

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

  const tbBtn: React.CSSProperties = {
    padding: '5px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.04)', color: 'var(--on-surface-muted)',
    fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-label)',
    letterSpacing: '0.5px', transition: 'all 0.15s',
  };

  return (
    <div style={{ width: '100%', height: '100%', paddingTop: '64px', position: 'relative', display: 'flex' }}>
      <NodeStencil onAdd={(kind) => addNode(kind)} pack={currentPack} />

      <ErrorBoundary label="Canvas">
      <div ref={reactFlowWrapper} style={{ flex: 1, position: 'relative' }}>
        {/* Toolbar */}
        <div style={{ position: 'absolute', top: '12px', right: threatPanelOpen ? '356px' : '12px', zIndex: 30, display: 'flex', gap: '6px', alignItems: 'center', transition: 'right 0.2s', flexWrap: 'wrap' }}>
          <button aria-label="Undo" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={{ ...tbBtn, opacity: canUndo ? 1 : 0.35, cursor: canUndo ? 'pointer' : 'not-allowed' }}>↩</button>
          <button aria-label="Redo" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={{ ...tbBtn, opacity: canRedo ? 1 : 0.35, cursor: canRedo ? 'pointer' : 'not-allowed' }}>↪</button>
          <button onClick={handleAutoLayout} title="Auto Layout (Dagre)" style={tbBtn}>⬡ Layout</button>
          <button onClick={handleElkLayout} title="ELK Layout" style={tbBtn}>⬢ ELK</button>
          <select title="Align selected nodes" defaultValue="" onChange={e => { if (e.target.value) { handleAlign(e.target.value as Parameters<typeof handleAlign>[0]); e.target.value = ''; } }} style={{ ...tbBtn, appearance: 'none', paddingRight: '8px', textAlign: 'center', background: 'rgba(255,255,255,0.06)' }}>
            <option value="" disabled style={{ background: '#1a1a2e', color: '#e2e8f0' }}>⌗ Align</option>
            <option value="left" style={{ background: '#1a1a2e', color: '#e2e8f0' }}>← Left</option>
            <option value="center-h" style={{ background: '#1a1a2e', color: '#e2e8f0' }}>↔ Center H</option>
            <option value="right" style={{ background: '#1a1a2e', color: '#e2e8f0' }}>→ Right</option>
            <option value="top" style={{ background: '#1a1a2e', color: '#e2e8f0' }}>↑ Top</option>
            <option value="center-v" style={{ background: '#1a1a2e', color: '#e2e8f0' }}>↕ Center V</option>
            <option value="bottom" style={{ background: '#1a1a2e', color: '#e2e8f0' }}>↓ Bottom</option>
            <option value="distribute-h" style={{ background: '#1a1a2e', color: '#e2e8f0' }}>━ Distrib H</option>
            <option value="distribute-v" style={{ background: '#1a1a2e', color: '#e2e8f0' }}>┃ Distrib V</option>
          </select>
          <input ref={fileInputRef} type="file" accept=".drawio,.xml,.json,.vsdx" onChange={handleImport} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()} title="Import" style={tbBtn}>📂 Import</button>
          <button onClick={() => exportImage('png')} title="Export PNG" style={tbBtn}>⬇ PNG</button>
          <button onClick={() => exportImage('svg')} title="Export SVG" style={tbBtn}>⬇ SVG</button>
          <select value={activeEdgeType} onChange={e => setActiveEdgeType(e.target.value)} title="Edge type" style={{ ...tbBtn, appearance: 'none', paddingRight: '8px', textAlign: 'center', background: 'rgba(255,255,255,0.06)' }}>
            {EDGE_TYPES_LIST.map(et => (
              <option key={et.type} value={et.type} style={{ background: '#1a1a2e', color: '#e2e8f0' }}>{et.icon} {et.label}</option>
            ))}
          </select>
          {modelId && <DomainSelector activePack={activePack} onPackChange={handlePackChange} />}
          {modelId && (
            <button onClick={() => { setShowThreatPanel(v => !v); if (!showThreatPanel) { setSelectedNode(null); clearHighlight(); } }} style={{ ...tbBtn, border: `1px solid ${threatPanelOpen ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`, background: threatPanelOpen ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)', color: threatPanelOpen ? '#ef4444' : 'var(--on-surface-muted)' }}>
              {threatPanelOpen ? '× Threats' : '⚡ Threats'}
            </button>
          )}
          {saveStatus === 'saved' && <span style={{ fontSize: '12px', color: '#52c41a' }}>✓ Saved</span>}
          {saveStatus === 'error' && <span style={{ fontSize: '12px', color: 'var(--error)' }}>Save failed</span>}
          {modelId && (
            <button onClick={handleSave} disabled={saveStatus === 'saving'} style={{ padding: '7px 16px', background: 'var(--primary)', border: 'none', color: '#000', fontWeight: 'bold', borderRadius: '6px', cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer', fontSize: '13px', fontFamily: 'var(--font-label)', opacity: saveStatus === 'saving' ? 0.6 : 1 }}>
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
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onEdgeDoubleClick={handleEdgeDoubleClick}
          onPaneClick={handlePaneClick}
          onNodesDelete={handleNodesDelete}
          onDrop={onDrop}
          onDragOver={onDragOver}
          deleteKeyCode={['Backspace', 'Delete']}
          selectionOnDrag
          selectionKeyCode="Shift"
          multiSelectionKeyCode="Shift"
          snapToGrid
          snapGrid={[16, 16]}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          defaultEdgeOptions={{ type: 'data-flow' }}
        >
          <Background color="rgba(255,255,255,0.04)" gap={32} size={1} />
          <Controls style={{ background: 'var(--surface-container-high)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
          <MiniMap nodeColor={miniMapNodeColor} style={{ background: 'var(--surface-container-high)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }} />
        </ReactFlow>

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
            Drag from stencil · Shift+drag to select · Shift+click multi-select · Connect handles · Ctrl+Z undo
          </div>
        )}
      </div>
      </ErrorBoundary>

      {aiPanelOpen && selectedNode && (
        <ErrorBoundary label="AI Panel">
          <AISuggestionsPanel node={selectedNode} onClose={handlePaneClick} onAccept={(t: ThreatSuggestion) => setAcceptedThreats((ts: ThreatSuggestion[]) => [...ts, t])} />
        </ErrorBoundary>
      )}
      {threatPanelOpen && modelId && (
        <ThreatPanel modelId={modelId} onClose={() => setShowThreatPanel(false)} />
      )}
      {renaming && <RenameModal current={renaming.data.label} onConfirm={handleRenameConfirm} onCancel={() => setRenaming(null)} />}
      {editingEdge && <EdgeLabelModal current={(editingEdge.data as Record<string, string>)?.label ?? ''} onConfirm={handleEdgeLabelConfirm} onCancel={() => setEditingEdge(null)} />}
    </div>
  );
}