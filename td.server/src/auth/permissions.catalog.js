/**
 * Permission Catalog — Single source of truth for all fine-grained permissions.
 *
 * Each permission is a `domain:action` string.  The catalog is versioned in code
 * (next to routes) and the DB only stores which permissions each role is granted.
 *
 * DO NOT store this data in the database — the catalog is the authoritative list.
 */

// ── Permission definitions grouped by domain ──────────────────────────────────

export const PERMISSIONS = {
  threatmodel: {
    label: 'Threat Models',
    permissions: [
      { key: 'threatmodel:read',    label: 'View Models',       description: 'Read threat model data and diagrams' },
      { key: 'threatmodel:create',  label: 'Create Models',     description: 'Create new threat models' },
      { key: 'threatmodel:update',  label: 'Edit Models',       description: 'Modify existing threat models' },
      { key: 'threatmodel:delete',  label: 'Delete/Archive',    description: 'Archive or delete threat models' },
      { key: 'threatmodel:analyze', label: 'Analyze',           description: 'Run STRIDE analysis on models' },
      { key: 'threatmodel:import',  label: 'Import',            description: 'Import threat models from files or cloud' },
      { key: 'threatmodel:export',  label: 'Export',            description: 'Export models (SARIF, JSON, cloud)' },
    ],
  },
  threats: {
    label: 'Threats',
    permissions: [
      { key: 'threats:read',   label: 'View Threats',    description: 'Read threat entries' },
      { key: 'threats:create', label: 'Create Threats',  description: 'Create new threats' },
      { key: 'threats:update', label: 'Edit Threats',    description: 'Modify existing threats' },
      { key: 'threats:delete', label: 'Delete Threats',  description: 'Remove threats' },
    ],
  },
  users: {
    label: 'Users',
    permissions: [
      { key: 'users:read',   label: 'View Users',     description: 'List and view user profiles' },
      { key: 'users:manage', label: 'Manage Users',    description: 'Create, edit, deactivate users' },
    ],
  },
  roles: {
    label: 'Roles',
    permissions: [
      { key: 'roles:manage', label: 'Manage Roles', description: 'Create, edit, delete custom roles and assign permissions' },
    ],
  },
  scanner: {
    label: 'Vulnerability Scanner',
    permissions: [
      { key: 'scanner:read',   label: 'View Scans',      description: 'View scan results and findings' },
      { key: 'scanner:run',    label: 'Run Scans',       description: 'Start new vulnerability scans' },
      { key: 'scanner:policy', label: 'Scanner Policy',  description: 'Configure scanner severity policy' },
    ],
  },
  attack: {
    label: 'ATT&CK Framework',
    permissions: [
      { key: 'attack:read',  label: 'View ATT&CK',     description: 'View tactics, techniques, and mappings' },
      { key: 'attack:sync',  label: 'Sync ATT&CK',     description: 'Trigger ATT&CK framework data sync' },
      { key: 'attack:map',   label: 'Map Threats',     description: 'Create and delete threat-technique mappings' },
    ],
  },
  templates: {
    label: 'Templates',
    permissions: [
      { key: 'templates:import',  label: 'Import Templates',    description: 'Import new templates' },
      { key: 'templates:manage',  label: 'Manage Templates',    description: 'Bootstrap, update, delete templates' },
    ],
  },
  config: {
    label: 'Configuration',
    permissions: [
      { key: 'config:manage', label: 'System Config', description: 'Manage SMTP, integrations, system settings' },
    ],
  },
  audit: {
    label: 'Audit Log',
    permissions: [
      { key: 'audit:read', label: 'View Audit Log', description: 'Read audit log entries' },
    ],
  },
  backup: {
    label: 'Backup & Restore',
    permissions: [
      { key: 'backup:manage', label: 'Manage Backups', description: 'Create, restore, delete backups and schedules' },
    ],
  },
  ai: {
    label: 'AI Analysis',
    permissions: [
      { key: 'ai:suggest', label: 'AI Suggestions', description: 'Run AI-powered analysis and suggestions' },
    ],
  },
  assets: {
    label: 'Assets',
    permissions: [
      { key: 'assets:read',   label: 'View Assets',     description: 'View asset registry and library' },
      { key: 'assets:manage', label: 'Manage Assets',    description: 'Import and delete library assets' },
    ],
  },
  domainpacks: {
    label: 'Domain Packs',
    permissions: [
      { key: 'domain-packs:apply', label: 'Apply Packs', description: 'Apply domain pack templates to models' },
    ],
  },
  cloudstorage: {
    label: 'Cloud Storage',
    permissions: [
      { key: 'cloud-storage:import', label: 'Import from Cloud',  description: 'Import models from Google Drive / OneDrive' },
      { key: 'cloud-storage:export', label: 'Export to Cloud',    description: 'Export models to cloud storage' },
    ],
  },
  vulnfeeds: {
    label: 'Vulnerability Feeds',
    permissions: [
      { key: 'vuln-feeds:manage', label: 'Manage Feeds', description: 'Sync and manage vulnerability feed data' },
    ],
  },
  integrations: {
    label: 'Integrations',
    permissions: [
      { key: 'integrations:read',   label: 'View Integrations',   description: 'View integration configurations' },
      { key: 'integrations:manage', label: 'Manage Integrations',  description: 'Configure and delete integrations' },
      { key: 'integrations:export', label: 'Export to Integrations', description: 'Export issues to external platforms' },
    ],
  },
  jules: {
    label: 'Jules AI',
    permissions: [
      { key: 'jules:read',   label: 'View Sessions',    description: 'View Jules sessions and sources' },
      { key: 'jules:manage', label: 'Manage Sessions',   description: 'Create, approve, and delete Jules sessions' },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a flat array of every permission key in the catalog.
 * e.g. ['threatmodel:read', 'threatmodel:create', ...]
 */
export function allPermissionKeys() {
  const keys = [];
  for (const domain of Object.values(PERMISSIONS)) {
    for (const perm of domain.permissions) {
      keys.push(perm.key);
    }
  }
  return keys;
}

/**
 * Returns the grouped shape suitable for the UI permission matrix.
 * { [domain]: { label, permissions: [{ key, label, description }] } }
 */
export function getPermissionCatalog() {
  return PERMISSIONS;
}