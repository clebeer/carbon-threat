/**
 * STRIDE GPT AI Analysis API
 */
import { apiClient } from './client';

export interface StrideAnalysisPayload {
  appType?: 'Traditional application' | 'Generative AI application' | 'Agentic AI application';
  authentication?: string;
  internetFacing?: boolean;
  sensitiveData?: boolean;
  runDread?: boolean;
  runMitigations?: boolean;
  runTestCases?: boolean;
  description?: string;
}

export interface StrideAnalysisResult {
  threats: any[];
  improvement_suggestions: string[];
  analysisId: string;
}

/**
 * Run STRIDE GPT AI analysis on a threat model.
 * Timeout is 10 minutes (LLM calls can be slow).
 */
export async function runAiAnalysis(
  modelId: string,
  payload: StrideAnalysisPayload = {}
): Promise<StrideAnalysisResult> {
  const resp = await apiClient.post(`/threatmodels/${modelId}/ai-analyze`, payload, {
    timeout: 600_000, // 10 min
  });
  return resp.data;
}