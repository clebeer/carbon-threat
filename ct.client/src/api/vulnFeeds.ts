import { apiClient } from './client';

export interface VulnFeedRun {
  status: 'running' | 'success' | 'partial' | 'error';
  fetched: number;
  inserted: number;
  updated: number;
  error_message?: string;
  started_at: string;
  finished_at?: string;
}

export interface VulnFeedStatus {
  lastRun: VulnFeedRun | null;
  totalAdvisories: number;
  bySeverity: Record<string, number>;
}

export async function getVulnFeedStatus(): Promise<VulnFeedStatus> {
  const { data } = await apiClient.get<VulnFeedStatus>('/admin/vuln-feeds/status');
  return data;
}

export async function triggerVulnFeedSync(): Promise<{ message: string; runId: string }> {
  const { data } = await apiClient.post<{ message: string; runId: string }>('/admin/vuln-feeds/sync', {});
  return data;
}
