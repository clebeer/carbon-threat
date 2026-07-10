/* ============================================================================
   Carbon Dojo — data access layer (V2).
   Currently backed by in-memory seed fixtures; each function is shaped like the
   future REST endpoint so swapping to apiClient.get('/api/v1/...') is a one-liner.
   ========================================================================== */
import { useQuery } from '@tanstack/react-query';
import {
  AdminUser, BusinessUnit, Connector, Engagement, Finding, FindingStatus, Organization, Product, Severity, SlaState,
} from '../domain/types';
import {
  ADMIN_USERS, BUSINESS_UNITS, CONNECTORS, ENGAGEMENTS, FINDINGS, ORGS, PRODUCTS,
} from '../domain/seed';

// Simulate network latency so loading states are exercised.
function resolve<T>(data: T, ms = 120): Promise<T> {
  return new Promise((r) => setTimeout(() => r(data), ms));
}

export interface FindingFilters {
  productId?: string;
  severity?: Severity | 'all';
  status?: FindingStatus | 'all';
}

export function listFindings(filters: FindingFilters = {}): Promise<Finding[]> {
  const out = FINDINGS.filter(
    (f) =>
      (!filters.productId || f.productId === filters.productId) &&
      (!filters.severity || filters.severity === 'all' || f.severity === filters.severity) &&
      (!filters.status || filters.status === 'all' || f.status === filters.status),
  );
  return resolve(out);
}
export function getFinding(id: string): Promise<Finding | undefined> {
  return resolve(FINDINGS.find((f) => f.id === id));
}
export function listEngagements(): Promise<Engagement[]> { return resolve(ENGAGEMENTS); }
export function listOrgs(): Promise<Organization[]> { return resolve(ORGS); }
export function listBusinessUnits(orgId?: string): Promise<BusinessUnit[]> {
  return resolve(BUSINESS_UNITS.filter((b) => !orgId || b.orgId === orgId));
}
export function listProducts(businessUnitId?: string): Promise<Product[]> {
  return resolve(PRODUCTS.filter((p) => !businessUnitId || p.businessUnitId === businessUnitId));
}
export function listConnectors(): Promise<Connector[]> { return resolve(CONNECTORS); }
export function listAdminUsers(): Promise<AdminUser[]> { return resolve(ADMIN_USERS); }

// ── React Query hooks ────────────────────────────────────────────────────────
export function useFindings(filters: FindingFilters = {}) {
  return useQuery({ queryKey: ['findings', filters], queryFn: () => listFindings(filters) });
}
export function useFinding(id: string | undefined) {
  return useQuery({ queryKey: ['finding', id], queryFn: () => getFinding(id!), enabled: !!id });
}
export function useEngagements() {
  return useQuery({ queryKey: ['engagements'], queryFn: listEngagements });
}
export function useOrgs() { return useQuery({ queryKey: ['orgs'], queryFn: listOrgs }); }
export function useBusinessUnits(orgId?: string) {
  return useQuery({ queryKey: ['bus', orgId], queryFn: () => listBusinessUnits(orgId) });
}
export function useProducts(businessUnitId?: string) {
  return useQuery({ queryKey: ['products', businessUnitId], queryFn: () => listProducts(businessUnitId) });
}
export function useConnectors() { return useQuery({ queryKey: ['connectors'], queryFn: listConnectors }); }
export function useAdminUsers() { return useQuery({ queryKey: ['adminUsers'], queryFn: listAdminUsers }); }

// ── Dashboard aggregation (derived client-side from findings) ────────────────
export interface DashboardData {
  total: number;
  bySeverity: Record<Severity, number>;
  bySla: Record<SlaState, number>;
  inTriage: number;
}
export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const findings = await listFindings();
      const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      const bySla: Record<SlaState, number> = { on_track: 0, at_risk: 0, breached: 0 };
      let inTriage = 0;
      findings.forEach((f) => {
        bySeverity[f.severity]++;
        bySla[f.sla]++;
        if (f.status === 'triage') inTriage++;
      });
      return { total: findings.length, bySeverity, bySla, inTriage };
    },
  });
}
