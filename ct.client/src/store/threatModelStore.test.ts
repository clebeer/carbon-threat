import { describe, it, expect, beforeEach } from 'vitest';
import { useThreatModelStore } from './threatModelStore';
import type { ThreatModelSummary } from '../api/threatmodels';

describe('useThreatModelStore', () => {
  beforeEach(() => {
    useThreatModelStore.setState({
      models: [],
      currentModelId: null,
      isLoading: false,
      error: null,
    });
  });

  const mockModel: ThreatModelSummary = {
    id: 'm1',
    title: 'Model 1',
    version: 1,
    is_archived: false,
    created_at: '2023-01-01',
    updated_at: '2023-01-01',
    owner_id: 'user1',
  };

  const mockModel2: ThreatModelSummary = {
    id: 'm2',
    title: 'Model 2',
    version: 1,
    is_archived: false,
    created_at: '2023-01-02',
    updated_at: '2023-01-02',
    owner_id: 'user1',
  };

  it('starts with initial state', () => {
    const state = useThreatModelStore.getState();
    expect(state.models).toEqual([]);
    expect(state.currentModelId).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setModels sets the models list', () => {
    useThreatModelStore.getState().setModels([mockModel, mockModel2]);
    const state = useThreatModelStore.getState();
    expect(state.models).toEqual([mockModel, mockModel2]);
    expect(state.models.length).toBe(2);
  });

  it('setCurrentModel sets the current model ID', () => {
    useThreatModelStore.getState().setCurrentModel('m1');
    expect(useThreatModelStore.getState().currentModelId).toBe('m1');

    useThreatModelStore.getState().setCurrentModel(null);
    expect(useThreatModelStore.getState().currentModelId).toBeNull();
  });

  it('setLoading updates the loading state', () => {
    useThreatModelStore.getState().setLoading(true);
    expect(useThreatModelStore.getState().isLoading).toBe(true);

    useThreatModelStore.getState().setLoading(false);
    expect(useThreatModelStore.getState().isLoading).toBe(false);
  });

  it('setError updates the error state', () => {
    useThreatModelStore.getState().setError('Network error');
    expect(useThreatModelStore.getState().error).toBe('Network error');

    useThreatModelStore.getState().setError(null);
    expect(useThreatModelStore.getState().error).toBeNull();
  });

  it('addModel prepends a new model to the list', () => {
    useThreatModelStore.getState().setModels([mockModel2]);
    useThreatModelStore.getState().addModel(mockModel);

    const state = useThreatModelStore.getState();
    expect(state.models).toEqual([mockModel, mockModel2]);
  });

  it('updateModel updates an existing model', () => {
    useThreatModelStore.getState().setModels([mockModel, mockModel2]);

    const updatedModel1 = { ...mockModel, title: 'Updated Model 1' };
    useThreatModelStore.getState().updateModel(updatedModel1);

    const state = useThreatModelStore.getState();
    expect(state.models).toEqual([updatedModel1, mockModel2]);
    expect(state.models[0].title).toBe('Updated Model 1');
  });

  it('updateModel does nothing if model is not found', () => {
    useThreatModelStore.getState().setModels([mockModel]);

    const unknownModel = { ...mockModel2, id: 'unknown' };
    useThreatModelStore.getState().updateModel(unknownModel);

    const state = useThreatModelStore.getState();
    expect(state.models).toEqual([mockModel]);
  });
});
