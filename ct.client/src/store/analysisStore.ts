import { create } from 'zustand';

interface AnalysisState {
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
  selectedThreatId: string | null;
  selectedNodeId: string | null;
  selectedNodeLabel: string | null;
  setHighlight: (nodeIds: string[], edgeIds: string[]) => void;
  clearHighlight: () => void;
  setSelectedThreat: (id: string | null) => void;
  setNodeFilter: (id: string | null, label?: string | null) => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  highlightedNodeIds: new Set(),
  highlightedEdgeIds: new Set(),
  selectedThreatId: null,
  selectedNodeId: null,
  selectedNodeLabel: null,

  setHighlight: (nodeIds, edgeIds) =>
    set({
      highlightedNodeIds: new Set(nodeIds),
      highlightedEdgeIds: new Set(edgeIds),
    }),

  clearHighlight: () =>
    set({
      highlightedNodeIds: new Set(),
      highlightedEdgeIds: new Set(),
      selectedThreatId: null,
      selectedNodeId: null,
      selectedNodeLabel: null,
    }),

  setSelectedThreat: (id) =>
    set({ selectedThreatId: id }),

  setNodeFilter: (id, label) =>
    set({
      selectedNodeId: id,
      selectedNodeLabel: label ?? null,
      // If clearing node filter, also clear highlight
      ...(id === null ? { highlightedNodeIds: new Set(), highlightedEdgeIds: new Set() } : {}),
    }),
}));
