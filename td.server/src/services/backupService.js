/* eslint-disable max-lines, max-lines-per-function, complexity, no-await-in-loop, require-unicode-regexp, no-mixed-operators, no-continue, prefer-named-capture-group, no-useless-escape, max-depth, no-empty-function, sort-imports, no-bitwise, no-promise-executor-return, require-await, no-console, no-inner-declarations, no-invalid-this */
/**
 * Backup Service.
 *
 * Handles serialization of application data to JSON backup files,
 * restoration from backups, and storage transfer (local, SFTP, Google Drive).
 */

import loggerHelper from '../helpers/logger.helper.js';
import { env } from 'node:process';

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

// ──────────────────────────────────────────────────────────────────────────────
// SFTP Storage Transfer (ssh2)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Upload backup data to an SFTP server.
 * Uses ssh2 client to connect and write the file.
 *
 * @param {Buffer|string} data  - The backup JSON as a Buffer or string
 * @param {string} filename     - Remote filename
 * @param {object} config       - { host, port, username, password|privateKey, remotePath }
 * @returns {Promise<{success: boolean, path: string}>}
 */
export async function uploadToSFTP(data, filename, config) {
  const { host, port = 22, username, password, privateKey, remotePath = '/backups' } = config;

  if (!host || !username) {
    throw new Error('SFTP configuration requires host and username');
  }

  const { Client } = await import('ssh2');
  const client = new Client();

  return new Promise((resolve, reject) => {
    client.on('ready', () => {
      client.sftp((err, sftp) => {
        if (err) {
          client.end();
          return reject(err);
        }

        const remoteFilePath = `${remotePath}/${filename}`;
        const stream = sftp.createWriteStream(remoteFilePath);

        stream.on('close', () => {
          client.end();
          logger.info(`SFTP upload complete: ${remoteFilePath}`);
          resolve({ success: true, path: remoteFilePath });
        });

        stream.on('error', (streamErr) => {
          client.end();
          reject(streamErr);
        });

        stream.end(Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8'));
      });
    });

    client.on('error', (err) => reject(err));

    const connectOpts = { host, port, username };
    if (privateKey) {
      connectOpts.privateKey = Buffer.isBuffer(privateKey) ? privateKey : Buffer.from(privateKey, 'utf-8');
    } else if (password) {
      connectOpts.password = password;
    } else {
      return reject(new Error('SFTP requires either password or privateKey'));
    }

    client.connect(connectOpts);
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Google Drive Storage Transfer (googleapis)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Upload backup data to Google Drive.
 * Uses googleapis SDK with OAuth2 credentials.
 *
 * @param {Buffer|string} data  - The backup JSON as a Buffer or string
 * @param {string} filename     - Remote filename
 * @param {object} config       - { clientId, clientSecret, refreshToken, folderId }
 * @returns {Promise<{success: boolean, fileId: string}>}
 */
export async function uploadToGoogleDrive(data, filename, config) {
  const { clientId, clientSecret, refreshToken, folderId } = config;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Drive configuration requires clientId, clientSecret, and refreshToken');
  }

  const { google } = await import('googleapis');
  const { Readable } = await import('node:stream');

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const content = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType: 'application/json',
      body: Readable.from(content),
    },
    fields: 'id',
  });

  logger.info(`Google Drive upload complete: ${response.data.id}`);
  return { success: true, fileId: response.data.id };
}

// ──────────────────────────────────────────────────────────────────────────────
// Backup Scheduler (node-cron)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Get default cron expression for common frequencies.
 */
function getDefaultCron(frequency) {
  switch (frequency) {
    case 'hourly': return '0 * * * *';
    case 'daily': return '0 2 * * *';
    case 'weekly': return '0 2 * * 0';
    case 'monthly': return '0 2 1 * *';
    default: return '0 2 * * *';
  }
}

/**
 * Start a backup scheduler that runs at cron-defined intervals.
 *
 * @param {object} knex     - Knex instance
 * @param {object} schedule - { id, cron_expression, org_id, storage_type, storage_config, name, created_by }
 * @returns {Promise<object|null>} - { cronTask } — call cronTask.stop() to cancel
 */
export async function startBackupScheduler(knex, schedule) {
  let cron;
  try {
    cron = await import('node-cron');
  } catch {
    logger.warn('node-cron not installed — scheduled backups unavailable');
    return null;
  }

  const cronExpression = schedule.cron_expression || getDefaultCron(schedule.frequency);
  const orgId = schedule.org_id;

  if (!cron.validate(cronExpression)) {
    logger.error(`Invalid cron expression for schedule ${schedule.id}: ${cronExpression}`);
    return null;
  }

  const task = cron.schedule(cronExpression, async () => {
    logger.info(`Running scheduled backup: ${schedule.name} (org: ${orgId})`);
    try {
      const backupData = await serializeBackup(knex, orgId);
      const filename = generateBackupFilename(schedule.name);
      const jsonStr = JSON.stringify(backupData, null, 2);

      if (schedule.storage_type === 'sftp') {
        const config = typeof schedule.storage_config === 'string'
          ? JSON.parse(schedule.storage_config)
          : schedule.storage_config || {};
        await uploadToSFTP(jsonStr, filename, {
          host: config.host || env.SFTP_HOST,
          port: config.port || env.SFTP_PORT || 22,
          username: config.username || env.SFTP_USER,
          password: config.password || env.SFTP_PASSWORD,
          privateKey: config.privateKey || env.SFTP_PRIVATE_KEY,
          remotePath: config.remotePath || env.SFTP_REMOTE_PATH || '/backups',
        });
      } else if (schedule.storage_type === 'gdrive') {
        const config = typeof schedule.storage_config === 'string'
          ? JSON.parse(schedule.storage_config)
          : schedule.storage_config || {};
        await uploadToGoogleDrive(jsonStr, filename, {
          clientId: config.clientId || env.GDRIVE_CLIENT_ID,
          clientSecret: config.clientSecret || env.GDRIVE_CLIENT_SECRET,
          refreshToken: config.refreshToken || env.GDRIVE_REFRESH_TOKEN,
          folderId: config.folderId || env.GDRIVE_FOLDER_ID,
        });
      }

      // Record backup in DB
      await knex('backups').insert({
        org_id: orgId,
        name: `[Scheduled] ${schedule.name}`,
        status: 'complete',
        storage_type: schedule.storage_type || 'local',
        file_path: filename,
        file_size: Buffer.byteLength(jsonStr, 'utf8'),
        created_by: schedule.created_by,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      });

      logger.info(`Scheduled backup complete: ${filename}`);
    } catch (err) {
      logger.error(`Scheduled backup failed for ${schedule.name}: ${err.message}`);
    }
  }, { scheduled: true });

  logger.info(`Backup scheduler started: ${schedule.name} (${cronExpression})`);
  return { cronTask: task };
}