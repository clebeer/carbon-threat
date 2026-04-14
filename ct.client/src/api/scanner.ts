/**
 * OSV Scanner API client
 *
 * Typed wrappers around the /api/scanner/* endpoints.
 * All requests are authenticated via the shared apiClient (Bearer token injected
 * by the request interceptor in client.ts).
 */

import { apiClient } from './client';

// ── Shared types ──────────────────────────────────────────────────────────────

export type ScanType   = 'lockfile' | 'sbom' | 'manual' | 'git' | 'container';
export type ScanStatus = 'pending' | 'running' | 'complete' | 'error';
export type Severity   = 'Critical' | 'High' | 'Medium' | 'Low';

export interface ScanRun {
  id: string;
  name: string;
  scan_type: ScanType;
  status: ScanStatus;
  source_filename?: string;
  lockfile_type?: string;
  packages_scanned: number;
  vulns_found: number;
  error_message?: string;
  created_by?: string;
  created_by_email?: string;
  created_by_name?: string;
  started_at?: string;
  finished_at?: string;
  created_at: string;
}

export interface ScanFinding {
  id: string;
  scan_id: string;
  package_name: string;
  package_version?: string;
  ecosystem?: string;
  vuln_id: string;
  title?: string;
  description?: string;
  severity?: Severity;
  cvss_score?: number;
  stride_categories: string[];
  fixed_version?: string;
  affected_versions: unknown[];
  references: string[];
  is_ignored: boolean;
  created_at: string;
}

export interface ScannerPolicy {
  id?: string;
  ignored_vuln_ids: string[];
  severity_threshold: Severity;
  auto_enrich_threats: boolean;
  updated_at?: string;
}

export interface ManualPackage {
  name: string;
  version: string;
  ecosystem: string;
}

export interface CreateScanResponse {
  scan: ScanRun;
  packagesDetected: number;
}

export interface FindingsResponse {
  scan: ScanRun;
  findings: ScanFinding[];
  bySeverity: Partial<Record<Severity, number>>;
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function listScans(): Promise<{ scans: ScanRun[] }> {
  const { data } = await apiClient.get<{ scans: ScanRun[] }>('/scanner/scans');
  return data;
}

export async function createLockfileScan(
  name: string,
  filename: string,
  content: string
): Promise<CreateScanResponse> {
  const { data } = await apiClient.post<CreateScanResponse>('/scanner/scans', {
    name,
    scan_type:       'lockfile',
    source_filename: filename,
    content,
  });
  return data;
}

export async function createSbomScan(
  name: string,
  filename: string,
  content: string
): Promise<CreateScanResponse> {
  const { data } = await apiClient.post<CreateScanResponse>('/scanner/scans', {
    name,
    scan_type:       'sbom',
    source_filename: filename,
    content,
  });
  return data;
}

export async function createManualScan(
  name: string,
  packages: ManualPackage[]
): Promise<CreateScanResponse> {
  const { data } = await apiClient.post<CreateScanResponse>('/scanner/scans', {
    name,
    scan_type: 'manual',
    packages,
  });
  return data;
}

export async function createGitScan(
  name: string,
  repoUrl: string
): Promise<CreateScanResponse> {
  const { data } = await apiClient.post<CreateScanResponse>('/scanner/scans', {
    name,
    scan_type: 'git',
    repo_url:  repoUrl,
  });
  return data;
}

export async function createContainerScan(
  name: string,
  imageName: string
): Promise<CreateScanResponse> {
  const { data } = await apiClient.post<CreateScanResponse>('/scanner/scans', {
    name,
    scan_type:  'container',
    image_name: imageName,
  });
  return data;
}

export async function getScan(id: string): Promise<{ scan: ScanRun }> {
  const { data } = await apiClient.get<{ scan: ScanRun }>(`/scanner/scans/${id}`);
  return data;
}

export async function getScanFindings(id: string): Promise<FindingsResponse> {
  const { data } = await apiClient.get<FindingsResponse>(`/scanner/scans/${id}/findings`);
  return data;
}

export async function deleteScan(id: string): Promise<void> {
  await apiClient.delete(`/scanner/scans/${id}`);
}

export async function getScannerPolicy(): Promise<{ policy: ScannerPolicy }> {
  const { data } = await apiClient.get<{ policy: ScannerPolicy }>('/scanner/policy');
  return data;
}

export async function updateScannerPolicy(
  patch: Partial<Pick<ScannerPolicy, 'ignored_vuln_ids' | 'severity_threshold' | 'auto_enrich_threats'>>
): Promise<{ policy: ScannerPolicy }> {
  const { data } = await apiClient.put<{ policy: ScannerPolicy }>('/scanner/policy', patch);
  return data;
}

/**
 * Download scan findings as a file.
 * Uses the authenticated apiClient so the Bearer token is included,
 * then triggers a browser download via a temporary object URL.
 */
export async function downloadScanExport(
  scanId: string,
  format: 'json' | 'csv' | 'markdown'
): Promise<void> {
  const response = await apiClient.get(`/scanner/scans/${scanId}/export`, {
    params:       { format },
    responseType: 'blob',
    timeout:      60_000,
  });
  const ext      = format === 'markdown' ? 'md' : format;
  const blobUrl  = URL.createObjectURL(response.data as Blob);
  const anchor   = document.createElement('a');
  anchor.href     = blobUrl;
  anchor.download = `scan-${scanId}.${ext}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(blobUrl);
}
