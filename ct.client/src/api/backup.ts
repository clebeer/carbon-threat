/**
 * Backup API client.
 */

import { apiClient } from './client';

export interface BackupRecord {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  storage_type: 'local' | 'sftp' | 'gdrive';
  file_path: string;
  file_size: number;
  metadata: Record<string, unknown>;
  error_message: string | null;
  created_by: string;
  started_at: string;
  finished_at: string;
  created_at: string;
  updated_at: string;
}

export interface BackupSchedule {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  cron_expression: string | null;
  storage_type: 'local' | 'sftp' | 'gdrive';
  storage_config: Record<string, unknown>;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listBackups(): Promise<BackupRecord[]> {
  const { data } = await apiClient.get<{ backups: BackupRecord[] }>('/backups');
  return data.backups;
}

export async function createBackup(name?: string, storage_type?: string): Promise<BackupRecord> {
  const { data } = await apiClient.post<{ backup: BackupRecord }>('/backups', { name, storage_type });
  return data.backup;
}

export async function downloadBackup(id: string): Promise<void> {
  const { data } = await apiClient.get(`/backups/${id}/download`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = `backup_${id}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function restoreBackup(backupData: unknown): Promise<{ restored: Record<string, number>; errors: string[] }> {
  const { data } = await apiClient.post<{ success: boolean; result: { restored: Record<string, number>; errors: string[] } }>('/backups/restore', { data: backupData });
  return data.result;
}

export async function deleteBackup(id: string): Promise<void> {
  await apiClient.delete(`/backups/${id}`);
}

export async function listSchedules(): Promise<BackupSchedule[]> {
  const { data } = await apiClient.get<{ schedules: BackupSchedule[] }>('/backups/schedules');
  return data.schedules;
}

export async function createSchedule(params: { name: string; frequency: string; storage_type?: string }): Promise<BackupSchedule> {
  const { data } = await apiClient.post<{ schedule: BackupSchedule }>('/backups/schedules', params);
  return data.schedule;
}

export async function deleteSchedule(id: string): Promise<void> {
  await apiClient.delete(`/backups/schedules/${id}`);
}