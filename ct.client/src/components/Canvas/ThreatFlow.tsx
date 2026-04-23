import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
  type Connection,
  getBezierPath,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { toPng, toSvg } from 'html-to-image';
import { getThreatModel, updateThreatModel } from '../../api/threatmodels';
import { suggestThreats, type ThreatSuggestion } from '../../api/ai';
import { useQuery } from '@tanstack/react-query';
import { listPacks, type DomainPack } from '../../api/domainPacks';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import ThreatPanel from './ThreatPanel';
import DomainSelector from './DomainSelector';

// ── Theme hook ────────────────────────────────────────────────────────────────

function useTheme() {
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('ct_theme') as 'dark' | 'light') ?? 'dark';
  });

  const setTheme = useCallback((t: 'dark' | 'light') => {
    setThemeState(t);
    localStorage.setItem('ct_theme', t);
    document.body.classList.toggle('theme-light', t === 'light');
  }, []);

  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  return { theme, setTheme, toggle };
}

// ── Default node icons (generic pack fallback) ────────────────────────────────

const DefaultIcons: Record<string, React.ReactNode> = {
  db:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  server:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/></svg>,
  fw:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  user:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M20 21v-2a7 7 0 0 0-14 0v2"/></svg>,
  api:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 2l-4 5-4-5"/><line x1="12" y1="12" x2="12" y2="17"/></svg>,
  cloud:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>,
  browser: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="8" y1="3" x2="8" y2="9"/></svg>,
  // Network infrastructure
  router:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  switch:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="14" x2="20" y2="14"/></svg>,
  loadbalancer: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5"><path d="M12 2l8 4v4l-8 4-8-4V6l8-4z"/><path d="M4 14l8 4 8-4"/><path d="M4 18l8 4 8-4"/></svg>,
  vpn:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>,
  dns:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M12 8v8"/><path d="M9 11h6"/></svg>,
  proxy:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5"><path d="M2 12h6l3-4 3 8 3-4h5"/><path d="M20 12l-3-3"/><path d="M20 12l-3 3"/></svg>,
  waf:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="10" y1="16" x2="14" y2="16"/></svg>,
  ids:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  siem:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18"/><path d="M7 14l3-4 3 6 3-3 4 1"/></svg>,
  endpoint: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><rect x="4" y="5" width="12" height="10"/><path d="M8 15h4v3H8z"/><line x1="6" y1="18" x2="14" y2="18"/></svg>,
  mobile:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="10" y1="18" x2="14" y2="18"/></svg>,
  iot:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>,
  printer: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5"><path d="M6 9V2h12v7"/><rect x="6" y="14" width="12" height="8"/></svg>,
  bridge:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5"><path d="M2 12h5l2-4 2 8 2-4h7"/></svg>,
  // Cloud infrastructure
  'k8s-cluster': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#326CE5" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18"/><line x1="7" y1="3" x2="7" y2="21"/><line x1="17" y1="3" x2="17" y2="21"/><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="17" x2="21" y2="17"/></svg>,
  container: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2496ED" strokeWidth="1.5"><path d="M2 6h20v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/><path d="M6 6V3h12v3"/></svg>,
  registry: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2496ED" strokeWidth="1.5"><rect x="4" y="4" width="4" height="16"/><rect x="10" y="4" width="4" height="16"/><rect x="16" y="4" width="4" height="16"/></svg>,
  cdn:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2c-3 3-3 17 0 20"/><path d="M12 2c3 3 3 17 0 20"/></svg>,
  'api-gateway': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5"><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>,
  'service-mesh': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 12l10 5 10-5"/><path d="M2 17l10 5 10-5"/></svg>,
  queue:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5"><rect x="3" y="5" width="4" height="14"/><rect x="9" y="5" width="4" height="14"/><rect x="15" y="5" width="4" height="14"/></svg>,
  cache:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12v6a9 3 0 0 1-18 0v-6"/><path d="M12 8v4"/><path d="M10 10h4"/></svg>,
  monitoring: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18"/><path d="M7 14l3-5 3 3 4-6"/></svg>,
  vault:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/><path d="M9 12l2 2 4-4"/></svg>,
  iam:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>,
  gitops:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5"><circle cx="12" cy="12" r="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>,
  backup:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5a9 3 0 0 0 18 0"/><path d="M3 12a9 3 0 0 0 18 0"/><path d="M12 8v6"/><path d="M9 11l3 3 3-3"/></svg>,
  // GCP
  gce:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16"/><rect x="8" y="8" width="8" height="8"/></svg>,
  gcs:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5a9 3 0 0 0 18 0"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>,
  'cloud-run': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  pubsub:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EA4335" strokeWidth="1.5"><rect x="3" y="5" width="4" height="14"/><rect x="9" y="5" width="4" height="14"/><rect x="15" y="5" width="4" height="14"/></svg>,
  'cloud-armor': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EA4335" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>,
  firestore: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FBBC04" strokeWidth="1.5"><path d="M4 20V4h4l4 8-4 8H4z"/><path d="M10 20l4-8-4-8h10v16H10z"/></svg>,
  // AWS
  ec2:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF9900" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16"/><rect x="8" y="8" width="8" height="8"/></svg>,
  s3:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3F8624" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5a9 3 0 0 0 18 0"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>,
  rds:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C925D1" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>,
  lambda:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF9900" strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  vpc:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DD344C" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18"/><rect x="6" y="6" width="12" height="12"/></svg>,
  cloudfront: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8C4FFF" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2c-3 3-3 17 0 20"/><path d="M12 2c3 3 3 17 0 20"/></svg>,
  alb:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8C4FFF" strokeWidth="1.5"><path d="M12 2l8 4v4l-8 4-8-4V6l8-4z"/><path d="M4 14l8 4 8-4"/><path d="M4 18l8 4 8-4"/></svg>,
  dynamodb: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4081D4" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5a9 3 0 0 0 18 0"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>,
  sqs:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DD344C" strokeWidth="1.5"><rect x="3" y="5" width="4" height="14"/><rect x="9" y="5" width="4" height="14"/><rect x="15" y="5" width="4" height="14"/></svg>,
  eks:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF9900" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18"/><line x1="7" y1="3" x2="7" y2="21"/><line x1="17" y1="3" x2="17" y2="21"/><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="17" x2="21" y2="17"/></svg>,
  'waf-aws': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DD344C" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>,
  'aws-iam': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DD344C" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>,
  cloudwatch: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8C4FFF" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18"/><path d="M7 14l3-5 3 3 4-6"/></svg>,
  guardduty: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DD344C" strokeWidth="1.5"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/></svg>,
  // Azure
  vm:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0078D4" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16"/><rect x="8" y="8" width="8" height="8"/></svg>,
  'blob-storage': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0078D4" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5a9 3 0 0 0 18 0"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>,
  'sql-database': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0078D4" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>,
  'azure-functions': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0078D4" strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  'app-gateway': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0078D4" strokeWidth="1.5"><path d="M12 2l8 4v4l-8 4-8-4V6l8-4z"/><path d="M4 14l8 4 8-4"/><path d="M4 18l8 4 8-4"/></svg>,
  'cosmos-db': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#50B7E0" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5a9 3 0 0 0 18 0"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>,
  'service-bus': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0078D4" strokeWidth="1.5"><rect x="3" y="5" width="4" height="14"/><rect x="9" y="5" width="4" height="14"/><rect x="15" y="5" width="4" height="14"/></svg>,
  aks:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0078D4" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18"/><line x1="7" y1="3" x2="7" y2="21"/><line x1="17" y1="3" x2="17" y2="21"/><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="17" x2="21" y2="17"/></svg>,
  'azure-firewall': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0078D4" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  'entra-id': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0078D4" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>,
  'front-door': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0078D4" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2c-3 3-3 17 0 20"/><path d="M12 2c3 3 3 17 0 20"/></svg>,
  // Trust boundary
  'trust-boundary': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2"><rect x="2" y="2" width="20" height="20" rx="4"/><line x1="7" y1="2" x2="7" y2="7"/><line x1="2" y1="7" x2="7" y2="7"/></svg>,
};

