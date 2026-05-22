import { apiClient } from './client';

export type Platform =
  // Issue trackers
  | 'github' | 'jira' | 'servicenow'
  // AI assistants
  | 'openai' | 'ollama'
  // SIEM push
  | 'splunk' | 'sentinel' | 'elastic' | 'webhook'
  // Notifications
  | 'slack' | 'teams' | 'pagerduty';

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
 * GitHub:     { token, repo }                       e.g. "owner/repo"
 * Jira:       { serverUrl, email, token, projectKey }
 * ServiceNow: { serverUrl, username, password }
 * OpenAI:     { apiKey, model? }
 * Ollama:     { url, model }
 * Splunk:     { serverUrl, token, index? }          HEC endpoint + token
 * Sentinel:   { workspaceId, sharedKey, logType? }  Log Analytics Workspace
 * Elastic:    { serverUrl, apiKey, indexName? }
 * Webhook:    { url, secret?, headers? }            generic HTTP push
 * Slack:      { webhookUrl, channel? }
 * Teams:      { webhookUrl }
 * PagerDuty:  { routingKey }                        Events API v2
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

// ── Audit Log Export ────────────────────────────────────────────────────────

export type AuditExportFormat = 'csv' | 'json' | 'cef' | 'leef' | 'ecs';

export async function exportAuditLogs(
  format: AuditExportFormat,
  filters: { action?: string; entity_type?: string; from?: string; to?: string } = {}
): Promise<Blob> {
  const params = new URLSearchParams({ format });
  if (filters.action)      params.set('action', filters.action);
  if (filters.entity_type) params.set('entity_type', filters.entity_type);
  if (filters.from)        params.set('from', filters.from);
  if (filters.to)          params.set('to', filters.to);
  const { data } = await apiClient.get<Blob>(`/audit/export?${params.toString()}`, {
    responseType: 'blob',
  });
  return data;
}

// ── Issue Export ────────────────────────────────────────────────────────────

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
