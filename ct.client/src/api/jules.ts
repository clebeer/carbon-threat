import { apiClient } from './client';

export type AutomationMode = 'AUTO_CREATE_PR' | 'REQUIRE_APPROVAL';
export type JulesStatus = 'pending' | 'planning' | 'awaiting_approval' | 'running' | 'done' | 'error';

export interface JulesSource {
  name: string;
  displayName?: string;
}

export interface JulesSession {
  id: string;
  jules_session_id: string | null;
  finding_id: string;
  finding_type: string;
  source_name: string;
  prompt: string;
  automation_mode: AutomationMode;
  status: JulesStatus;
  plan_summary: string | null;
  pr_url: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface JulesActivity {
  name?: string;
  activityType?: string;
  type?: string;
  message?: string;
  plan?: { description?: string; steps?: Array<{ description?: string }> };
  pullRequest?: { url: string };
  createTime?: string;
}

export interface CreateSessionPayload {
  finding_id: string;
  source_name: string;
  automation_mode: AutomationMode;
  prompt_override?: string;
}

export async function listSources(): Promise<JulesSource[]> {
  const { data } = await apiClient.get<{ sources: JulesSource[] }>('/jules/sources');
  return data.sources ?? [];
}

export async function createSession(payload: CreateSessionPayload): Promise<JulesSession> {
  const { data } = await apiClient.post<{ session: JulesSession }>('/jules/sessions', payload);
  return data.session;
}

export async function listSessions(page = 1, limit = 20): Promise<{ sessions: JulesSession[]; total: number; page: number; limit: number }> {
  const { data } = await apiClient.get('/jules/sessions', { params: { page, limit } });
  return data;
}

export async function getSession(id: string): Promise<{ session: JulesSession; activities: JulesActivity[] }> {
  const { data } = await apiClient.get(`/jules/sessions/${id}`);
  return data;
}

export async function approvePlan(id: string): Promise<JulesSession> {
  const { data } = await apiClient.post<{ session: JulesSession }>(`/jules/sessions/${id}/approve`);
  return data.session;
}

export async function sendMessage(id: string, message: string): Promise<void> {
  await apiClient.post(`/jules/sessions/${id}/message`, { message });
}

export async function deleteSession(id: string): Promise<void> {
  await apiClient.delete(`/jules/sessions/${id}`);
}

// ── Integration config & connection test ───────────────────────────────────

export interface JulesConnectionTestResult {
  success: boolean;
  error?: string;
  sourceCount?: number;
}

export interface JulesIntegrationStatus {
  configured: boolean;
  enabled: boolean;
  connected: boolean;
}

/**
 * Tests a Jules API key by calling the sources endpoint.
 * Admin only. The key is NOT stored — just validated.
 */
export async function testConnection(apiKey: string): Promise<JulesConnectionTestResult> {
  const { data } = await apiClient.post<JulesConnectionTestResult>('/integrations/jules/test', { apiKey });
  return data;
}

/**
 * Returns whether Jules integration is configured, enabled, and reachable.
 * Available to all authenticated users (used for menu visibility).
 */
export async function getJulesStatus(): Promise<JulesIntegrationStatus> {
  const { data } = await apiClient.get<JulesIntegrationStatus>('/jules/status');
  return data;
}
