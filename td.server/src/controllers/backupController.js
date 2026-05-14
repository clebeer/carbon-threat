/**
 * Backup controller.
 *
 * CRUD operations for backup records, download, restore, and schedule management.
 */

import db from '../db/knex.js';
import loggerHelper from '../helpers/logger.helper.js';
import { generateBackupFilename, restoreBackup, serializeBackup } from '../services/backupService.js';

const logger = loggerHelper.get('controllers/backupController.js');

/**
 * GET /api/backups
 * List all backups for the current org.
 */
export async function listBackups(req, res) {
  try {
    const orgId = req.user?.org_id ?? null;

    const query = db('backups').orderBy('created_at', 'desc');
    if (orgId) {query.where('org_id', orgId);}

    const backups = await query;
    return res.json({ backups });
  } catch (err) {
    logger.error(`listBackups failed: ${err.message}\n${err.stack}`);
    return res.status(500).json({ error: 'Failed to list backups', details: err.message });
  }
}

/**
 * POST /api/backups
 * Create a new backup — serializes all data and stores as JSON.
 *
 * Body: { name?: string, storage_type?: 'local'|'sftp'|'gdrive' }
 */
export async function createBackup(req, res) {
  try {
    const userId = req.user?.id ?? req.user?.sub;
    const orgId = req.user?.org_id ?? null;
    const { name, storage_type = 'local' } = req.body;

    const backupName = name || `Backup ${new Date().toLocaleString()}`;

    // Create the backup record
    const [backup] = await db('backups').insert({
      org_id: orgId,
      name: backupName,
      status: 'running',
      storage_type,
      created_by: userId,
      started_at: db.fn.now(),
    }).
returning('*');

    // Serialize data asynchronously
    try {
      const backupData = await serializeBackup(db, orgId);
      const filename = generateBackupFilename(backupName);
      const jsonStr = JSON.stringify(backupData, null, 2);

      await db('backups').where('id', backup.id).
update({
        status: 'complete',
        file_path: filename,
        file_size: Buffer.byteLength(jsonStr, 'utf8'),
        metadata: JSON.stringify({ tables: Object.keys(backupData.data), recordCounts: Object.fromEntries(Object.entries(backupData.data).map(([k, v]) => [k, v.length])) }),
        finished_at: db.fn.now(),
      });

      logger.info(`Backup created: ${backup.id} (${filename})`);
      return res.status(201).json({ backup: { ...backup, status: 'complete', file_path: filename, file_size: Buffer.byteLength(jsonStr, 'utf8') } });
    } catch (err) {
      await db('backups').where('id', backup.id).
update({
        status: 'error',
        error_message: err.message,
        finished_at: db.fn.now(),
      });
      throw err;
    }
  } catch (err) {
    logger.error(`createBackup failed: ${err.message}\n${err.stack}`);
    return res.status(500).json({ error: 'Failed to create backup', details: err.message });
  }
}

/**
 * GET /api/backups/:id/download
 * Download the backup as a JSON file.
 */
export async function downloadBackup(req, res) {
  try {
    const { id } = req.params;
    const orgId = req.user?.org_id ?? null;

    const query = db('backups').where('id', id);
    if (orgId) {query.where('org_id', orgId);}

    const backup = await query.first();
    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    // Re-serialize the data for download
    const backupData = await serializeBackup(db, orgId);
    const filename = backup.file_path || generateBackupFilename(backup.name);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    logger.error('downloadBackup failed', err);
    return res.status(500).json({ error: 'Failed to download backup' });
  }
}

/**
 * POST /api/backups/restore
 * Restore from a backup JSON.
 *
 * Body: { data: object (backup JSON) }
 */
export async function restoreFromBackup(req, res) {
  try {
    const { data: backupData } = req.body;

    if (!backupData) {
      return res.status(400).json({ error: 'Request body must include "data" (backup JSON)' });
    }

    const result = await restoreBackup(db, backupData);

    return res.json({ success: true, result });
  } catch (err) {
    logger.error('restoreFromBackup failed', err);
    return res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
}

/**
 * DELETE /api/backups/:id
 * Delete a backup record.
 */
export async function deleteBackup(req, res) {
  try {
    const { id } = req.params;
    const orgId = req.user?.org_id ?? null;

    const query = db('backups').where('id', id);
    if (orgId) {query.where('org_id', orgId);}

    const deleted = await query.delete();
    if (deleted === 0) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    logger.error('deleteBackup failed', err);
    return res.status(500).json({ error: 'Failed to delete backup' });
  }
}

/**
 * GET /api/backups/schedules
 * List backup schedules for the current org.
 */
export async function listSchedules(req, res) {
  try {
    const orgId = req.user?.org_id ?? null;

    const query = db('backup_schedules').orderBy('created_at', 'desc');
    if (orgId) {query.where('org_id', orgId);}

    const schedules = await query;
    return res.json({ schedules });
  } catch (err) {
    logger.error('listSchedules failed', err);
    return res.status(500).json({ error: 'Failed to list schedules' });
  }
}

/**
 * POST /api/backups/schedules
 * Create a backup schedule.
 *
 * Body: { name, frequency, cron_expression?, storage_type?, storage_config? }
 */
export async function createSchedule(req, res) {
  try {
    const userId = req.user?.id ?? req.user?.sub;
    const orgId = req.user?.org_id ?? null;
    const { name, frequency = 'daily', cron_expression, storage_type = 'local', storage_config = {} } = req.body;

    if (!name) {
      return res.status(400).json({ error: '"name" is required' });
    }

    const [schedule] = await db('backup_schedules').insert({
      org_id: orgId,
      name,
      frequency,
      cron_expression,
      storage_type,
      storage_config: JSON.stringify(storage_config),
      created_by: userId,
    }).
returning('*');

    return res.status(201).json({ schedule });
  } catch (err) {
    logger.error('createSchedule failed', err);
    return res.status(500).json({ error: 'Failed to create schedule' });
  }
}

/**
 * DELETE /api/backups/schedules/:id
 * Delete a backup schedule.
 */
export async function deleteSchedule(req, res) {
  try {
    const { id } = req.params;
    const orgId = req.user?.org_id ?? null;

    const query = db('backup_schedules').where('id', id);
    if (orgId) {query.where('org_id', orgId);}

    const deleted = await query.delete();
    if (deleted === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    logger.error('deleteSchedule failed', err);
    return res.status(500).json({ error: 'Failed to delete schedule' });
  }
}