const DEFAULT_KIND_LABEL: Record<string, string> = {
  db: 'Database', server: 'Server', fw: 'Firewall', user: 'User / Actor',
  api: 'API Gateway', cloud: 'Cloud Service', browser: 'Web Client',
  // Network
  router: 'Router', switch: 'Switch', loadbalancer: 'Load Balancer',
  vpn: 'VPN Gateway', dns: 'DNS Server', proxy: 'Proxy Server',
  waf: 'Web App Firewall', ids: 'IDS / IPS', siem: 'SIEM',
  endpoint: 'Endpoint', mobile: 'Mobile Device', iot: 'IoT Device',
  printer: 'Network Printer', bridge: 'Network Bridge',
  // Cloud
  'k8s-cluster': 'Kubernetes', container: 'Container', registry: 'Registry',
  cdn: 'CDN', 'api-gateway': 'API Gateway', 'service-mesh': 'Service Mesh',
  queue: 'Message Queue', cache: 'Cache Layer', monitoring: 'Monitoring',
  vault: 'Secrets Vault', iam: 'IAM / Identity', gitops: 'GitOps / CI-CD',
  backup: 'Backup Storage',
  // GCP
  gce: 'Compute Engine', gcs: 'Cloud Storage', 'cloud-run': 'Cloud Run',
  pubsub: 'Pub/Sub', 'cloud-armor': 'Cloud Armor', firestore: 'Firestore',
  // AWS
  ec2: 'EC2 Instance', s3: 'S3 Bucket', rds: 'RDS Database', lambda: 'Lambda',
  vpc: 'VPC', cloudfront: 'CloudFront', alb: 'App Load Balancer', dynamodb: 'DynamoDB',
  sqs: 'SQS Queue', eks: 'EKS Cluster', 'waf-aws': 'WAF', 'aws-iam': 'AWS IAM',
  cloudwatch: 'CloudWatch', guardduty: 'GuardDuty', sns: 'SNS Topic',
  elasticache: 'ElastiCache', 'api-gw-aws': 'API Gateway', 'secrets-manager': 'Secrets Mgr',
  // Azure
  vm: 'Virtual Machine', 'blob-storage': 'Blob Storage', 'sql-database': 'SQL Database',
  'azure-functions': 'Functions', vnet: 'Virtual Network', 'app-gateway': 'App Gateway',
  'api-management': 'API Management', 'cosmos-db': 'Cosmos DB', 'service-bus': 'Service Bus',
  aks: 'AKS Cluster', 'redis-cache': 'Azure Cache', 'azure-firewall': 'Azure Firewall',
  sentinel: 'Sentinel', 'azure-monitor': 'Monitor', 'entra-id': 'Entra ID',
  'key-vault': 'Key Vault', 'front-door': 'Front Door',
  // Trust boundary
  'trust-boundary': 'Trust Boundary',
};

