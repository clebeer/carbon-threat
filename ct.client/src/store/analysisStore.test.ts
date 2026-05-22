import { describe, it, expect, beforeEach } from 'vitest';
import { useAnalysisStore } from './analysisStore';

describe('useAnalysisStore', () => {
  beforeEach(() => {
    useAnalysisStore.getState().clearHighlight();
  });

  it('starts with empty highlights', () => {
    const state = useAnalysisStore.getState();
    expect(state.highlightedNodeIds.size).toBe(0);
    expect(state.highlightedEdgeIds.size).toBe(0);
    expect(state.selectedThreatId).toBeNull();
    expect(state.selectedNodeId).toBeNull();
    expect(state.selectedNodeLabel).toBeNull();
  });

  it('setHighlight sets node and edge IDs', () => {
    useAnalysisStore.getState().setHighlight(['n1', 'n2'], ['e1']);
    const state = useAnalysisStore.getState();
    expect(state.highlightedNodeIds.has('n1')).toBe(true);
    expect(state.highlightedNodeIds.has('n2')).toBe(true);
    expect(state.highlightedEdgeIds.has('e1')).toBe(true);
    expect(state.highlightedEdgeIds.size).toBe(1);
  });

  it('setHighlight replaces previous highlights', () => {
    useAnalysisStore.getState().setHighlight(['n1'], ['e1']);
    useAnalysisStore.getState().setHighlight(['n2'], ['e2']);
    const state = useAnalysisStore.getState();
    expect(state.highlightedNodeIds.has('n1')).toBe(false);
    expect(state.highlightedNodeIds.has('n2')).toBe(true);
    expect(state.highlightedEdgeIds.has('e1')).toBe(false);
    expect(state.highlightedEdgeIds.has('e2')).toBe(true);
  });

  it('clearHighlight resets everything', () => {
    useAnalysisStore.getState().setHighlight(['n1'], ['e1']);
    useAnalysisStore.getState().setSelectedThreat('t1');
    useAnalysisStore.getState().setNodeFilter('n1', 'Node 1');
    useAnalysisStore.getState().clearHighlight();
    const state = useAnalysisStore.getState();
    expect(state.highlightedNodeIds.size).toBe(0);
    expect(state.highlightedEdgeIds.size).toBe(0);
    expect(state.selectedThreatId).toBeNull();
    expect(state.selectedNodeId).toBeNull();
    expect(state.selectedNodeLabel).toBeNull();
  });

  it('setSelectedThreat sets the threat ID', () => {
    useAnalysisStore.getState().setSelectedThreat('threat-123');
    expect(useAnalysisStore.getState().selectedThreatId).toBe('threat-123');
  });

  it('setSelectedThreat can clear with null', () => {
    useAnalysisStore.getState().setSelectedThreat('threat-123');
    useAnalysisStore.getState().setSelectedThreat(null);
    expect(useAnalysisStore.getState().selectedThreatId).toBeNull();
  });

  it('setNodeFilter sets node ID and label', () => {
    useAnalysisStore.getState().setNodeFilter('node-1', 'Server');
    const state = useAnalysisStore.getState();
    expect(state.selectedNodeId).toBe('node-1');
    expect(state.selectedNodeLabel).toBe('Server');
  });

  it('setNodeFilter with null clears highlights', () => {
    useAnalysisStore.getState().setHighlight(['n1'], ['e1']);
    useAnalysisStore.getState().setNodeFilter(null);
    const state = useAnalysisStore.getState();
    expect(state.selectedNodeId).toBeNull();
    expect(state.selectedNodeLabel).toBeNull();
    expect(state.highlightedNodeIds.size).toBe(0);
    expect(state.highlightedEdgeIds.size).toBe(0);
  });

  it('setNodeFilter with null but no label defaults to null', () => {
    useAnalysisStore.getState().setNodeFilter('x', 'Label');
    useAnalysisStore.getState().setNodeFilter(null);
    expect(useAnalysisStore.getState().selectedNodeLabel).toBeNull();
  });

  // STRIDE AI Analysis state
  it('starts with strideLoading false, strideError null, strideResult null', () => {
    const state = useAnalysisStore.getState();
    expect(state.strideLoading).toBe(false);
    expect(state.strideError).toBeNull();
    expect(state.strideResult).toBeNull();
  });

  it('setStrideLoading sets loading state', () => {
    useAnalysisStore.getState().setStrideLoading(true);
    expect(useAnalysisStore.getState().strideLoading).toBe(true);
    useAnalysisStore.getState().setStrideLoading(false);
    expect(useAnalysisStore.getState().strideLoading).toBe(false);
  });

  it('setStrideError sets error state', () => {
    useAnalysisStore.getState().setStrideError('API error');
    expect(useAnalysisStore.getState().strideError).toBe('API error');
    useAnalysisStore.getState().setStrideError(null);
    expect(useAnalysisStore.getState().strideError).toBeNull();
  });

  it('setStrideResult sets result state', () => {
    const result = { threats: [], improvement_suggestions: ['suggestion1'], analysisId: 'abc-123' };
    useAnalysisStore.getState().setStrideResult(result);
    expect(useAnalysisStore.getState().strideResult).toEqual(result);
  });

  it('clearStrideAnalysis resets all stride state', () => {
    useAnalysisStore.getState().setStrideLoading(true);
    useAnalysisStore.getState().setStrideError('err');
    useAnalysisStore.getState().setStrideResult({ threats: [], improvement_suggestions: [], analysisId: 'x' });
    useAnalysisStore.getState().clearStrideAnalysis();
    const state = useAnalysisStore.getState();
    expect(state.strideLoading).toBe(false);
    expect(state.strideError).toBeNull();
    expect(state.strideResult).toBeNull();
  });
});
