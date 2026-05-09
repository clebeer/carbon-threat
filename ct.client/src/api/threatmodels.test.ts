import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the apiClient module before importing threatmodels
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from './client';
import {
  listThreatModels,
  listArchivedThreatModels,
  getThreatModel,
  createThreatModel,
  updateThreatModel,
  archiveThreatModel,
  restoreThreatModel,
} from './threatmodels';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

const SAMPLE_MODEL = {
  id: 'm1',
  title: 'Test Model',
  description: 'desc',
  version: 1,
  is_archived: false,
  created_at: '2025-01-01',
  updated_at: '2025-01-01',
  owner_id: 'u1',
};

describe('threatmodels API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listThreatModels returns models array', async () => {
    mockGet.mockResolvedValueOnce({ data: { models: [SAMPLE_MODEL] } });
    const result = await listThreatModels();
    expect(result).toEqual([SAMPLE_MODEL]);
    expect(mockGet).toHaveBeenCalledWith('/threatmodels');
  });

  it('listThreatModels returns empty array', async () => {
    mockGet.mockResolvedValueOnce({ data: { models: [] } });
    const result = await listThreatModels();
    expect(result).toEqual([]);
  });

  it('listArchivedThreatModels calls correct endpoint', async () => {
    mockGet.mockResolvedValueOnce({ data: { models: [SAMPLE_MODEL] } });
    await listArchivedThreatModels();
    expect(mockGet).toHaveBeenCalledWith('/threatmodels?archived=true');
  });

  it('getThreatModel returns content', async () => {
    const content = { summary: SAMPLE_MODEL, content: { nodes: [], edges: [] } };
    mockGet.mockResolvedValueOnce({ data: content });
    const result = await getThreatModel('m1');
    expect(result).toEqual(content);
    expect(mockGet).toHaveBeenCalledWith('/threatmodels/m1');
  });

  it('createThreatModel posts and returns model', async () => {
    mockPost.mockResolvedValueOnce({ data: { model: SAMPLE_MODEL } });
    const result = await createThreatModel({ title: 'New' });
    expect(result).toEqual(SAMPLE_MODEL);
    expect(mockPost).toHaveBeenCalledWith('/threatmodels', { title: 'New' });
  });

  it('updateThreatModel puts and returns model', async () => {
    mockPut.mockResolvedValueOnce({ data: { model: SAMPLE_MODEL } });
    const result = await updateThreatModel('m1', { title: 'Updated' });
    expect(result).toEqual(SAMPLE_MODEL);
    expect(mockPut).toHaveBeenCalledWith('/threatmodels/m1', { title: 'Updated' });
  });

  it('archiveThreatModel calls delete', async () => {
    mockDelete.mockResolvedValueOnce({ data: {} });
    await archiveThreatModel('m1');
    expect(mockDelete).toHaveBeenCalledWith('/threatmodels/m1');
  });

  it('restoreThreatModel calls put restore', async () => {
    mockPut.mockResolvedValueOnce({ data: {} });
    await restoreThreatModel('m1');
    expect(mockPut).toHaveBeenCalledWith('/threatmodels/m1/restore', {});
  });

  it('listThreatModels propagates network error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));
    await expect(listThreatModels()).rejects.toThrow('Network error');
  });
});