// ── Kind → Category color map (MiniMap + theme) ──────────────────────────────

const KIND_COLORS: Record<string, string> = {
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
  // Trust boundary
  'trust-boundary': '#f59e0b',
};

/** MiniMap nodeColor callback — returns a hex color by asset category */
function miniMapNodeColor(node: Node<CyberNodeData>): string {
  const kind = node.data?.kind ?? 'server';
  return MINIMAP_COLOR_FALLBACK[kind] ?? '#00f2ff';
}

// Fallback hex colors for MiniMap (SVG canvas can't resolve CSS vars)
const MINIMAP_COLOR_FALLBACK: Record<string, string> = {
  db: '#00f2ff', server: '#00f2ff', fw: '#00f2ff', user: '#00f2ff',
  api: '#00f2ff', cloud: '#00f2ff', browser: '#00f2ff',
  router: '#22c55e', switch: '#22c55e', loadbalancer: '#3b82f6', vpn: '#f59e0b',
  dns: '#8b5cf6', proxy: '#64748b', waf: '#ef4444', ids: '#f97316', siem: '#06b6d4',
  endpoint: '#94a3b8', mobile: '#94a3b8', iot: '#a855f7', printer: '#64748b', bridge: '#22c55e',
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
  // Trust boundary
  'trust-boundary': '#f59e0b',
};

const DEFAULT_STENCIL: { kind: string; label: string }[] = [
  { kind: 'server', label: 'Server' },
  { kind: 'db',     label: 'Database' },
  { kind: 'fw',     label: 'Firewall' },
  { kind: 'user',   label: 'Actor' },
  { kind: 'api',    label: 'API' },
  { kind: 'cloud',  label: 'Cloud' },
  { kind: 'browser',label: 'Client' },
  // Network assets
  { kind: 'router', label: 'Router' },
  { kind: 'switch', label: 'Switch' },
  { kind: 'loadbalancer', label: 'LB' },
  { kind: 'vpn',    label: 'VPN' },
  { kind: 'dns',    label: 'DNS' },
  { kind: 'waf',    label: 'WAF' },
  { kind: 'ids',    label: 'IDS' },
  { kind: 'siem',   label: 'SIEM' },
  { kind: 'endpoint', label: 'Endpoint' },
  { kind: 'iot',    label: 'IoT' },
  // Cloud assets
  { kind: 'k8s-cluster', label: 'K8s' },
  { kind: 'container', label: 'Container' },
  { kind: 'queue',   label: 'Queue' },
  { kind: 'cache',   label: 'Cache' },
  { kind: 'monitoring', label: 'Monitor' },
  { kind: 'vault',   label: 'Vault' },
  { kind: 'iam',     label: 'IAM' },
  { kind: 'gitops',  label: 'CI/CD' },
  { kind: 'cdn',     label: 'CDN' },
  // Trust boundary
  { kind: 'trust-boundary', label: 'Boundary' },
];

// ── Edge / connection types ──────────────────────────────────────────────────

const EDGE_TYPES_LIST = [
  { type: 'data-flow', label: 'Data Flow', color: 'var(--primary)', icon: '→' },
  { type: 'trust-crossing', label: 'Trust Crossing', color: '#f59e0b', icon: '⇢' },
  { type: 'control-flow', label: 'Control Flow', color: '#22c55e', icon: '⟿' },
] as const;

const EDGE_TYPE_STYLES: Record<string, { stroke: string; strokeDasharray?: string; strokeWidth: number }> = {
  'data-flow':     { stroke: 'var(--primary)', strokeWidth: 2 },
  'trust-crossing': { stroke: '#f59e0b', strokeDasharray: '8 4', strokeWidth: 2 },
  'control-flow':  { stroke: '#22c55e', strokeDasharray: '4 4', strokeWidth: 2 },
};

// ── Domain icon renderer ──────────────────────────────────────────────────────

function DomainIcon({ kind, pack }: { kind: string; pack?: DomainPack | null }) {
  const iconDef = pack?.icon_manifest?.nodeTypes?.[kind];
  if (iconDef) {
    return (
      <svg width="20" height="20" viewBox={iconDef.viewBox ?? '0 0 24 24'} fill="none" stroke={iconDef.color ?? 'currentColor'} strokeWidth="1.5">
        <path d={iconDef.svgPath} />
      </svg>
    );
  }
  return <>{DefaultIcons[kind] ?? DefaultIcons.server}</>;
}

// ── CyberNode ─────────────────────────────────────────────────────────────────

interface CyberNodeData {
  label: string;
  kind: string;
  selected?: boolean;
  highlighted?: boolean;
  packSlug?: string;
}

// Pack is passed via a ref to avoid re-creating nodeTypes on each render
let _activePack: DomainPack | null = null;

