/**
 * Dashboard Layout Store (Zustand)
 *
 * Manages the user's dashboard widget layout with local optimistic updates
 * and server persistence.
 */

import { create } from 'zustand';
import { getDashboardLayout, saveDashboardLayout, resetDashboardLayout as apiReset, type LayoutItem } from '../api/dashboard';

const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'stats', x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2 },
  { i: 'stride-chart', x: 0, y: 3, w: 5, h: 4, minW: 3, minH: 3 },
  { i: 'severity-chart', x: 5, y: 3, w: 7, h: 4, minW: 4, minH: 3 },
  { i: 'risk-heatmap', x: 0, y: 7, w: 12, h: 4, minW: 6, minH: 3 },
  { i: 'top-threats', x: 0, y: 11, w: 7, h: 5, minW: 4, minH: 3 },
  { i: 'system-info', x: 7, y: 11, w: 5, h: 5, minW: 3, minH: 3 },
  { i: 'recent-scans', x: 0, y: 16, w: 12, h: 4, minW: 6, minH: 2 },
];

interface DashboardStore {
  layout: LayoutItem[];
  isLoaded: boolean;
  isDirty: boolean;
  loadLayout: () => Promise<void>;
  setLayout: (layout: LayoutItem[]) => void;
  persistLayout: () => Promise<void>;
  resetLayout: () => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  layout: DEFAULT_LAYOUT,
  isLoaded: false,
  isDirty: false,

  loadLayout: async () => {
    try {
      const serverLayout = await getDashboardLayout();
      if (serverLayout && serverLayout.length > 0) {
        set({ layout: serverLayout, isLoaded: true, isDirty: false });
      } else {
        set({ layout: DEFAULT_LAYOUT, isLoaded: true, isDirty: false });
      }
    } catch {
      set({ layout: DEFAULT_LAYOUT, isLoaded: true, isDirty: false });
    }
  },

  setLayout: (layout: LayoutItem[]) => {
    set({ layout, isDirty: true });
  },

  persistLayout: async () => {
    const { layout, isDirty } = get();
    if (!isDirty) return;
    try {
      await saveDashboardLayout(layout);
      set({ isDirty: false });
    } catch {
      // Silent fail — layout stays locally, will retry next save
    }
  },

  resetLayout: async () => {
    try {
      const layout = await apiReset();
      set({ layout: layout.length > 0 ? layout : DEFAULT_LAYOUT, isDirty: false });
    } catch {
      set({ layout: DEFAULT_LAYOUT, isDirty: false });
    }
  },
}));