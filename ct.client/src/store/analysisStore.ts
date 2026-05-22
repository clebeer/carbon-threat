import { create } from 'zustand';

interface StrideAnalysisResult {
  threats: any[];
  improvement_suggestions: string[];
  analysisId: string;
}

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

  // STRIDE AI Analysis
  strideLoading: boolean;
  strideError: string | null;
  strideResult: StrideAnalysisResult | null;
  setStrideLoading: (loading: boolean) => void;
  setStrideError: (error: string | null) => void;
  setStrideResult: (result: StrideAnalysisResult | null) => void;
  clearStrideAnalysis: () => void;
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

  // STRIDE AI Analysis state
  strideLoading: false,
  strideError: null,
  strideResult: null,
  setStrideLoading: (loading) => set({ strideLoading: loading }),
  setStrideError: (error) => set({ strideError: error }),
  setStrideResult: (result) => set({ strideResult: result }),
  clearStrideAnalysis: () => set({ strideLoading: false, strideError: null, strideResult: null }),
}));
