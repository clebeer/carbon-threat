/* ============================================================================
   Carbon Dojo — domain model (V2)
   Hierarchy: Organization → BusinessUnit → Product → Engagement → Assessment → Finding
   ========================================================================== */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingStatus = 'triage' | 'active' | 'resolved' | 'false_positive' | 'risk_accepted';
export type SlaState = 'on_track' | 'at_risk' | 'breached';
export type FindingSource = 'web' | 'file' | 'scanner';

export type EngagementType = 'pentest' | 'scan' | 'bug bounty' | 'red team';
export type EngagementStatus = 'planned' | 'active' | 'completed';

export type Role = 'Admin' | 'Red Team Manager' | 'Red Team Analyst' | 'Dev Owner' | 'Reader';

export interface Organization { id: string; name: string; }
export interface BusinessUnit { id: string; orgId: string; name: string; productCount: number; }
export interface Product { id: string; businessUnitId: string; name: string; findingCount: number; }

export interface Engagement {
  id: string;
  productId: string;
  name: string;
  type: EngagementType;
  status: EngagementStatus;
  jiraProject: string;
}

export interface Finding {
  id: string;
  productId: string;
  assessmentId?: string;
  title: string;
  severity: Severity;
  status: FindingStatus;
  sla: SlaState;
  source: FindingSource;
  cve: string;
  cwe: string;
  cvss: string;
  description: string;
  remediation: string;
  jiraKey?: string;
}

export interface Connector {
  id: string;
  name: string;
  type: 'jira';
  edition: 'cloud' | 'data center';
  baseUrl: string;
  email: string;
  projectKey: string;
  issueType: string;
  status: 'enabled' | 'disabled';
  /** Secret is write-only; API returns only whether it is set. */
  secretSet: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: 'active' | 'disabled';
}

export type ImportFormat = 'SARIF' | 'Burp' | 'ZAP' | 'Nessus' | 'Nuclei' | 'Semgrep' | 'Trivy' | 'OSV';
export type ImportJobState = 'idle' | 'queued' | 'processing' | 'done' | 'error';
export interface ImportJob {
  state: ImportJobState;
  created: number;
  updated: number;
  reopened: number;
  errors: number;
}

// ── Presentation helpers (map enums → labels; colors come from CSS classes) ──

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export function severityLabel(s: Severity): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function slaLabel(s: SlaState): string {
  return s === 'on_track' ? 'On track' : s === 'at_risk' ? 'At risk' : 'Breached';
}

/** CSS class that sets `--_c` to the severity hue (see carbon.css). */
export function sevClass(s: Severity): string {
  return `sev-${s}`;
}

/** CSS class that sets `--_c` to the SLA hue and switches to SLA alpha. */
export function slaClass(s: SlaState): string {
  return `cd-sla sla-${s}`;
}
