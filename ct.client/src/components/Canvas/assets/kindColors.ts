import type { Node } from 'reactflow';

export const KIND_COLORS: Record<string, string> = {
  // Generic (cyan)
  db: 'var(--icon-generic)', server: 'var(--icon-generic)', fw: 'var(--icon-generic)',
  user: 'var(--icon-generic)', api: 'var(--icon-generic)', cloud: 'var(--icon-generic)',
  browser: 'var(--icon-generic)',
  // Network (green)
  router: 'var(--icon-network)', switch: 'var(--icon-network)', loadbalancer: 'var(--icon-network)',
  vpn: 'var(--icon-security)', dns: 'var(--icon-network)', proxy: 'var(--icon-network)',
  waf: 'var(--icon-security)', ids: 'var(--icon-security)', siem: 'var(--icon-security)',
  endpoint: 'var(--icon-network)', mobile: 'var(--icon-network)', iot: 'var(--icon-network)',
  printer: 'var(--icon-network)', bridge: 'var(--icon-network)',
  hub: 'var(--icon-network)', 'access-point': 'var(--icon-network)', laptop: 'var(--icon-network)',
  nas: 'var(--icon-network)', hypervisor: 'var(--icon-cloud)', 'nat-gateway': 'var(--icon-security)',
  bastion: 'var(--icon-security)',
  // Cloud (blue)
  'k8s-cluster': 'var(--icon-cloud)', container: 'var(--icon-cloud)', registry: 'var(--icon-cloud)',
  cdn: 'var(--icon-cloud)', 'api-gateway': 'var(--icon-cloud)', 'service-mesh': 'var(--icon-cloud)',
  queue: 'var(--icon-cloud)', cache: 'var(--icon-cloud)', monitoring: 'var(--icon-cloud)',
  vault: 'var(--icon-security)', iam: 'var(--icon-security)', gitops: 'var(--icon-cloud)',
  backup: 'var(--icon-cloud)',
  // GCP (GCP blue)
  gce: 'var(--icon-gcp)', gcs: 'var(--icon-gcp)', 'cloud-run': 'var(--icon-gcp)',
  pubsub: 'var(--icon-gcp)', 'cloud-armor': 'var(--icon-gcp)', firestore: 'var(--icon-gcp)',
  // AWS (orange)
  ec2: '#FF9900', s3: '#3F8624', rds: '#C925D1', lambda: '#FF9900', vpc: '#DD344C',
  cloudfront: '#8C4FFF', alb: '#8C4FFF', dynamodb: '#4081D4', sqs: '#DD344C',
  eks: '#FF9900', 'waf-aws': '#DD344C', 'aws-iam': '#DD344C', cloudwatch: '#8C4FFF',
  guardduty: '#DD344C', sns: '#DD344C', elasticache: '#DD344C', 'api-gw-aws': '#DD344C',
  'secrets-manager': '#DD344C',
  // Azure (blue)
  vm: '#0078D4', 'blob-storage': '#0078D4', 'sql-database': '#0078D4',
  'azure-functions': '#0078D4', vnet: '#0078D4', 'app-gateway': '#0078D4',
  'api-management': '#0078D4', 'cosmos-db': '#50B7E0', 'service-bus': '#0078D4',
  aks: '#0078D4', 'redis-cache': '#DD344C', 'azure-firewall': '#0078D4',
  sentinel: '#0078D4', 'azure-monitor': '#50B7E0', 'entra-id': '#0078D4',
  'key-vault': '#0078D4', 'front-door': '#0078D4',
  // OCI (Oracle Cloud — red)
  'oci-compartment': '#C74634', 'oci-vault': '#C74634',
  'oci-db': '#C74634', 'oci-k8s': '#C74634',
  'oci-object-storage': '#C74634', 'oci-lb': '#C74634',
  'oci-waf': '#C74634', 'oci-iam': '#C74634',
  // Alibaba Cloud (orange)
  'ali-ecs': '#FF6A00', 'ali-oss': '#FF6A00',
  'ali-rds': '#FF6A00', 'ali-slb': '#FF6A00',
  'ali-k8s': '#FF6A00', 'ali-waf': '#FF6A00',
  'ali-ram': '#FF6A00', 'ali-kms': '#FF6A00',
  // Trust boundary
  'trust-boundary': '#f59e0b',
};

