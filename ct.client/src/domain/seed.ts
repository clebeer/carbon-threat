/* ============================================================================
   Carbon Dojo — seed data (mirrors the design bundle's fixtures).
   Used by the mock API layer until the V2 backend endpoints exist.
   ========================================================================== */
import { AdminUser, BusinessUnit, Connector, Engagement, Finding, Organization, Product } from './types';

export const ORGS: Organization[] = [{ id: 'org1', name: 'Acme Corp' }];

export const BUSINESS_UNITS: BusinessUnit[] = [
  { id: 'bu1', orgId: 'org1', name: 'Plataforma', productCount: 3 },
];

export const PRODUCTS: Product[] = [
  { id: 'p1', businessUnitId: 'bu1', name: 'carbon-dojo', findingCount: 22 },
  { id: 'p2', businessUnitId: 'bu1', name: 'carbon-api', findingCount: 8 },
  { id: 'p3', businessUnitId: 'bu1', name: 'carbon-web', findingCount: 4 },
];

export const ENGAGEMENTS: Engagement[] = [
  { id: 'e1', productId: 'p1', name: 'Pentest 2026-Q2', type: 'pentest', status: 'completed', jiraProject: 'PEN' },
  { id: 'e2', productId: 'p1', name: 'Continuous Scan', type: 'scan', status: 'active', jiraProject: 'SEC' },
  { id: 'e3', productId: 'p1', name: 'Q3 Bug Bounty', type: 'bug bounty', status: 'planned', jiraProject: 'BB' },
];

export const CONNECTORS: Connector[] = [
  { id: 'c1', name: 'Jira PEN (seed)', type: 'jira', edition: 'cloud', baseUrl: 'https://clebeer.atlassian.net', email: 'ops@acme.com', projectKey: 'PEN', issueType: 'Task', status: 'enabled', secretSet: true },
];

export const ADMIN_USERS: AdminUser[] = [
  { id: 'u1', email: 'boss@carbon.local', name: 'Org Owner', role: 'Admin', status: 'active' },
  { id: 'u2', email: 'manager@carbon.local', name: 'Red Team Manager', role: 'Red Team Manager', status: 'active' },
  { id: 'u3', email: 'analyst@carbon.local', name: 'Red Team Analyst', role: 'Red Team Analyst', status: 'active' },
  { id: 'u4', email: 'dev@carbon.local', name: 'Dev Owner', role: 'Dev Owner', status: 'active' },
];

