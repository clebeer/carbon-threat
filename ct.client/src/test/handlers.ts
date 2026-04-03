/**
 * MSW request handlers — default happy-path responses for all API routes.
 *
 * Individual tests can override a specific route via server.use(http.post(...))
 * inside the test body; those overrides are reset after each test by setup.ts.
 */

import { http, HttpResponse } from 'msw';

// ── fixture data ──────────────────────────────────────────────────────────────

export const MOCK_USER = {
  id:           'user-uuid-1',
  email:        'admin@ct.com',
  display_name: 'Admin User',
  role:         'admin',
  is_active:    true,
  org_id:       'org-1',
};

export const MOCK_ACCESS_TOKEN  = 'eyJhbGciOiJIUzI1NiJ9.mock-access.sig';
export const MOCK_REFRESH_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.mock-refresh.sig';

export const MOCK_THREAT_MODEL = {
  id:      'tm-uuid-1',
  title:   'Test Threat Model',
  version: 2,
  summary: { owner: 'team', reviewer: '', contributors: [] },
  detail:  { diagrams: [], threats: [] },
};

export const MOCK_USERS_LIST = [
  MOCK_USER,
  { ...MOCK_USER, id: 'user-uuid-2', email: 'analyst@ct.com', role: 'analyst' },
];

export const MOCK_INTEGRATIONS = [
  { platform: 'github',  is_enabled: true,  config: { repo: 'org/repo', token: '***' } },
  { platform: 'openai',  is_enabled: false, config: { model: 'gpt-4o', apiKey: '***' } },
];

export const MOCK_AI_SUGGESTIONS = [
  {
    title:          'SQL Injection',
    severity:       'High',
    mitigation:     'Use parameterised queries',
    strideCategory: 'Tampering',
  },
];

// ── handlers ──────────────────────────────────────────────────────────────────

export const handlers = [
  // Auth
  http.post('/api/auth/local/login', () =>
    HttpResponse.json({
      user:         MOCK_USER,
      accessToken:  MOCK_ACCESS_TOKEN,
      refreshToken: MOCK_REFRESH_TOKEN,
    })
  ),

  http.post('/api/logout', () => HttpResponse.json({ ok: true })),

  http.post('/api/token/refresh', () =>
    HttpResponse.json({ accessToken: MOCK_ACCESS_TOKEN })
  ),

  // Health
  http.get('/api/healthz', () =>
    HttpResponse.json({ status: 'ok', version: '1.0.0' })
  ),

  // Threat models
  http.get('/api/threatmodels', () =>
    HttpResponse.json({ models: [MOCK_THREAT_MODEL] })
  ),

  http.get('/api/threatmodels/:id', ({ params }) =>
    HttpResponse.json({ model: { ...MOCK_THREAT_MODEL, id: params.id as string } })
  ),

  http.post('/api/threatmodels', () =>
    HttpResponse.json({ model: MOCK_THREAT_MODEL }, { status: 201 })
  ),

  http.put('/api/threatmodels/:id', ({ params }) =>
    HttpResponse.json({ model: { ...MOCK_THREAT_MODEL, id: params.id as string } })
  ),

  // Users (admin)
  http.get('/api/users', () =>
    HttpResponse.json({ users: MOCK_USERS_LIST })
  ),

  http.post('/api/users', () =>
    HttpResponse.json({ user: MOCK_USER }, { status: 201 })
  ),

  http.put('/api/users/:id', ({ params }) =>
    HttpResponse.json({ user: { ...MOCK_USER, id: params.id as string } })
  ),

  http.delete('/api/users/:id', () =>
    HttpResponse.json({ message: 'User deactivated', user: { id: 'user-uuid-2', email: 'analyst@ct.com' } })
  ),

  // Integrations
  http.get('/api/integrations', () =>
    HttpResponse.json({ integrations: MOCK_INTEGRATIONS })
  ),

  http.put('/api/integrations/:platform', ({ params }) =>
    HttpResponse.json({ platform: params.platform, is_enabled: true })
  ),

  http.delete('/api/integrations/:platform', () =>
    HttpResponse.json({ ok: true })
  ),

  http.post('/api/integrations/:platform/export', () =>
    HttpResponse.json({ issueUrl: 'https://github.com/org/repo/issues/42' })
  ),

  // AI
  http.post('/api/ai/suggest', () =>
    HttpResponse.json({ nodeId: 'node-1', suggestions: MOCK_AI_SUGGESTIONS })
  ),
];