/** Fallback hex colors for MiniMap (SVG canvas can't resolve CSS vars) */
export const MINIMAP_COLOR_FALLBACK: Record<string, string> = {
  db: '#00f2ff', server: '#00f2ff', fw: '#00f2ff', user: '#00f2ff',
  api: '#00f2ff', cloud: '#00f2ff', browser: '#00f2ff',
  router: '#22c55e', switch: '#22c55e', loadbalancer: '#3b82f6', vpn: '#f59e0b',
  dns: '#8b5cf6', proxy: '#64748b', waf: '#ef4444', ids: '#f97316', siem: '#06b6d4',
  endpoint: '#94a3b8', mobile: '#94a3b8', iot: '#a855f7', printer: '#64748b', bridge: '#22c55e',
  hub: '#22c55e', 'access-point': '#22c55e', laptop: '#94a3b8', nas: '#64748b',
  hypervisor: '#3b82f6', 'nat-gateway': '#f59e0b', bastion: '#f59e0b',
  'k8s-cluster': '#326CE5', container: '#2496ED', registry: '#2496ED', cdn: '#f97316',
  'api-gateway': '#f59e0b', 'service-mesh': '#2dd4bf', queue: '#6366f1', cache: '#dc2626',
  monitoring: '#10b981', vault: '#f59e0b', iam: '#8b5cf6', gitops: '#f97316', backup: '#64748b',
  gce: '#4285F4', gcs: '#4285F4', 'cloud-run': '#4285F4', pubsub: '#EA4335',
  'cloud-armor': '#EA4335', firestore: '#FBBC04',
  // AWS
  ec2: '#FF9900', s3: '#3F8624', rds: '#C925D1', lambda: '#FF9900', vpc: '#DD344C',
  cloudfront: '#8C4FFF', alb: '#8C4FFF', dynamodb: '#4081D4', sqs: '#DD344C',
  eks: '#FF9900', 'waf-aws': '#DD344C', 'aws-iam': '#DD344C', cloudwatch: '#8C4FFF',
  guardduty: '#DD344C', sns: '#DD344C', elasticache: '#DD344C', 'api-gw-aws': '#DD344C',
  'secrets-manager': '#DD344C',
  // Azure
  vm: '#0078D4', 'blob-storage': '#0078D4', 'sql-database': '#0078D4',
  'azure-functions': '#0078D4', vnet: '#0078D4', 'app-gateway': '#0078D4',
  'api-management': '#0078D4', 'cosmos-db': '#50B7E0', 'service-bus': '#0078D4',
  aks: '#0078D4', 'redis-cache': '#DD344C', 'azure-firewall': '#0078D4',
  sentinel: '#0078D4', 'azure-monitor': '#50B7E0', 'entra-id': '#0078D4',
  'key-vault': '#0078D4', 'front-door': '#0078D4',
  // OCI
  'oci-compartment': '#C74634', 'oci-vault': '#C74634',
  'oci-db': '#C74634', 'oci-k8s': '#C74634',
  'oci-object-storage': '#C74634', 'oci-lb': '#C74634',
  'oci-waf': '#C74634', 'oci-iam': '#C74634',
  // Alibaba Cloud
  'ali-ecs': '#FF6A00', 'ali-oss': '#FF6A00',
  'ali-rds': '#FF6A00', 'ali-slb': '#FF6A00',
  'ali-k8s': '#FF6A00', 'ali-waf': '#FF6A00',
  'ali-ram': '#FF6A00', 'ali-kms': '#FF6A00',
  // Trust boundary
  'trust-boundary': '#f59e0b',
};

/** MiniMap nodeColor callback — returns a hex color by asset category */
export function miniMapNodeColor(node: Node<{ kind?: string }>): string {
  const kind = node.data?.kind ?? 'server';
  return MINIMAP_COLOR_FALLBACK[kind] ?? '#00f2ff';
}