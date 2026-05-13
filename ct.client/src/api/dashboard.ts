/**
 * Dashboard Layout API client.
 */

import { apiClient } from './client';

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  static?: boolean;
}

export async function getDashboardLayout(): Promise<LayoutItem[]> {
  const { data } = await apiClient.get<{ layout: LayoutItem[] }>('/dashboard/layout');
  return data.layout;
}

export async function saveDashboardLayout(layout: LayoutItem[]): Promise<void> {
  await apiClient.put('/dashboard/layout', { layout });
}

export async function resetDashboardLayout(): Promise<LayoutItem[]> {
  const { data } = await apiClient.post<{ layout: LayoutItem[] }>('/dashboard/layout/reset');
  return data.layout;
}