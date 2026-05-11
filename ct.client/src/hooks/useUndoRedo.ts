/**
 * Undo/Redo hook for React Flow nodes & edges state.
 *
 * Maintains a history stack of {nodes, edges} snapshots.
 * Bound to Ctrl+Z (undo) and Ctrl+Y / Ctrl+Shift+Z (redo).
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { Node, Edge } from 'reactflow';

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

interface UseUndoRedoOptions {
  maxHistory?: number;
  enabled?: boolean;
}

export function useUndoRedo(
  nodes: Node[],
  edges: Edge[],
  setNodes: (ns: Node[] | ((prev: Node[]) => Node[])) => void,
  setEdges: (es: Edge[] | ((prev: Edge[]) => Edge[])) => void,
  opts: UseUndoRedoOptions = {}
) {
  const { maxHistory = 50, enabled = true } = opts;

  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const skipSnapshot = useRef(false);

  // External store for canUndo/canRedo (avoids reading refs during render)
  const listeners = useRef(new Set<() => void>());
  const subscribe = useCallback((l: () => void) => { listeners.current.add(l); return () => { listeners.current.delete(l); }; }, []);
  const notify = useCallback(() => { listeners.current.forEach(l => l()); }, []);

  const getCanUndo = useCallback(() => pastRef.current.length > 0, []);
  const getCanRedo = useCallback(() => futureRef.current.length > 0, []);
  const canUndo = useSyncExternalStore(subscribe, getCanUndo);
  const canRedo = useSyncExternalStore(subscribe, getCanRedo);

  // Push current state to past (called before every mutation)
  const pushSnapshot = useCallback(() => {
    if (!enabled) return;
    pastRef.current.push({ nodes, edges });
    if (pastRef.current.length > maxHistory) pastRef.current.shift();
    futureRef.current = []; // clear redo stack on new action
    notify();
  }, [nodes, edges, maxHistory, enabled, notify]);

  const undo = useCallback(() => {
    if (!enabled || pastRef.current.length === 0) return;
    const prev = pastRef.current.pop()!;
    futureRef.current.push({ nodes, edges });
    skipSnapshot.current = true;
    setNodes(prev.nodes);
    setEdges(prev.edges);
    notify();
  }, [nodes, edges, setNodes, setEdges, enabled, notify]);

  const redo = useCallback(() => {
    if (!enabled || futureRef.current.length === 0) return;
    const next = futureRef.current.pop()!;
    pastRef.current.push({ nodes, edges });
    skipSnapshot.current = true;
    setNodes(next.nodes);
    setEdges(next.edges);
    notify();
  }, [nodes, edges, setNodes, setEdges, enabled, notify]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, enabled]);

  return { undo, redo, canUndo, canRedo, pushSnapshot };
}