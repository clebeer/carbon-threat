/**
 * MITRE ATT&CK Framework API client
 *
 * Typed wrappers around the /api/attack/* endpoints.
 * Bearer token is injected automatically by the shared apiClient interceptor.
 */

import { apiClient } from './client';

// ── Shared types ──────────────────────────────────────────────────────────────

export type AttackObjectType =
  | 'tactic'
  | 'technique'
  | 'sub-technique'
  | 'group'
  | 'mitigation'
  | 'software';

export type SyncStatus = 'pending' | 'running' | 'complete' | 'error';
export type Confidence = 'high' | 'medium' | 'low';

export interface KillChainPhase {
  kill_chain_name: string;
  phase_name:      string;
}

export interface AttackObject {
  id:                string;
  attack_id:         string;
  type:              AttackObjectType;
  name:              string;
  description?:      string;
  platforms:         string[];
  kill_chain_phases: KillChainPhase[];
  aliases:           string[];
  parent_id?:        string;
  url?:              string;
  stix_id?:          string;
  is_deprecated:     boolean;
  is_revoked:        boolean;
  extra:             Record<string, unknown>;
  created_at:        string;
  updated_at:        string;
}

export interface AttackTactic extends AttackObject {
  type: 'tactic';
  // analysis enrichment fields
  covered?:                  boolean;
  relatedStrideCategories?:  string[];
  relatedThreatCount?:       number;
  mappingCount?:             number;
}

export interface AttackTechnique extends AttackObject {
  type: 'technique' | 'sub-technique';
  subTechniques?: AttackObject[];
  mitigations?:   AttackObject[];
  groups?:        Pick<AttackObject, 'id' | 'attack_id' | 'name'>[];
}

export interface SyncLog {
  id:                  string;
  domain:              string;
  attack_version?:     string;
  objects_synced:      number;
  relationships_synced: number;
  status:              SyncStatus;
  error_message?:      string;
  triggered_by?:       string;
  started_at:          string;
  finished_at?:        string;
}

export interface SyncStatusResponse {
  lastSync:     SyncLog | null;
  totalObjects: number;
  isSynced:     boolean;
}

export interface ThreatMapping {
  id:                   string;
  threat_id?:           string;
  technique_id:         string;
  model_id?:            string;
  confidence:           Confidence;
  notes?:               string;
  created_at:           string;
  technique_attack_id:  string;
  technique_name:       string;
  technique_type:       AttackObjectType;
  technique_url?:       string;
  kill_chain_phases:    KillChainPhase[];
  threat_title?:        string;
  threat_stride?:       string;
  mapped_by_name?:      string;
}

export interface CoverageRecommendation {
  threat_id:       string;
  threat_title:    string;
  stride_category: string;
  tactic_id:       string;
  tactic_name:     string;
}

export interface CoverageAnalysis {
  modelId:         string;
  threats:         unknown[];
  tactics:         AttackTactic[];
  mappings:        ThreatMapping[];
  coverageScore:   number;
  coveredCount:    number;
  totalTactics:    number;
  recommendations: CoverageRecommendation[];
}

export interface ReportSummary {
  totalThreats:   number;
  totalTactics:   number;
  coveredTactics: number;
  coverageScore:  number;
  totalMappings:  number;
}

export interface AttackReport {
  generatedAt: string;
  model:       { id: string; title: string; created_at: string };
  summary:     ReportSummary;
  tactics:     AttackTactic[];
  mappings:    ThreatMapping[];
  threats:     unknown[];
  recommendations: CoverageRecommendation[];
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function getSyncStatus(): Promise<SyncStatusResponse> {
  const { data } = await apiClient.get<SyncStatusResponse>('/attack/status');
  return data;
}

export async function triggerSync(): Promise<{ message: string; syncId: string }> {
  const { data } = await apiClient.post<{ message: string; syncId: string }>('/attack/sync');
  return data;
}

export async function listTactics(): Promise<{ tactics: AttackTactic[] }> {
  const { data } = await apiClient.get<{ tactics: AttackTactic[] }>('/attack/tactics');
  return data;
}

export async function listTechniques(params?: {
  tactic?:  string;
  search?:  string;
  type?:    string;
  limit?:   number;
  offset?:  number;
}): Promise<{ techniques: AttackTechnique[]; total: number }> {
  const { data } = await apiClient.get<{ techniques: AttackTechnique[]; total: number }>(
    '/attack/techniques',
    { params }
  );
  return data;
}

export async function getTechniqueDetails(attackId: string): Promise<{ technique: AttackTechnique }> {
  const { data } = await apiClient.get<{ technique: AttackTechnique }>(
    `/attack/techniques/${attackId}`
  );
  return data;
}

export async function listGroups(params?: {
  search?: string;
  limit?:  number;
  offset?: number;
}): Promise<{ groups: AttackObject[]; total: number }> {
  const { data } = await apiClient.get<{ groups: AttackObject[]; total: number }>(
    '/attack/groups',
    { params }
  );
  return data;
}

export async function listMitigations(params?: {
  search?: string;
  limit?:  number;
  offset?: number;
}): Promise<{ mitigations: AttackObject[]; total: number }> {
  const { data } = await apiClient.get<{ mitigations: AttackObject[]; total: number }>(
    '/attack/mitigations',
    { params }
  );
  return data;
}

export async function analyzeModelCoverage(modelId: string): Promise<CoverageAnalysis> {
  const { data } = await apiClient.get<CoverageAnalysis>(`/attack/analysis/${modelId}`);
  return data;
}

export async function listMappings(params?: {
  modelId?:  string;
  threatId?: string;
}): Promise<{ mappings: ThreatMapping[] }> {
  const { data } = await apiClient.get<{ mappings: ThreatMapping[] }>(
    '/attack/mappings',
    { params }
  );
  return data;
}

export async function createThreatMapping(payload: {
  threat_id?:   string;
  technique_id: string;
  model_id?:    string;
  confidence?:  Confidence;
  notes?:       string;
}): Promise<{ mapping: ThreatMapping }> {
  const { data } = await apiClient.post<{ mapping: ThreatMapping }>(
    '/attack/mappings',
    payload
  );
  return data;
}

export async function deleteThreatMapping(id: string): Promise<void> {
  await apiClient.delete(`/attack/mappings/${id}`);
}

export async function getReport(modelId: string): Promise<{ report: AttackReport }> {
  const { data } = await apiClient.get<{ report: AttackReport }>(
    `/attack/reports/${modelId}`
  );
  return data;
}

export async function downloadReport(
  modelId: string,
  format: 'json' | 'markdown'
): Promise<void> {
  const response = await apiClient.get(`/attack/reports/${modelId}/export`, {
    params:       { format },
    responseType: 'blob',
    timeout:      60_000,
  });
  const ext     = format === 'markdown' ? 'md' : format;
  const blobUrl = URL.createObjectURL(response.data as Blob);
  const anchor  = document.createElement('a');
  anchor.href     = blobUrl;
  anchor.download = `attack-report-${modelId}.${ext}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(blobUrl);
}
