import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listRoles, getRole, createRole, updateRole, deleteRole, listPermissions } from './roles';

// Mock the apiClient
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from './client';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;
const mockPut = apiClient.put as ReturnType<typeof vi.fn>;
const mockDelete = apiClient.delete as ReturnType<typeof vi.fn>;

describe('api/roles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listRoles', () => {
    it('should call GET /roles and return the roles array', async () => {
      const mockRoles = [
        { id: '1', slug: 'admin', name: 'Administrator', permission_keys: [], is_system: true, is_active: true },
      ];
      mockGet.mockResolvedValueOnce({ data: { roles: mockRoles } });

      const result = await listRoles();
      expect(mockGet).toHaveBeenCalledWith('/roles');
      expect(result).toEqual(mockRoles);
    });
  });

  describe('getRole', () => {
    it('should call GET /roles/:id and return the role', async () => {
      const mockRole = { id: '1', slug: 'admin', name: 'Administrator', permission_keys: [] };
      mockGet.mockResolvedValueOnce({ data: { role: mockRole } });

      const result = await getRole('1');
      expect(mockGet).toHaveBeenCalledWith('/roles/1');
      expect(result).toEqual(mockRole);
    });
  });

  describe('createRole', () => {
    it('should call POST /roles with the payload and return the created role', async () => {
      const payload = { name: 'Reviewer', permission_keys: ['threatmodel:read'] };
      const mockRole = { id: '2', slug: 'reviewer', ...payload, is_system: false, is_active: true };
      mockPost.mockResolvedValueOnce({ data: { role: mockRole } });

      const result = await createRole(payload);
      expect(mockPost).toHaveBeenCalledWith('/roles', payload);
      expect(result).toEqual(mockRole);
    });
  });

  describe('updateRole', () => {
    it('should call PUT /roles/:id with the payload and return the updated role', async () => {
      const payload = { permission_keys: ['threatmodel:read', 'threatmodel:create'] };
      const mockRole = { id: '2', slug: 'reviewer', name: 'Reviewer', permission_keys: payload.permission_keys! };
      mockPut.mockResolvedValueOnce({ data: { role: mockRole } });

      const result = await updateRole('2', payload);
      expect(mockPut).toHaveBeenCalledWith('/roles/2', payload);
      expect(result).toEqual(mockRole);
    });
  });

  describe('deleteRole', () => {
    it('should call DELETE /roles/:id', async () => {
      mockDelete.mockResolvedValueOnce({ data: {} });
      await deleteRole('2');
      expect(mockDelete).toHaveBeenCalledWith('/roles/2');
    });
  });

  describe('listPermissions', () => {
    it('should call GET /permissions and return the catalog', async () => {
      const mockCatalog = {
        threatmodel: {
          label: 'Threat Models',
          permissions: [{ key: 'threatmodel:read', label: 'Read', description: 'View threat models' }],
        },
      };
      mockGet.mockResolvedValueOnce({ data: { permissions: mockCatalog } });

      const result = await listPermissions();
      expect(mockGet).toHaveBeenCalledWith('/permissions');
      expect(result).toEqual(mockCatalog);
    });
  });
});