const CyberNode = ({ data, id }: NodeProps<CyberNodeData>) => {
  const highlightedNodeIds = useAnalysisStore(s => s.highlightedNodeIds);
  const isHighlighted = highlightedNodeIds.has(id);

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      <div
        className="ct-node"
        style={{
          borderColor: isHighlighted ? 'var(--error)' : data.selected ? 'var(--secondary)' : undefined,
          boxShadow: isHighlighted
            ? '0 0 20px rgba(255,77,79,0.6), 0 0 40px rgba(255,77,79,0.3)'
            : data.selected ? '0 0 18px var(--secondary)' : undefined,
          transition: 'box-shadow 0.2s, border-color 0.2s',
        }}
      >
        <DomainIcon kind={data.kind} pack={_activePack} />
      </div>
      <div className="ct-node-label">{data.label}</div>
      <Handle type="target" position={Position.Top}    style={{ background: 'var(--primary)', width: 8, height: 8, border: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--primary)', width: 8, height: 8, border: 'none' }} />
      <Handle type="source" position={Position.Right}  style={{ background: 'var(--primary)', width: 8, height: 8, border: 'none' }} id="r" />
      <Handle type="target" position={Position.Left}   style={{ background: 'var(--primary)', width: 8, height: 8, border: 'none' }} id="l" />
    </div>
  );
};

// ── Custom edge with label (data flow) ────────────────────────────────────────

function DataFlowEdge({
  id,
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  data,
  style = {},
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const labelText = (data as Record<string, string>)?.label ?? '';

  return (
    <>
      <path id={id} style={style} className="react-flow__edge-path" d={edgePath} markerEnd={markerEnd} />
      {labelText && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect
            x={-labelText.length * 3.2 - 6}
            y={-9}
            width={labelText.length * 6.4 + 12}
            height={18}
            rx={4}
            fill="rgba(15,15,25,0.88)"
            stroke="rgba(0,242,255,0.35)"
            strokeWidth={1}
          />
          <text
            x={0}
            y={1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--primary)"
            fontSize={10}
            fontFamily="var(--font-tech)"
            style={{ pointerEvents: 'all', cursor: 'pointer' }}
          >
            {labelText}
          </text>
        </g>
      )}
    </>
  );
}

const nodeTypes = { cyber: CyberNode };
const edgeTypes = { 'data-flow': DataFlowEdge };

// ── Initial diagram ───────────────────────────────────────────────────────────

const INIT_NODES: Node<CyberNodeData>[] = [
  { id: '1', type: 'cyber', position: { x: 300, y: 150 }, data: { label: 'Web Server', kind: 'server' } },
  { id: '2', type: 'cyber', position: { x: 100, y: 320 }, data: { label: 'Database',   kind: 'db' } },
  { id: '3', type: 'cyber', position: { x: 500, y: 320 }, data: { label: 'Firewall',   kind: 'fw' } },
];

const INIT_EDGES: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'data-flow', animated: true,  style: { stroke: 'var(--primary)',   strokeWidth: 2 }, data: { label: 'SQL' } },
  { id: 'e1-3', source: '1', target: '3', type: 'data-flow', animated: false, style: { stroke: 'var(--secondary)', strokeWidth: 2 }, data: { label: 'HTTPS' } },
];

// ── Auto-layout helper (dagre) ────────────────────────────────────────────────

function layoutWithDagre(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120, marginx: 40, marginy: 40 });

  nodes.forEach((n) => {
    g.setNode(n.id, { width: 100, height: 60 });
  });
  edges.forEach((e) => {
    g.setEdge(e.source, e.target);
  });

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - 50, y: pos.y - 30 },
    };
  });
}

// ── Severity badge ────────────────────────────────────────────────────────────

const SEV_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  High:   { bg: 'rgba(255,77,79,0.12)',  text: 'var(--error)',   border: 'rgba(255,77,79,0.3)' },
  Medium: { bg: 'rgba(250,173,20,0.12)', text: '#faad14',        border: 'rgba(250,173,20,0.3)' },
  Low:    { bg: 'rgba(0,242,255,0.08)',  text: 'var(--primary)', border: 'rgba(0,242,255,0.2)' },
};

function SeverityBadge({ severity }: { severity: string }) {
  const c = SEV_COLORS[severity] ?? SEV_COLORS.Medium;
  return (
    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontWeight: 600, letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
      {severity.toUpperCase()}
    </span>
  );
}

// ── AI Suggestions panel ──────────────────────────────────────────────────────

interface AIPanelProps {
  node: Node<CyberNodeData>;
  onClose: () => void;
  onAccept: (threat: ThreatSuggestion) => void;
}

