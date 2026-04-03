import { apiClient } from './client';

export type Platform = 'github' | 'jira' | 'servicenow' | 'openai' | 'ollama';

export interface IntegrationSummary {
  id: string;
  platform: Platform;
  is_enabled: boolean;
  updated_at: string;
  config: Record<string, string>; // secrets are redacted ('***')
}

// ── Config CRUD ────────────────────────────────────────────────────────────

export async function listIntegrations(): Promise<IntegrationSummary[]> {
  const { data } = await apiClient.get<{ configs: IntegrationSummary[] }>('/integrations');
  return data.configs;
}

export async function getIntegration(platform: Platform): Promise<IntegrationSummary> {
  const { data } = await apiClient.get<IntegrationSummary>(`/integrations/${platform}`);
  return data;
}

/**
 * Creates or updates the encrypted credentials for a platform.
 * Pass the platform-specific fields (see docs per platform below).
 *
 * GitHub:      { token, repo }                     e.g. "owner/repo"
 * Jira:        { serverUrl, email, token, projectKey }
 * ServiceNow:  { serverUrl, username, password }
 * OpenAI:      { apiKey, model? }
 * Ollama:      { url, model }
 */
export async function upsertIntegration(
  platform: Platform,
  config: Record<string, string>,
  is_enabled = true
): Promise<{ message: string; is_enabled: boolean }> {
  const { data } = await apiClient.put(`/integrations/${platform}`, { is_enabled, ...config });
  return data;
}

export async function deleteIntegration(platform: Platform): Promise<void> {
  await apiClient.delete(`/integrations/${platform}`);
}

// ── Export ─────────────────────────────────────────────────────────────────

export async function exportIssue(
  platform: Platform,
  title: string,
  description: string
): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>(
    `/integrations/${platform}/export`,
    { title, description }
  );
  return data;
}
