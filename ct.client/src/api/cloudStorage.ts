import { apiClient } from './client';

export type CloudProvider = 'google_drive' | 'onedrive';

export interface CloudFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  isFolder?: boolean;
}

export interface CloudStatus {
  connected: boolean;
  email?: string;
}

export async function getCloudStatus(provider: CloudProvider): Promise<CloudStatus> {
  const { data } = await apiClient.get<CloudStatus>(`/cloud-storage/${provider}/status`);
  return data;
}

export async function getAuthUrl(provider: CloudProvider): Promise<string> {
  const { data } = await apiClient.get<{ authUrl: string }>(`/cloud-storage/${provider}/auth`);
  return data.authUrl;
}

export async function listCloudFiles(provider: CloudProvider, folderId?: string): Promise<CloudFile[]> {
  const q = folderId ? `?folderId=${encodeURIComponent(folderId)}` : '';
  const { data } = await apiClient.get<{ files: CloudFile[] }>(`/cloud-storage/${provider}/files${q}`);
  return data.files;
}

export async function importCloudFile(provider: CloudProvider, fileId: string, title: string): Promise<{ id: string; title: string }> {
  const { data } = await apiClient.post<{ model: { id: string; title: string } }>(
    `/cloud-storage/${provider}/import`,
    { fileId, title }
  );
  return data.model;
}

export async function exportModelToCloud(provider: CloudProvider, modelId: string, folderId?: string): Promise<{ fileId: string; fileName: string }> {
  const { data } = await apiClient.post<{ fileId: string; fileName: string }>(
    `/cloud-storage/${provider}/export`,
    { modelId, folderId }
  );
  return data;
}

export async function disconnectCloud(provider: CloudProvider): Promise<void> {
  await apiClient.delete(`/cloud-storage/${provider}/disconnect`);
}