function AISuggestionsPanel({ node, onClose, onAccept }: AIPanelProps) {
  const [loading, setSuggLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ThreatSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  const kindLabel = DEFAULT_KIND_LABEL[node.data.kind] ?? node.data.kind;

  async function handleAnalyse() {
    setSuggLoading(true);
    setError(null);
    setSuggestions([]);
    setAccepted(new Set());
    setRejected(new Set());
    try {
      const result = await suggestThreats(node.id, node.data.label, node.data.kind);
      setSuggestions(result.suggestions);
    } catch {
      setError('AI service unavailable. Configure a provider in Settings → Integrations.');
    } finally {
      setSuggLoading(false);
    }
  }

  return (
    <div className="glass-panel" style={{ position: 'absolute', top: 0, right: 0, width: '320px', height: '100%', zIndex: 50, display: 'flex', flexDirection: 'column', borderRadius: 0, borderTop: 'none', borderRight: 'none', borderBottom: 'none', borderLeft: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto' }}>
      <div style={{ padding: '18px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--secondary)', marginBottom: '4px' }}>AI THREAT ANALYSIS</div>
          <div style={{ fontSize: '15px', color: '#fff', fontFamily: 'var(--font-tech)' }}>{node.data.label}</div>
          <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', marginTop: '2px' }}>{kindLabel} component</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--on-surface-muted)', width: '24px', height: '24px', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 }}>×</button>
      </div>
      <div style={{ padding: '14px 18px', flexShrink: 0 }}>
        <button onClick={handleAnalyse} disabled={loading} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(179,102,255,0.3)', background: loading ? 'rgba(179,102,255,0.3)' : 'rgba(179,102,255,0.12)', color: 'var(--secondary)', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.5px' }}>
          {loading ? '⟳  Analysing…' : '✦  Run STRIDE Analysis'}
        </button>
      </div>
      {error && (
        <div style={{ margin: '0 18px 14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,77,79,0.08)', border: '1px solid rgba(255,77,79,0.2)', fontSize: '12px', color: 'var(--error)' }}>
          {error}
        </div>
      )}
      {suggestions.length === 0 && !loading && !error && (
        <div style={{ padding: '0 18px', fontSize: '12px', color: 'var(--on-surface-muted)', lineHeight: 1.6 }}>
          Click "Run STRIDE Analysis" to get AI-generated threat suggestions for this component.
        </div>
      )}
      <div style={{ flex: 1, padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {suggestions.map((t: ThreatSuggestion, idx: number) => {
          const isAcc = accepted.has(idx);
          const isRej = rejected.has(idx);
          return (
            <div key={idx} style={{ padding: '12px', borderRadius: '8px', background: isAcc ? 'rgba(0,242,255,0.06)' : isRej ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isAcc ? 'rgba(0,242,255,0.2)' : isRej ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.08)'}`, opacity: isRej ? 0.4 : 1, transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '5px' }}>
                <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>{t.title}</span>
                <SeverityBadge severity={t.severity} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--secondary)', marginBottom: '5px' }}>{t.strideCategory}</div>
              {t.mitigation && <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)', lineHeight: 1.5, marginBottom: '8px' }}>{t.mitigation}</div>}
              {!isAcc && !isRej && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => { setAccepted((s: Set<number>) => new Set(s).add(idx)); onAccept(t); }} style={{ flex: 1, padding: '4px', borderRadius: '4px', border: '1px solid rgba(0,242,255,0.3)', background: 'transparent', color: 'var(--primary)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>Accept</button>
                  <button onClick={() => setRejected((s: Set<number>) => new Set(s).add(idx))} style={{ flex: 1, padding: '4px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--on-surface-muted)', fontSize: '11px', cursor: 'pointer' }}>Dismiss</button>
                </div>
              )}
              {isAcc && <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>✓ Added to model</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Node stencil (with Drag & Drop) ───────────────────────────────────────────

function NodeStencil({ onAdd, pack }: { onAdd: (kind: string) => void; pack?: DomainPack | null }) {
  const stencilItems = pack?.icon_manifest?.nodeTypes
    ? Object.entries(pack.icon_manifest.nodeTypes).map(([kind, def]) => ({ kind, label: def.label }))
    : DEFAULT_STENCIL;

  const onDragStart = (e: React.DragEvent<HTMLButtonElement>, kind: string) => {
    e.dataTransfer.setData('application/reactflow-kind', kind);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="glass-panel" style={{ width: '72px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 6px', gap: '6px', borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderLeft: 'none', borderRight: '1px solid rgba(255,255,255,0.06)', zIndex: 20, overflowY: 'auto' }}>
      <div style={{ fontSize: '9px', letterSpacing: '1px', color: 'var(--on-surface-muted)', marginBottom: '6px', textTransform: 'uppercase', textAlign: 'center' }}>ADD</div>
      {stencilItems.map(({ kind, label }) => (
        <button
          key={kind}
          title={`Add ${label}`}
          draggable
          onDragStart={(e) => onDragStart(e, kind)}
          onClick={() => onAdd(kind)}
          style={{ width: '56px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '8px 4px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'var(--on-surface-muted)', cursor: 'grab', transition: 'all 0.15s', fontSize: '10px' }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.borderColor = 'rgba(0,242,255,0.4)'; e.currentTarget.style.color = 'var(--primary)'; }}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--on-surface-muted)'; }}
        >
          <DomainIcon kind={kind} pack={pack} />
          <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Rename modal ──────────────────────────────────────────────────────────────

function RenameModal({ current, onConfirm, onCancel }: { current: string; onConfirm: (n: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(current);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
      <div className="glass-panel" style={{ padding: '24px', width: '320px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--on-surface-muted)', fontFamily: 'var(--font-label)', letterSpacing: '0.5px' }}>RENAME NODE</p>
        <input
          autoFocus
          type="text"
          value={val}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') onConfirm(val); if (e.key === 'Escape') onCancel(); }}
          style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '14px', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--on-surface-muted)', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onConfirm(val)} style={{ flex: 1, padding: '8px', background: 'var(--primary)', border: 'none', color: '#000', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}>Rename</button>
        </div>
      </div>
    </div>
  );
}

// ── Edge label edit modal ─────────────────────────────────────────────────────

function EdgeLabelModal({ current, onConfirm, onCancel }: { current: string; onConfirm: (label: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(current);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
      <div className="glass-panel" style={{ padding: '24px', width: '320px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--on-surface-muted)', fontFamily: 'var(--font-label)', letterSpacing: '0.5px' }}>EDGE LABEL / DATA FLOW</p>
        <input
          autoFocus
          type="text"
          value={val}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') onConfirm(val); if (e.key === 'Escape') onCancel(); }}
          placeholder="e.g. HTTPS, TCP/443, gRPC, SQL…"
          style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '14px', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--on-surface-muted)', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onConfirm(val)} style={{ flex: 1, padding: '8px', background: 'var(--primary)', border: 'none', color: '#000', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}>Apply</button>
        </div>
      </div>
    </div>
  );
}

// ── Main canvas ───────────────────────────────────────────────────────────────

let nodeCounter = INIT_NODES.length;

export default function ThreatFlow(props: { modelId?: string | null; modelTitle?: string }) {
  return (
    <ReactFlowProvider>
      <ThreatFlowInner {...props} />
    </ReactFlowProvider>
  );
}

function ThreatFlowInner({ modelId, modelTitle }: { modelId?: string | null; modelTitle?: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CyberNodeData>(INIT_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INIT_EDGES);
  const [selectedNode, setSelectedNode] = useState<Node<CyberNodeData> | null>(null);
  const [acceptedThreats, setAcceptedThreats] = useState<ThreatSuggestion[]>([]);
  const [renaming, setRenaming] = useState<Node<CyberNodeData> | null>(null);
  const [editingEdge, setEditingEdge] = useState<Edge | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [activeEdgeType, setActiveEdgeType] = useState<string>('data-flow');
  const [showThreatPanel, setShowThreatPanel] = useState(false);
  const [activePack, setActivePack] = useState<string>(() => {
    if (modelId) return localStorage.getItem(`ct_pack_${modelId}`) ?? 'generic';
    return 'generic';
  });
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const { highlightedEdgeIds, clearHighlight, setHighlight, setNodeFilter, selectedNodeId } = useAnalysisStore();

  // Export diagram as PNG or SVG
  const exportImage = useCallback(async (format: 'png' | 'svg') => {
    const el = document.querySelector('.react-flow') as HTMLElement | null;
    if (!el) return;
    try {
      const fn = format === 'png' ? toPng : toSvg;
      const dataUrl = await fn(el, { backgroundColor: '#0a0a14' });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${modelTitle ?? 'diagram'}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [modelTitle]);

  // Theme
  const { theme, toggle: toggleTheme } = useTheme();

  // Undo / Redo
  const { undo, redo, canUndo, canRedo, pushSnapshot } = useUndoRedo(nodes, edges, setNodes, setEdges);

  // Load active domain pack
  const { data: packs = [] } = useQuery<DomainPack[]>({
    queryKey: ['domain-packs'],
    queryFn: async () => {
      const { listPacks } = await import('../../api/domainPacks');
      return listPacks();
    },
    staleTime: Infinity,
  });

  const currentPack = packs.find(p => p.slug === activePack) ?? null;
  _activePack = currentPack;

  function handlePackChange(slug: string) {
    setActivePack(slug);
    if (modelId) localStorage.setItem(`ct_pack_${modelId}`, slug);
  }

  // Load model content
  useEffect(() => {
    if (!modelId) return;
    setActivePack(localStorage.getItem(`ct_pack_${modelId}`) ?? 'generic');
    getThreatModel(modelId).then(({ content }) => {
      const loadedNodes = (content as Record<string, unknown>)?.nodes;
      const loadedEdges = (content as Record<string, unknown>)?.edges;
      if (Array.isArray(loadedNodes) && loadedNodes.length > 0) {
        setNodes(loadedNodes as Node<CyberNodeData>[]);
        setEdges(Array.isArray(loadedEdges) ? (loadedEdges as Edge[]) : []);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  // Apply edge highlights from analysis store
  const displayEdges = edges.map(e => ({
    ...e,
    style: {
      ...e.style,
      stroke: highlightedEdgeIds.has(e.id) ? 'rgba(255,77,79,0.9)' : e.style?.stroke,
      strokeWidth: highlightedEdgeIds.has(e.id) ? 3 : (e.style?.strokeWidth ?? 2),
    },
    animated: highlightedEdgeIds.has(e.id) ? true : e.animated,
  }));

  const onConnect = useCallback((params: Connection) => {
    pushSnapshot();
    const style = EDGE_TYPE_STYLES[activeEdgeType] ?? EDGE_TYPE_STYLES['data-flow'];
    setEdges((eds: Edge[]) => addEdge({
      ...params,
      type: 'data-flow',
      animated: activeEdgeType === 'data-flow',
      style: { ...style },
      data: { label: '', edgeType: activeEdgeType },
    }, eds));
  }, [setEdges, pushSnapshot, activeEdgeType]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node<CyberNodeData>) => {
    if (showThreatPanel) {
      if (selectedNodeId === node.id) {
        clearHighlight();
      } else {
        setNodeFilter(node.id, node.data.label);
        setHighlight([node.id], []);
      }
      return;
    }
    clearHighlight();
    setSelectedNode((prev: Node<CyberNodeData> | null) => prev?.id === node.id ? null : node);
    setNodes((ns: Node<CyberNodeData>[]) => ns.map((n: Node<CyberNodeData>) => ({ ...n, data: { ...n.data, selected: n.id === node.id } })));
  }, [showThreatPanel, selectedNodeId, setNodes, clearHighlight, setNodeFilter, setHighlight]);

  const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node<CyberNodeData>) => {
    setRenaming(node);
  }, []);

  const handleEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setEditingEdge(edge);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setNodes((ns: Node<CyberNodeData>[]) => ns.map((n: Node<CyberNodeData>) => ({ ...n, data: { ...n.data, selected: false } })));
  }, [setNodes]);

  const addNode = useCallback((kind: string, position?: { x: number; y: number }) => {
    pushSnapshot();
    nodeCounter += 1;
    const id = String(nodeCounter);
    const label = currentPack?.icon_manifest?.nodeTypes?.[kind]?.label ?? DEFAULT_KIND_LABEL[kind] ?? kind;
    const newNode: Node<CyberNodeData> = {
      id,
      type: 'cyber',
      position: position ?? { x: 280 + (nodeCounter % 5) * 40, y: 220 + (nodeCounter % 5) * 40 },
      data: { label, kind, selected: false },
    };
    setNodes((ns: Node<CyberNodeData>[]) => [...ns, newNode]);
  }, [setNodes, currentPack, pushSnapshot]);

  // ── Drag & Drop handlers ─────────────────────────────────────────────────────

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData('application/reactflow-kind');
    if (!kind) return;

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    addNode(kind, position);
  }, [screenToFlowPosition, addNode]);

  const handleNodesDelete = useCallback((deleted: Node<CyberNodeData>[]) => {
    pushSnapshot();
    if (selectedNode && deleted.some((d: Node<CyberNodeData>) => d.id === selectedNode.id)) {
      setSelectedNode(null);
    }
  }, [selectedNode, pushSnapshot]);

  const handleRenameConfirm = useCallback((name: string) => {
    if (!renaming || !name.trim()) { setRenaming(null); return; }
    pushSnapshot();
    setNodes((ns: Node<CyberNodeData>[]) => ns.map((n: Node<CyberNodeData>) => n.id === renaming.id ? { ...n, data: { ...n.data, label: name.trim() } } : n));
    if (selectedNode?.id === renaming.id) {
      setSelectedNode((prev: Node<CyberNodeData> | null) => prev ? { ...prev, data: { ...prev.data, label: name.trim() } } : null);
    }
    setRenaming(null);
  }, [renaming, selectedNode, setNodes, pushSnapshot]);

  const handleEdgeLabelConfirm = useCallback((label: string) => {
    if (!editingEdge) { setEditingEdge(null); return; }
    pushSnapshot();
    setEdges((es: Edge[]) => es.map((e: Edge) =>
      e.id === editingEdge.id
        ? { ...e, data: { ...(e.data as Record<string, unknown>), label }, type: 'data-flow' }
        : e
    ));
    setEditingEdge(null);
  }, [editingEdge, setEdges, pushSnapshot]);

  const handleAutoLayout = useCallback(() => {
    pushSnapshot();
    const laidOut = layoutWithDagre(nodes, edges);
    setNodes(laidOut);
  }, [nodes, edges, setNodes, pushSnapshot]);

  const handleSave = useCallback(async () => {
    if (!modelId) return;
    setSaveStatus('saving');
    try {
      await updateThreatModel(modelId, { content: { nodes, edges } });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [modelId, nodes, edges]);

  const aiPanelOpen = Boolean(selectedNode) && !showThreatPanel;
  const threatPanelOpen = showThreatPanel && Boolean(modelId);

  // Toolbar button style helper
  const tbBtn: React.CSSProperties = {
    padding: '5px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.04)', color: 'var(--on-surface-muted)',
    fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-label)',
    letterSpacing: '0.5px', transition: 'all 0.15s',
  };

  return (
    <div style={{ width: '100%', height: '100%', paddingTop: '64px', position: 'relative', display: 'flex' }}>
      {/* Left stencil */}
      <NodeStencil onAdd={(kind) => addNode(kind)} pack={currentPack} />

      {/* Canvas */}
      <div ref={reactFlowWrapper} style={{ flex: 1, position: 'relative' }}>

        {/* Toolbar overlay */}
        <div style={{ position: 'absolute', top: '12px', right: threatPanelOpen ? '356px' : '12px', zIndex: 30, display: 'flex', gap: '6px', alignItems: 'center', transition: 'right 0.2s', flexWrap: 'wrap' }}>
          {/* Undo / Redo */}
          <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={{ ...tbBtn, opacity: canUndo ? 1 : 0.35, cursor: canUndo ? 'pointer' : 'not-allowed' }}>↩</button>
          <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={{ ...tbBtn, opacity: canRedo ? 1 : 0.35, cursor: canRedo ? 'pointer' : 'not-allowed' }}>↪</button>

          {/* Auto Layout */}
          <button onClick={handleAutoLayout} title="Auto Layout" style={tbBtn}>⬡ Layout</button>

          {/* Theme Toggle */}
          <button onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} style={tbBtn}>
            {theme === 'dark' ? '☀ Light' : '● Dark'}
          </button>

          {/* Export */}
          <button onClick={() => exportImage('png')} title="Export as PNG" style={tbBtn}>⬇ PNG</button>
          <button onClick={() => exportImage('svg')} title="Export as SVG" style={tbBtn}>⬇ SVG</button>

          {/* Connection type selector */}
          <select
            value={activeEdgeType}
            onChange={e => setActiveEdgeType(e.target.value)}
            title="Edge type for new connections"
            style={{ ...tbBtn, appearance: 'none', paddingRight: '8px', textAlign: 'center', background: 'rgba(255,255,255,0.06)' }}
          >
            {EDGE_TYPES_LIST.map(et => (
              <option key={et.type} value={et.type} style={{ background: '#1a1a2e', color: '#e2e8f0' }}>
                {et.icon} {et.label}
              </option>
            ))}
          </select>

          {modelId && (
            <DomainSelector activePack={activePack} onPackChange={handlePackChange} />
          )}
          {modelId && (
            <button
              onClick={() => { setShowThreatPanel(v => !v); if (!showThreatPanel) { setSelectedNode(null); clearHighlight(); } }}
              style={{ ...tbBtn, border: `1px solid ${threatPanelOpen ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`, background: threatPanelOpen ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)', color: threatPanelOpen ? '#ef4444' : 'var(--on-surface-muted)' }}
            >
              {threatPanelOpen ? '× Threats' : '⚡ Threats'}
            </button>
          )}
          {saveStatus === 'saved' && <span style={{ fontSize: '12px', color: '#52c41a' }}>✓ Saved</span>}
          {saveStatus === 'error' && <span style={{ fontSize: '12px', color: 'var(--error)' }}>Save failed</span>}
          {modelId && (
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              style={{ padding: '7px 16px', background: 'var(--primary)', border: 'none', color: '#000', fontWeight: 'bold', borderRadius: '6px', cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer', fontSize: '13px', fontFamily: 'var(--font-label)', opacity: saveStatus === 'saving' ? 0.6 : 1 }}
            >
              {saveStatus === 'saving' ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>

        {!modelId && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 5 }}>
            <p style={{ color: 'var(--on-surface-muted)', fontSize: '14px', margin: 0 }}>
              Selecione um modelo em <strong style={{ color: 'var(--primary)' }}>Projects</strong> para começar a editar
            </p>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onEdgeDoubleClick={handleEdgeDoubleClick}
          onPaneClick={handlePaneClick}
          onNodesDelete={handleNodesDelete}
          onDrop={onDrop}
          onDragOver={onDragOver}
          deleteKeyCode={['Backspace', 'Delete']}
          selectionOnDrag
          selectionKeyCode="Shift"
          multiSelectionKeyCode="Shift"
          snapToGrid
          snapGrid={[16, 16]}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          defaultEdgeOptions={{ type: 'data-flow' }}
        >
          <Background color="rgba(255,255,255,0.04)" gap={32} size={1} />
          <Controls style={{ background: 'var(--surface-container-high)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
          <MiniMap nodeColor={miniMapNodeColor} style={{ background: 'var(--surface-container-high)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }} />
        </ReactFlow>

        {/* Accepted threats log (AI) */}
        {acceptedThreats.length > 0 && !threatPanelOpen && (
          <div style={{ position: 'absolute', bottom: '24px', left: '24px', zIndex: 20 }}>
            <div className="glass-panel" style={{ padding: '14px', maxWidth: '360px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--primary)', marginBottom: '8px' }}>AI THREATS LOG ({acceptedThreats.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '160px', overflowY: 'auto' }}>
                {acceptedThreats.map((t: ThreatSuggestion, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px' }}>
                    <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    <SeverityBadge severity={t.severity} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!aiPanelOpen && !threatPanelOpen && (
          <div style={{ position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', fontSize: '11px', color: 'var(--on-surface-muted)', background: 'rgba(0,0,0,0.45)', padding: '5px 14px', borderRadius: '20px', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10 }}>
            Drag from stencil · Shift+drag to select · Shift+click multi-select · Connect handles · Ctrl+Z undo
          </div>
        )}
      </div>

      {/* AI panel (node-level) */}
      {aiPanelOpen && selectedNode && (
        <AISuggestionsPanel
          node={selectedNode}
          onClose={handlePaneClick}
          onAccept={(t: ThreatSuggestion) => setAcceptedThreats((ts: ThreatSuggestion[]) => [...ts, t])}
        />
      )}

      {/* Threat panel (model-level, rule-based) */}
      {threatPanelOpen && modelId && (
        <ThreatPanel modelId={modelId} onClose={() => setShowThreatPanel(false)} />
      )}

      {/* Rename modal */}
      {renaming && (
        <RenameModal
          current={renaming.data.label}
          onConfirm={handleRenameConfirm}
          onCancel={() => setRenaming(null)}
        />
      )}

      {/* Edge label modal */}
      {editingEdge && (
        <EdgeLabelModal
          current={(editingEdge.data as Record<string, string>)?.label ?? ''}
          onConfirm={handleEdgeLabelConfirm}
          onCancel={() => setEditingEdge(null)}
        />
      )}
    </div>
  );
}