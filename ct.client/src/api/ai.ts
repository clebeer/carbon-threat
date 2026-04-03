import { apiClient } from './client';

export interface ThreatSuggestion {
  title: string;
  severity: 'High' | 'Medium' | 'Low';
  mitigation: string;
  strideCategory: string;
}

export interface SuggestResponse {
  nodeId: string;
  suggestions: ThreatSuggestion[];
}

/**
 * Calls POST /api/ai/suggest with the selected node's metadata.
 * Returns STRIDE threat suggestions from the configured LLM.
 */
export async function suggestThreats(
  nodeId: string,
  label: string,
  type?: string
): Promise<SuggestResponse> {
  const { data } = await apiClient.post<SuggestResponse>('/ai/suggest', {
    nodeId,
    label,
    type: type ?? 'Component',
  });
  return data;
}