export const FINDINGS: Finding[] = [
  { id: 'f1', productId: 'p1', title: 'ContainerHardeningGaps', severity: 'medium', status: 'triage', sla: 'on_track', source: 'file', cve: '—', cwe: 'CWE-16', cvss: '5.3', jiraKey: 'PEN-5', description: 'proxy (Caddy) não herda x-hardening (sem read_only); Dockerfile.web sem USER.', remediation: 'Run the proxy with read_only and dropped capabilities; add a non-root USER to Dockerfile.web and pin the base image.' },
  { id: 'f2', productId: 'p1', title: 'IngestionDefenseInDepth', severity: 'low', status: 'triage', sla: 'on_track', source: 'file', cve: '—', cwe: 'CWE-400', cvss: '3.7', description: 'Ingestão sem io.LimitReader no stream MinIO; sem limite de campo; cursor não assinado.', remediation: 'Wrap the MinIO stream in io.LimitReader, enforce per-field size caps and sign pagination cursors.' },
  { id: 'f3', productId: 'p1', title: 'InMemoryRateLimiter', severity: 'low', status: 'triage', sla: 'on_track', source: 'file', cve: '—', cwe: 'CWE-770', cvss: '3.5', jiraKey: 'PEN-6', description: 'Rate limiter in-memory por processo; bypass multi-replica; map sem TTL.', remediation: 'Move rate limiting to a shared store (Redis) with TTL so limits hold across replicas.' },
  { id: 'f4', productId: 'p1', title: 'FreeFormApprover', severity: 'medium', status: 'triage', sla: 'on_track', source: 'file', cve: '—', cwe: 'CWE-285', cvss: '5.4', description: 'risk_accepted.approver string livre, sem validação aprovador!=solicitante.', remediation: 'Validate the approver against the user directory and reject when approver equals requester.' },
  { id: 'f5', productId: 'p1', title: 'UserEnumerationViaLockout', severity: 'medium', status: 'triage', sla: 'on_track', source: 'web', cve: '—', cwe: 'CWE-204', cvss: '5.3', description: '401 (inexistente) vs 423 (existente+locked) permite user enumeration.', remediation: 'Return a uniform response and timing for unknown and locked accounts.' },
  { id: 'f6', productId: 'p1', title: 'EmptyWebhookSecret', severity: 'low', status: 'triage', sla: 'on_track', source: 'file', cve: '—', cwe: 'CWE-347', cvss: '3.1', description: 'WebhookContext retorna string vazia se webhook_secret ausente; inoperante silenciosamente.', remediation: 'Fail closed when no webhook secret is configured; require a signed secret to enable delivery.' },
  { id: 'f7', productId: 'p1', title: 'KekReuse', severity: 'medium', status: 'triage', sla: 'on_track', source: 'file', cve: '—', cwe: 'CWE-323', cvss: '5.9', description: 'ConnectorMasterKey cai para AppEncryptionKey; deploy/.env define ambos iguais (KEK reuse).', remediation: 'Generate distinct KEKs per purpose and forbid reuse via deploy-time validation.' },
  { id: 'f8', productId: 'p1', title: 'IndefinitePiiRetention', severity: 'medium', status: 'triage', sla: 'on_track', source: 'file', cve: '—', cwe: 'CWE-359', cvss: '5.0', description: 'Retenção indefinida de PII: audit_events (IP) e sessions (IP+UA) sem job de expurgo. LGPD art. 6/15.', remediation: 'Add a retention/purge job for audit_events and sessions aligned to LGPD retention limits.' },
  { id: 'f9', productId: 'p1', title: 'PublicMetricsEndpoint', severity: 'medium', status: 'triage', sla: 'on_track', source: 'web', cve: '—', cwe: 'CWE-200', cvss: '5.3', description: '/metrics montado fora de /api/v1 sem auth. Confirmado ao vivo: rotas, contagens por status, sla_breached.', remediation: 'Move /metrics behind authentication / network policy and scrub sensitive labels.' },
  { id: 'f10', productId: 'p1', title: 'SessionSurvivesPasswordReset', severity: 'low', status: 'triage', sla: 'on_track', source: 'file', cve: '—', cwe: 'CWE-613', cvss: '3.9', description: 'Sessões sobrevivem a reset de senha: sem revokeAllByUser; ResolveSession só checa active(). Gap latente.', remediation: 'Revoke all sessions for the user on password reset and re-validate on resolve.' },
  { id: 'f11', productId: 'p1', title: 'StoredPromptInjectionMcp', severity: 'medium', status: 'triage', sla: 'on_track', source: 'file', cve: '—', cwe: 'CWE-94', cvss: '5.6', description: 'Stored prompt injection: get_finding devolve title/description crus a agentes MCP sem fronteira dado/instrução.', remediation: 'Sanitize and clearly delimit user data passed to MCP agents; never treat finding text as instructions.' },
  { id: 'f12', productId: 'p1', title: 'BlindSsrfTeamsWebhook', severity: 'medium', status: 'triage', sla: 'on_track', source: 'web', cve: '—', cwe: 'CWE-918', cvss: '6.1', description: 'SSRF cego: teams.Send faz POST a target sem allowlist/validação de destino.', remediation: 'Enforce an egress allowlist and validate webhook destinations before sending.' },
  { id: 'f13', productId: 'p1', title: 'IdorGetImport', severity: 'medium', status: 'triage', sla: 'on_track', source: 'web', cve: '—', cwe: 'CWE-639', cvss: '6.5', description: 'IDOR GET /imports/{id}: GetImport sem scope; leitura gated por imports:write. Vaza artifact_ref/product_id/summary.', remediation: 'Scope GetImport to the caller and require imports:read with tenant ownership checks.' },
  { id: 'f14', productId: 'p1', title: 'AuditPiiExposure', severity: 'medium', status: 'triage', sla: 'on_track', source: 'web', cve: '—', cwe: 'CWE-200', cvss: '6.5', description: 'GET /audit retorna Actor(email)+SubjectID de toda a org sem filtro. Confirmado ao vivo.', remediation: 'Filter audit results to the requester scope and redact actor PII for non-admins.' },
  { id: 'f15', productId: 'p1', title: 'CrossTenantEnumToImport', severity: 'medium', status: 'triage', sla: 'on_track', source: 'web', cve: '—', cwe: 'CWE-639', cvss: '6.8', description: 'Cadeia: listEngagements cross-tenant -> GET /imports/{id} lê scan de outro tenant.', remediation: 'Add tenant isolation on listEngagements and import reads to break the cross-tenant chain.' },
  { id: 'f16', productId: 'p1', title: 'TotpBruteForce', severity: 'high', status: 'triage', sla: 'breached', source: 'web', cve: '—', cwe: 'CWE-307', cvss: '7.5', description: 'Brute-force de TOTP: VerifyMFA sem lockout/contador; rate-limit cai para clientIP no passo MFA.', remediation: 'Add an attempt counter and lockout on VerifyMFA; bind rate limits to the account, not the IP.' },
  { id: 'f17', productId: 'p1', title: 'BolaProductLevel', severity: 'high', status: 'triage', sla: 'at_risk', source: 'web', cve: '—', cwe: 'CWE-639', cvss: '8.1', jiraKey: 'PEN-4', description: 'BOLA product-level: assets/engagements services sem principal; borda nil->Global. Gestor/Analista global leem qualquer produto/team.', remediation: 'Require an authenticated principal on all asset/engagement services; deny when scope resolves to Global by default.' },
  { id: 'f18', productId: 'p1', title: 'ServicePrincipalAlwaysGlobal', severity: 'high', status: 'triage', sla: 'at_risk', source: 'web', cve: '—', cwe: 'CWE-269', cvss: '8.2', description: 'Service principal sempre global:true. Allow curto-circuita em p.global antes de checar scope.', remediation: 'Scope service accounts to least privilege; evaluate scope before any global short-circuit.' },
  { id: 'f19', productId: 'p1', title: 'Header X-Frame-Options ausente', severity: 'low', status: 'triage', sla: 'on_track', source: 'web', cve: '—', cwe: 'CWE-1021', cvss: '3.1', jiraKey: 'PEN-7', description: 'Resposta sem X-Frame-Options / CSP frame-ancestors.', remediation: 'Set frame-ancestors via CSP and add X-Frame-Options: DENY.' },
  { id: 'f20', productId: 'p1', title: 'IDOR em /orders/{id}', severity: 'high', status: 'triage', sla: 'at_risk', source: 'web', cve: '—', cwe: 'CWE-639', cvss: '7.7', description: '/orders/{id} sem checagem de ownership.', remediation: 'Enforce object-level ownership checks on /orders/{id}.' },
  { id: 'f21', productId: 'p1', title: 'JWT aceita alg=none', severity: 'high', status: 'triage', sla: 'at_risk', source: 'web', cve: '—', cwe: 'CWE-347', cvss: '8.1', description: 'Verificação de JWT aceita alg=none.', remediation: 'Reject alg=none and pin allowed algorithms in the verifier.' },
  { id: 'f22', productId: 'p1', title: 'SQL Injection no /v1/transfers', severity: 'critical', status: 'triage', sla: 'breached', source: 'web', cve: 'CVE-2026-1337', cwe: 'CWE-89', cvss: '9.8', jiraKey: 'PEN-3', description: 'Parâmetro concatenado em query no endpoint /v1/transfers.', remediation: 'Use parameterized queries / prepared statements and add a WAF rule as defense in depth.' },
];
