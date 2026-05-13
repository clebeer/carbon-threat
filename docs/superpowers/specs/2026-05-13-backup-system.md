# Feature Spec: Backup & Restore System

**Date:** 2026-05-13  
**Status:** Implemented  
**Phase:** 3

## Summary

Full backup and restore system with support for local filesystem, SFTP, and Google Drive storage. Includes scheduled automatic backups via node-cron.

## Backend

### Migration `015_backups.js`

Creates two tables:

**`backups`:**

| Column | Type |
|---|---|
| id | UUID PK |
| name | string |
| status | string (pending/running/complete/error) |
| storage_type | string (local/sftp/gdrive) |
| file_path | string |
| file_size | bigint |
| metadata | JSONB |
| error_message | text |
| created_by | UUID FK → users |
| started_at / finished_at | timestamp |
| created_at / updated_at | timestamp |

**`backup_schedules`:**

| Column | Type |
|---|---|
| id | UUID PK |
| name | string |
| frequency | string (daily/weekly/monthly) |
| cron_expression | string |
| storage_type | string |
| storage_config | JSONB |
| is_active | boolean |
| last_run_at | timestamp |
| created_at / updated_at | timestamp |

### Service `backupService.js`

- `serializeData()` — Exports all tables to a structured JSON object
- `restoreFromData(data)` — Imports data from JSON, handles upserts with conflict resolution
- `uploadToSFTP(filePath, config)` — Upload backup to remote SFTP server via ssh2
- `uploadToGDrive(filePath, config)` — Upload to Google Drive via googleapis
- `startScheduler(knex)` — Initialize node-cron jobs from active schedules

### Controller `backupController.js`

- `POST /api/backups` — Create backup (async, returns immediately)
- `GET /api/backups` — List all backups
- `GET /api/backups/:id/download` — Download backup JSON file
- `POST /api/backups/restore` — Restore from uploaded JSON
- `DELETE /api/backups/:id` — Delete backup record + file
- `POST /api/backups/schedules` — Create schedule
- `GET /api/backups/schedules` — List schedules
- `DELETE /api/backups/schedules/:id` — Delete schedule

All routes are admin-only.

## Frontend

### API Client `api/backup.ts`

Typed functions for all backup endpoints with full TypeScript interfaces for `BackupRecord` and `BackupSchedule`.

### View `BackupView.tsx`

Full management UI with:
- Create backup button with loading state
- Restore from file upload (JSON)
- Backup list with status badges, size, date, download/delete actions
- Schedule management with create/delete, frequency selector (daily/weekly/monthly)
- Restore result display with per-table row counts and error warnings

### Navigation

Added to admin section of sidebar in `App.tsx` with upload icon.

## Environment Variables

See `docs/install/configuration.md` — `BACKUP_DIR`, `SFTP_*`, `GDRIVE_*` variables.

## Dependencies (server)

- `ssh2` — SFTP uploads
- `googleapis` — Google Drive uploads
- `node-cron` — Scheduled backup execution