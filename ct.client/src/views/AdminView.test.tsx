import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockListRoles = vi.fn();
const mockListPermissions = vi.fn();
const mockCreateRole = vi.fn();
const mockUpdateRole = vi.fn();
const mockDeleteRole = vi.fn();
const mockListUsers = vi.fn();
const mockCreateUser = vi.fn();
const mockDeactivateUser = vi.fn();
const mockGetVulnFeedStatus = vi.fn();
const mockTriggerVulnFeedSync = vi.fn();
const mockListBackups = vi.fn();
const mockCreateBackup = vi.fn();
const mockDownloadBackup = vi.fn();
const mockDeleteBackup = vi.fn();
const mockListSchedules = vi.fn();
const mockCreateSchedule = vi.fn();
const mockDeleteSchedule = vi.fn();
const mockRestoreBackup = vi.fn();

vi.mock('../api/roles', () => ({
  listRoles: (...a: unknown[]) => mockListRoles(...a),
  listPermissions: (...a: unknown[]) => mockListPermissions(...a),
  createRole: (...a: unknown[]) => mockCreateRole(...a),
  updateRole: (...a: unknown[]) => mockUpdateRole(...a),
  deleteRole: (...a: unknown[]) => mockDeleteRole(...a),
}));

vi.mock('../api/users', () => ({
  listUsers: (...a: unknown[]) => mockListUsers(...a),
  createUser: (...a: unknown[]) => mockCreateUser(...a),
  deactivateUser: (...a: unknown[]) => mockDeactivateUser(...a),
}));

vi.mock('../api/vulnFeeds', () => ({
  getVulnFeedStatus: (...a: unknown[]) => mockGetVulnFeedStatus(...a),
  triggerVulnFeedSync: (...a: unknown[]) => mockTriggerVulnFeedSync(...a),
}));

vi.mock('../api/backup', () => ({
  listBackups: (...a: unknown[]) => mockListBackups(...a),
  createBackup: (...a: unknown[]) => mockCreateBackup(...a),
  downloadBackup: (...a: unknown[]) => mockDownloadBackup(...a),
  deleteBackup: (...a: unknown[]) => mockDeleteBackup(...a),
  listSchedules: (...a: unknown[]) => mockListSchedules(...a),
  createSchedule: (...a: unknown[]) => mockCreateSchedule(...a),
  deleteSchedule: (...a: unknown[]) => mockDeleteSchedule(...a),
  restoreBackup: (...a: unknown[]) => mockRestoreBackup(...a),
}));

const mockHasPermission = vi.fn();
const mockUseAuthStore = vi.fn();
vi.mock('../store/authStore', () => ({
  useAuthStore: (...a: unknown[]) => {
    const selector = a[0] as (s: Record<string, unknown>) => unknown;
    if (selector) {
      return selector({
        user: { id: '1', email: 'admin@test.com', role: 'admin', permissions: ['roles:manage'] },
        hasPermission: mockHasPermission,
      });
    }
    return mockUseAuthStore();
  },
}));

vi.mock('../hooks/useJulesStatus', () => ({
  useJulesStatus: () => ({ data: { configured: false, enabled: false } }),
}));

vi.mock('../api/auth', () => ({
  refreshSession: vi.fn().mockResolvedValue('mock-access-token'),
  logout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../api/client', () => ({
  setInMemoryToken: vi.fn(),
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

// Mock TanStack Query
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

import { useQuery, useMutation } from '@tanstack/react-query';
import AdminView from './AdminView';

describe('AdminView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockReturnValue(true);
    mockListUsers.mockResolvedValue([]);
    mockGetVulnFeedStatus.mockResolvedValue({ totalAdvisories: 0, bySeverity: {}, lastRun: null });
    mockListRoles.mockResolvedValue([
      { id: '1', slug: 'admin', name: 'Administrator', description: 'Full access', is_system: true, is_active: true, permission_keys: ['roles:manage'], user_count: 1 },
      { id: '2', slug: 'analyst', name: 'Security Architect', description: 'Can edit models', is_system: true, is_active: true, permission_keys: ['threatmodel:read'], user_count: 2 },
    ]);
    mockListPermissions.mockResolvedValue({
      threatmodel: {
        label: 'Threat Models',
        permissions: [
          { key: 'threatmodel:read', label: 'Read Models', description: 'View threat models' },
          { key: 'threatmodel:create', label: 'Create Models', description: 'Create new threat models' },
        ],
      },
      users: {
        label: 'Users',
        permissions: [
          { key: 'users:read', label: 'Read Users', description: 'View user list' },
          { key: 'users:manage', label: 'Manage Users', description: 'Create/edit users' },
        ],
      },
    });

    // Default: useQuery returns data based on queryKey
    (useQuery as ReturnType<typeof vi.fn>).mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'users') return { data: [], isLoading: false, error: null };
      if (queryKey[0] === 'vuln-feed-status') return { data: { totalAdvisories: 0, bySeverity: {}, lastRun: null }, isLoading: false, refetch: vi.fn() };
      if (queryKey[0] === 'roles') return { data: mockListRoles(), isLoading: false };
      if (queryKey[0] === 'permission-catalog') return { data: mockListPermissions(), isLoading: false };
      if (queryKey[0] === 'backups') return { data: [], isLoading: false };
      if (queryKey[0] === 'backup-schedules') return { data: [], isLoading: false };
      return { data: null, isLoading: false };
    });

    (useMutation as ReturnType<typeof vi.fn>).mockImplementation(({ onSuccess, onError }: { onSuccess?: (...a: unknown[]) => void; onError?: (...a: unknown[]) => void }) => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      onSuccess,
      onError,
    }));
  });

  it('renders the admin view with tabs including Roles & Permissions', () => {
    render(<AdminView />);
    expect(screen.getByText('Users & Threat Intel')).toBeInTheDocument();
    expect(screen.getByText('Roles & Permissions')).toBeInTheDocument();
    expect(screen.getByText('Backup & Restore')).toBeInTheDocument();
  });

  it('shows the roles tab when clicked', async () => {
    render(<AdminView />);
    const rolesTab = screen.getByText('Roles & Permissions');
    fireEvent.click(rolesTab);
    await waitFor(() => {
      expect(screen.getByText('ROLES & PERMISSIONS')).toBeInTheDocument();
    });
  });

  it('renders system roles with SYSTEM badge in roles tab', async () => {
    render(<AdminView />);
    fireEvent.click(screen.getByText('Roles & Permissions'));
    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
      expect(screen.getByText('SYSTEM')).toBeInTheDocument();
    });
  });

  it('shows Create Role button in roles tab', async () => {
    render(<AdminView />);
    fireEvent.click(screen.getByText('Roles & Permissions'));
    await waitFor(() => {
      expect(screen.getByText('+ Create Role')).toBeInTheDocument();
    });
  });

  it('gates admin view with hasPermission', () => {
    mockHasPermission.mockReturnValue(false);
    render(<AdminView />);
    expect(screen.getByText('Administrator access required.')).toBeInTheDocument();
  });
});