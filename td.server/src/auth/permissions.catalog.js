/**
 * Permission Catalog
 *
 * Single source of truth for fine-grained permission keys.
 * The DB (role_permissions table) stores which permissions each role is granted.
 * The catalog itself lives in code — versioned next to the route definitions.
 *
 * Structure: each domain is an array of { key, label, description }.
 * The key format is "<domain>:<action>".
 *
 * Keep permission keys in sync with:
 *   - td.server/src/db/migrations/016_custom_roles.js  (seed grants)
 *   - td.server/src/config/routes.config.js            (requirePermission calls)
 */

/**
 * Grouped permission catalog.
 * @type {Record<string, Array<{key:string, label:string, description:string}>>}
 */
export const PERMISSIONS_CATALOG = {
  'Threat Models': [
    { key: 'threatmodel:read', label: 'View', description: 'Read threat models and their content' },
    { key: 'threatmodel:create', label: 'Create', description: 'Create new threat models' },
    { key: 'threatmodel:update', label: 'Edit', description: 'Update existing threat models' },
    { key: 'threatmodel:delete', label: 'Delete', description: 'Archive / delete threat models' },
    { key: 'threatmodel:analyze', label: 'Analyze', description: 'Run STRIDE analysis on a model' },
    { key: 'threatmodel:import', label: 'Import', description: 'Import threat models from files' },
    { key: 'threatmodel:export', label: 'Export', description: 'Export threat models to files / SARIF' },
  ],
  'Threats': [
    { key: 'threats:read', label: 'View', description: 'Read threat entries and STRIDE results' },
    { key: 'threats:create', label: 'Create', description: 'Create threat entries' },
    { key: 'threats:update', label: 'Edit', description: 'Update threat entries' },
    { key: 'threats:delete', label: 'Delete', description: 'Delete threat entries' },
  ],
  'Users': [
    { key: 'users:read', label: 'View', description: 'List and read user profiles' },
    { key: 'users:manage', label: 'Manage', description: 'Create, update, and deactivate users' },
  ],
  'Roles': [{ key: 'roles:manage', label: 'Manage', description: 'Create, edit, and delete custom role profiles' },],
  'Scanner': [
    { key: 'scanner:read', label: 'View', description: 'View scan results and findings' },
    { key: 'scanner:run', label: 'Run scans', description: 'Trigger new vulnerability scans' },
    { key: 'scanner:policy', label: 'Manage policy', description: 'Update scanner policy settings' },
  ],
  'ATT&CK': [
    { key: 'attack:read', label: 'View', description: 'View ATT&CK techniques, tactics, and mappings' },
    { key: 'attack:sync', label: 'Sync', description: 'Trigger ATT&CK data synchronization' },
    { key: 'attack:map', label: 'Map threats', description: 'Create and delete threat → technique mappings' },
  ],
  'Templates': [
    { key: 'templates:import', label: 'Import', description: 'Import threat model templates' },
    { key: 'templates:manage', label: 'Manage', description: 'Create, update, and delete templates' },
  ],
  'Configuration': [
    { key: 'config:read', label: 'View', description: 'View application configuration' },
    { key: 'config:manage', label: 'Manage', description: 'Update SMTP, integrations, and system settings' },
  ],
  'Audit Logs': [{ key: 'audit:read', label: 'View', description: 'Read the audit log' },],
  'Backups': [{ key: 'backup:manage', label: 'Manage', description: 'Create, download, restore, and delete backups' },],
  'AI': [{ key: 'ai:suggest', label: 'AI suggestions', description: 'Use the AI threat suggestion assistant' },],
  'Assets': [
    { key: 'assets:read', label: 'View', description: 'View the asset registry' },
    { key: 'assets:manage', label: 'Manage', description: 'Import and manage assets' },
  ],
  'Domain Packs': [
    { key: 'domain-packs:read', label: 'View', description: 'Browse domain packs and templates' },
    { key: 'domain-packs:apply', label: 'Apply', description: 'Apply domain pack templates to models' },
  ],
  'Cloud Storage': [
    { key: 'cloud-storage:read', label: 'View', description: 'View cloud storage connection status' },
    { key: 'cloud-storage:import', label: 'Import', description: 'Import files from cloud storage' },
    { key: 'cloud-storage:export', label: 'Export', description: 'Export models to cloud storage' },
  ],
  'Vulnerability Feeds': [
    { key: 'vuln-feeds:read', label: 'View', description: 'View vulnerability feed status' },
    { key: 'vuln-feeds:manage', label: 'Sync', description: 'Trigger vulnerability feed synchronization' },
  ],
  'Jules AI': [
    { key: 'jules:read', label: 'View', description: 'View Jules remediation sessions' },
    { key: 'jules:create', label: 'Create session', description: 'Create and manage Jules remediation sessions' },
  ],
  'Integrations': [
    { key: 'integrations:read', label: 'View', description: 'View integration configurations' },
    { key: 'integrations:manage', label: 'Manage', description: 'Create, update, and delete integrations' },
  ],

  // ── Carbon Dojo (vulnerability management) — sync with migration 021 ─────────
  'Products (Assets)': [
    { key: 'products:read', label: 'View', description: 'View organizations, business units, and products' },
    { key: 'products:write', label: 'Manage', description: 'Create, edit, and delete assets' },
  ],
  'Engagements': [
    { key: 'engagements:read', label: 'View', description: 'View engagements' },
    { key: 'engagements:write', label: 'Manage', description: 'Create and edit engagements' },
  ],
  'Assessments': [
    { key: 'assessments:read', label: 'View', description: 'View assessments' },
    { key: 'assessments:write', label: 'Manage', description: 'Create and edit assessments' },
  ],
  'Findings': [
    { key: 'findings:read', label: 'View', description: 'View findings' },
    { key: 'findings:write', label: 'Edit', description: 'Create and edit findings' },
    { key: 'findings:triage', label: 'Triage', description: 'Change finding status' },
    { key: 'findings:comment', label: 'Comment', description: 'Comment on findings' },
    { key: 'findings:export', label: 'Export', description: 'Export findings to a connector (Jira)' },
  ],
  'Risk Acceptance': [
    { key: 'risk:request', label: 'Request', description: 'Request risk acceptance for a finding' },
    { key: 'risk:approve', label: 'Approve', description: 'Approve a risk acceptance (must differ from requester)' },
  ],
  'Imports': [
    { key: 'imports:read', label: 'View', description: 'View import jobs and results' },
    { key: 'imports:write', label: 'Import', description: 'Submit scanner reports for import' },
  ],
  'Connectors': [
    { key: 'connectors:read', label: 'View', description: 'View issue-tracker connectors' },
    { key: 'connectors:write', label: 'Manage', description: 'Create, edit, and delete connectors' },
    { key: 'connectors:test', label: 'Test', description: 'Test connector connectivity' },
  ],
  'Reports': [
    { key: 'reports:read', label: 'View', description: 'View pentest reports' },
    { key: 'reports:generate', label: 'Generate', description: 'Generate and export reports (HTML/CSV/JSON)' },
  ],
  'Policies': [
    { key: 'policies:read', label: 'View', description: 'View SLA and retention policies' },
    { key: 'policies:manage', label: 'Manage', description: 'Edit SLA per severity and data retention' },
  ],
  'Service Accounts': [
    { key: 'service-accounts:read', label: 'View', description: 'View service accounts and API keys' },
    { key: 'service-accounts:manage', label: 'Manage', description: 'Create service accounts and issue API keys' },
  ],
  'Identity Providers': [
    { key: 'identity-providers:read', label: 'View', description: 'View OIDC/SAML providers and mappings' },
    { key: 'identity-providers:manage', label: 'Manage', description: 'Configure providers and group→role mappings' },
  ],
  'Notifications': [
    { key: 'notifications:read', label: 'View', description: 'View SMTP/Teams channels' },
    { key: 'notifications:manage', label: 'Manage', description: 'Configure notification channels' },
  ],
};

/**
 * Returns the flat list of every permission key in the catalog.
 * @returns {string[]}
 */
export function allPermissionKeys() {
  return Object.values(PERMISSIONS_CATALOG).flatMap((group) => group.map((p) => p.key));
}

/**
 * Returns the catalog in a UI-friendly grouped shape:
 *   { domain: string, permissions: { key, label, description }[] }[]
 * @returns {Array<{domain:string, permissions:Array<{key:string,label:string,description:string}>}>}
 */
export function groupedCatalog() {
  return Object.entries(PERMISSIONS_CATALOG).map(([domain, permissions]) => ({
    domain,
    permissions,
  }));
}
