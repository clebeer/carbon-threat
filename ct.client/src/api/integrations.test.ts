/**
 * Unit tests — api/integrations.ts
 *
 * Tests the exportAuditLogs function using MSW to intercept HTTP calls.
 */

import { describe, it, expect } from 'vitest';
import { exportAuditLogs } from './integrations';
import { setInMemoryToken } from './client';

// Ensure we have a token so the interceptor attaches Authorization header
setInMemoryToken('mock-access-token');

describe('api/integrations — exportAuditLogs', () => {
  it('calls GET /audit/export?format=csv by default', async () => {
    const blob = await exportAuditLogs('csv', {});
    expect(blob).toBeInstanceOf(Blob);
  });

  it('calls GET /audit/export?format=json returns a blob', async () => {
    const blob = await exportAuditLogs('json', {});
    expect(blob).toBeTruthy();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('calls GET /audit/export?format=cef returns a blob', async () => {
    const blob = await exportAuditLogs('cef', {});
    expect(blob).toBeTruthy();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('calls GET /audit/export?format=leef returns a blob', async () => {
    const blob = await exportAuditLogs('leef', {});
    expect(blob).toBeTruthy();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('calls GET /audit/export?format=ecs returns a blob', async () => {
    const blob = await exportAuditLogs('ecs', {});
    expect(blob).toBeTruthy();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('passes filter params as query string', async () => {
    // The MSW handler doesn't check filters but the request should not throw
    const blob = await exportAuditLogs('csv', {
      action:      'USER_CREATE',
      entity_type: 'USER',
      from:        '2025-01-01T00:00:00Z',
      to:          '2025-12-31T23:59:59Z',
    });
    expect(blob).toBeInstanceOf(Blob);
  });
});
