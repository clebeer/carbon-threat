import { apiClient } from './client';

export type StrideCategory =
  | 'Spoofing'
  | 'Tampering'
  | 'Repudiation'
  | 'Information Disclosure'
  | 'DoS'
  | 'Elevation of Privilege';

export type ThreatStatus = 'Open' | 'Mitigated' | 'Investigating' | 'Not Applicable';
export type ThreatSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export type ThreatSource = 'manual' | 'rule' | 'ai';

export interface OwaspRef {
  type: 'OWASP_TOP10' | 'CHEAT_SHEET' | 'ASVS';
  ref: string;
  title: string;
  url: string;
}

export interface Threat {
  id: string;
  model_id: string;
  node_ids: string[];
  edge_ids: string[];
  title: string;
  description?: string;
  stride_category: StrideCategory;
  severity: ThreatSeverity;
  status: ThreatStatus;
  source: ThreatSource;
  rule_id?: string;
  mitigation?: string;
  owasp_refs: OwaspRef[];
  created_at: string;
  updated_at: string;
}

export interface ListThreatsParams {
  modelId?: string;
  status?: ThreatStatus;
  strideCategory?: StrideCategory;
}

export async function listThreats(params: ListThreatsParams = {}): Promise<Threat[]> {
  const query = new URLSearchParams();
  if (params.modelId) query.set('modelId', params.modelId);
  if (params.status) query.set('status', params.status);
  if (params.strideCategory) query.set('strideCategory', params.strideCategory);
  const { data } = await apiClient.get<{ threats: Threat[] }>(`/threats?${query}`);
  return data.threats;
}

export async function createThreat(payload: Partial<Threat>): Promise<Threat> {
  const { data } = await apiClient.post<{ threat: Threat }>('/threats', payload);
  return data.threat;
}

export async function updateThreat(id: string, patch: Partial<Threat>): Promise<Threat> {
  const { data } = await apiClient.put<{ threat: Threat }>(`/threats/${id}`, patch);
  return data.threat;
}

export async function deleteThreat(id: string): Promise<void> {
  await apiClient.delete(`/threats/${id}`);
}

export async function analyzeModel(modelId: string): Promise<{ threats: Threat[]; count: number; message: string }> {
  const { data } = await apiClient.post<{ threats: Threat[]; count: number; message: string }>(
    `/threatmodels/${modelId}/analyze`
  );
  return data;
}
