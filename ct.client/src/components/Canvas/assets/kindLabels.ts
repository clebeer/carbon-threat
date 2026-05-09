export const DEFAULT_KIND_LABEL: Record<string, string> = {
  db: 'Database', server: 'Server', fw: 'Firewall', user: 'User / Actor',
  api: 'API Gateway', cloud: 'Cloud Service', browser: 'Web Client',
  // Network
  router: 'Router', switch: 'Switch', loadbalancer: 'Load Balancer',
  vpn: 'VPN Gateway', dns: 'DNS Server', proxy: 'Proxy Server',
  waf: 'Web App Firewall', ids: 'IDS / IPS', siem: 'SIEM',
  endpoint: 'Endpoint', mobile: 'Mobile Device', iot: 'IoT Device',
  printer: 'Network Printer', bridge: 'Network Bridge',
  hub: 'Network Hub', 'access-point': 'Wi-Fi AP', laptop: 'Laptop',
  nas: 'NAS Storage', hypervisor: 'Hypervisor', 'nat-gateway': 'NAT Gateway',
  bastion: 'Bastion Host',
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
  // OCI (Oracle Cloud)
  'oci-compartment': 'OCI Compartment', 'oci-vault': 'OCI Vault',
  'oci-db': 'OCI Database', 'oci-k8s': 'OKE Cluster',
  'oci-object-storage': 'OCI Object Storage', 'oci-lb': 'OCI Load Balancer',
  'oci-waf': 'OCI WAF', 'oci-iam': 'OCI IAM',
  // Alibaba Cloud
  'ali-ecs': 'ECS Instance', 'ali-oss': 'OSS Storage',
  'ali-rds': 'RDS Database', 'ali-slb': 'SLB Load Balancer',
  'ali-k8s': 'ACK Cluster', 'ali-waf': 'WAF',
  'ali-ram': 'RAM / IAM', 'ali-kms': 'KMS',
  // Trust boundary
  'trust-boundary': 'Trust Boundary',
};
