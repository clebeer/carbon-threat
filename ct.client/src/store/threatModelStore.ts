import { create } from 'zustand';
import type { ThreatModelSummary } from '../api/threatmodels';

interface ThreatModelState {
  models: ThreatModelSummary[];
  currentModelId: string | null;
  isLoading: boolean;
  error: string | null;

  setModels: (models: ThreatModelSummary[]) => void;
  setCurrentModel: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addModel: (model: ThreatModelSummary) => void;
  updateModel: (updated: ThreatModelSummary) => void;
}

export const useThreatModelStore = create<ThreatModelState>((set) => ({
  models: [],
  currentModelId: null,
  isLoading: false,
  error: null,

  setModels: (models) => set({ models }),
  setCurrentModel: (id) => set({ currentModelId: id }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  addModel: (model) =>
    set((state) => ({ models: [model, ...state.models] })),

  updateModel: (updated) =>
    set((state) => ({
      models: state.models.map((m) => (m.id === updated.id ? updated : m)),
    })),
}));
