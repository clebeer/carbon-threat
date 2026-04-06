import { apiClient } from './client';

export interface ThreatModelSummary {
  id: string;
  title: string;
  description?: string;
  version: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  owner_id: string;
  org_id?: string;
}

export interface ThreatModelContent {
  summary: ThreatModelSummary;
  content: Record<string, unknown>;
}

export async function listThreatModels(): Promise<ThreatModelSummary[]> {
  const { data } = await apiClient.get<{ models: ThreatModelSummary[] }>('/threatmodels');
  return data.models;
}

export async function listArchivedThreatModels(): Promise<ThreatModelSummary[]> {
  const { data } = await apiClient.get<{ models: ThreatModelSummary[] }>('/threatmodels?archived=true');
  return data.models;
}

export async function getThreatModel(id: string): Promise<ThreatModelContent> {
  const { data } = await apiClient.get<ThreatModelContent>(`/threatmodels/${id}`);
  return data;
}

export async function createThreatModel(payload: {
  title: string;
  description?: string;
  content?: Record<string, unknown>;
}): Promise<ThreatModelSummary> {
  const { data } = await apiClient.post<{ model: ThreatModelSummary }>('/threatmodels', payload);
  return data.model;
}

export async function updateThreatModel(
  id: string,
  payload: { title?: string; description?: string; content?: Record<string, unknown> }
): Promise<ThreatModelSummary> {
  const { data } = await apiClient.put<{ model: ThreatModelSummary }>(`/threatmodels/${id}`, payload);
  return data.model;
}

export async function archiveThreatModel(id: string): Promise<void> {
  await apiClient.delete(`/threatmodels/${id}`);
}

export async function restoreThreatModel(id: string): Promise<void> {
  await apiClient.put(`/threatmodels/${id}/restore`, {});
}

export async function exportThreatModel(id: string, title: string): Promise<void> {
  const model = await getThreatModel(id);
  const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  model: ThreatModelSummary;
  imported: { nodes: number; edges: number };
}

export async function importThreatDragonModel(json: unknown): Promise<ImportResult> {
  const { data } = await apiClient.post<ImportResult>('/threatmodels/import', { json });
  return data;
}
