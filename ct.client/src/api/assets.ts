/**
 * Asset Library API client.
 */

import { apiClient } from './client';

export interface LibraryAsset {
  id: string;
  name: string;
  kind: string;
  description: string;
  properties: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ImportReport {
  total: number;
  created: number;
  warnings: string[];
}

export interface ImportResponse {
  report: ImportReport;
  assets: LibraryAsset[];
}

/**
 * Import assets from JSON or CSV text.
 */
export async function importAssets(data: string, format: 'json' | 'csv'): Promise<ImportResponse> {
  const { data: result } = await apiClient.post<ImportResponse>('/assets/import', { data, format });
  return result;
}

/**
 * List all assets in the library.
 */
export async function listLibraryAssets(): Promise<LibraryAsset[]> {
  const { data } = await apiClient.get<{ assets: LibraryAsset[] }>('/assets/library');
  return data.assets;
}

/**
 * Delete an asset from the library.
 */
export async function deleteLibraryAsset(id: string): Promise<void> {
  await apiClient.delete(`/assets/library/${id}`);
}