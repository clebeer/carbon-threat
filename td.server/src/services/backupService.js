/**
 * Backup Service.
 *
 * Handles serialization of application data to JSON backup files,
 * restoration from backups, and storage transfer (local, SFTP, Google Drive).
 */

import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('services/backupService.js');

/**
 * Serialize all application data for a given organization.
 * Returns a JSON object containing all tables.
 */
export async function serializeBackup(knex, orgId) {
  const backup = {
    version: 1,
    exported_at: new Date().toISOString(),
    org_id: orgId,
    data: {},
  };

  // Serialize core tables scoped to org
  const tables = [
    'threat_models',
    'threats',
    'asset_library',
    'attack_threat_mappings',
  ];

  for (const table of tables) {
    try {
      const query = knex(table);
      if (orgId) {query.where('org_id', orgId);}
      backup.data[table] = await query.select('*');
    } catch {
      // Table may not exist in all deployments
      backup.data[table] = [];
    }
  }

  // Serialize org-level tables
  try {
    backup.data.organizations = orgId
      ? await knex('organizations').where('id', orgId).
select('*')
      : await knex('organizations').select('*');
  } catch {
    backup.data.organizations = [];
  }

  // Serialize users scoped to org
  try {
    const userQuery = knex('users').select('id', 'email', 'role', 'display_name', 'is_active', 'created_at');
    if (orgId) {userQuery.where('org_id', orgId);}
    backup.data.users = await userQuery;
  } catch {
    backup.data.users = [];
  }

  return backup;
}

/**
 * Restore data from a backup JSON object.
 * Uses upsert semantics — updates existing records, inserts new ones.
 */
export async function restoreBackup(knex, backupData) {
  const result = { restored: {}, errors: [] };

  if (!backupData?.data || !backupData.version) {
    throw new Error('Invalid backup format');
  }

  const { data } = backupData;

  // Restore in order: org → users → models → threats → assets → mappings
  const restoreOrder = ['organizations', 'users', 'threat_models', 'threats', 'asset_library', 'attack_threat_mappings'];

  for (const table of restoreOrder) {
    if (!data[table] || !Array.isArray(data[table])) {continue;}

    let count = 0;
    for (const row of data[table]) {
      try {
        const exists = await knex(table).where('id', row.id).
first();
        if (exists) {
          await knex(table).where('id', row.id).
update(row);
        } else {
          await knex(table).insert(row);
        }
        count++;
      } catch (err) {
        result.errors.push(`${table}/${row.id}: ${err.message}`);
      }
    }
    result.restored[table] = count;
  }

  logger.info(`Backup restored: ${JSON.stringify(result.restored)}, ${result.errors.length} errors`);
  return result;
}

/**
 * Generate a filename for the backup.
 */
export function generateBackupFilename(name) {
  const sanitized = (name || 'backup').replace(/[^a-zA-Z0-9_-]/g, '_');
  const ts = new Date().toISOString().
replace(/[:.]/g, '-').
slice(0, 19);
  return `${sanitized}_${ts}.json`;
}