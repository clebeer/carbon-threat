# Jules Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Google Jules AI coding agent into Carbon Threat so users can trigger automated vulnerability remediation from OSV/SAST findings and manage Jules sessions through a dedicated panel.

**Architecture:** Stateless proxy — the Express backend proxies all calls to `https://jules.googleapis.com` (v1alpha), persists session metadata in Postgres, and the React frontend polls every 5 s for status updates. No new infrastructure required.

**Tech Stack:** Node.js/Express 5, Knex + PostgreSQL, axios (backend), React 18 + TypeScript, Zustand, @tanstack/react-query (frontend)

**API Key env var:** `JULES_API_KEY` — set to the key provided by the user before running.

---

## Task 1: Database Migration

**Files:**
- Create: `td.server/src/db/migrations/012_jules_sessions.js`

- [ ] **Step 1: Create migration file**

```javascript
// td.server/src/db/migrations/012_jules_sessions.js
export function up(knex) {
  return knex.schema.createTable('jules_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('jules_session_id', 255).nullable();
    t.string('finding_id', 255).notNullable();
    t.string('finding_type', 20).notNullable().defaultTo('osv');
    t.string('source_name', 500).notNullable();
    t.text('prompt').notNullable();
    t.string('automation_mode', 30).notNullable().defaultTo('AUTO_CREATE_PR');
    t.string('status', 30).notNullable().defaultTo('pending');
    t.text('plan_summary').nullable();
    t.string('pr_url', 500).nullable();
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.index('finding_id');
    t.index('status');
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('jules_sessions');
}
```

- [ ] **Step 2: Run migration**

```bash
cd td.server && npx knex migrate:latest
```

Expected output: `Batch 1 run: 1 migrations` (or similar batch number)

- [ ] **Step 3: Commit**

```bash
git add td.server/src/db/migrations/012_jules_sessions.js
git commit -m "feat(jules): add jules_sessions migration"
```

---

## Task 2: Jules HTTP Client

**Files:**
- Create: `td.server/src/integrations/jules/jules.client.js`

- [ ] **Step 1: Create directory and client file**

```javascript
// td.server/src/integrations/jules/jules.client.js
import axios from 'axios';

const BASE_URL = 'https://jules.googleapis.com';
const RETRY_DELAYS = [1000, 2000, 4000];

function getApiKey() {
  const key = process.env.JULES_API_KEY;
  if (!key) throw new Error('JULES_API_KEY is not configured');
  return key;
}

function makeClient() {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function request(method, path, data) {
  const client = makeClient();
  const headers = { 'X-Goog-Api-Key': getApiKey() };

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await client({ method, url: path, data, headers });
      return response.data;
    } catch (err) {
      if (err.response?.status === 429 && attempt < RETRY_DELAYS.length) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
        continue;
      }
      throw err;
    }
  }
}

export async function getSources() {
  return request('get', '/v1alpha/sources');
}

export async function createSession({ sourceName, prompt, automationMode }) {
  return request('post', '/v1alpha/sessions', {
    source: { name: sourceName },
    prompt,
    automationMode,
  });
}

export async function getSessionActivities(julesSessionId) {
  return request('get', `/v1alpha/${julesSessionId}/activities`);
}

export async function approvePlan(julesSessionId) {
  return request('post', `/v1alpha/${julesSessionId}:approvePlan`, {});
}

export async function sendMessage(julesSessionId, message) {
  return request('post', `/v1alpha/${julesSessionId}:sendMessage`, { message });
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p td.server/src/integrations/jules
git add td.server/src/integrations/jules/jules.client.js
git commit -m "feat(jules): add Jules HTTP client"
```

---

## Task 3: Jules Repository

**Files:**
- Create: `td.server/src/repositories/jules.repository.js`

- [ ] **Step 1: Create repository**

```javascript
// td.server/src/repositories/jules.repository.js
import db from '../db/knex.js';

export async function createSession({ julesSessionId, findingId, findingType, sourceName, prompt, automationMode, createdBy }) {
  const [row] = await db('jules_sessions').insert({
    jules_session_id: julesSessionId ?? null,
    finding_id:       findingId,
    finding_type:     findingType,
    source_name:      sourceName,
    prompt,
    automation_mode:  automationMode,
    status:           'pending',
    created_by:       createdBy ?? null,
  }).returning('*');
  return row;
}

export async function updateSession(id, fields) {
  const [row] = await db('jules_sessions')
    .where({ id })
    .update({ ...fields, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

export async function listSessions({ page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const rows = await db('jules_sessions')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .select('*');
  const [{ count }] = await db('jules_sessions').count('id as count');
  return { sessions: rows, total: Number(count), page, limit };
}

export async function getSessionById(id) {
  return db('jules_sessions').where({ id }).first();
}

export async function deleteSession(id) {
  return db('jules_sessions').where({ id }).delete();
}
```

- [ ] **Step 2: Commit**

```bash
git add td.server/src/repositories/jules.repository.js
git commit -m "feat(jules): add Jules repository"
```

---

## Task 4: Jules Service

**Files:**
- Create: `td.server/src/integrations/jules/jules.service.js`

- [ ] **Step 1: Create service**

```javascript
// td.server/src/integrations/jules/jules.service.js
import * as julesClient from './jules.client.js';
import * as julesRepo from '../../repositories/jules.repository.js';
import db from '../../db/knex.js';
import loggerHelper from '../../helpers/logger.helper.js';

const logger = loggerHelper.get('integrations/jules/jules.service.js');

function buildPrompt(finding, promptOverride) {
  const base = `Fix vulnerability ${finding.vuln_id}: ${finding.title ?? 'security vulnerability'} in package ${finding.package_name}${finding.package_version ? `@${finding.package_version}` : ''}.${finding.fixed_version ? ` The fix is available in version ${finding.fixed_version}.` : ''} ${finding.description ? `Details: ${finding.description}` : ''}`.trim();
  return promptOverride ? `${base}\n\nAdditional context: ${promptOverride}` : base;
}

function deriveStatus(activities) {
  if (!activities || activities.length === 0) return 'pending';

  const types = activities.map(a => a.activityType ?? a.type ?? '');

  if (types.some(t => t.includes('PULL_REQUEST') || t.includes('COMPLETE'))) return 'done';
  if (types.some(t => t.includes('ERROR') || t.includes('FAILED'))) return 'error';
  if (types.some(t => t.includes('AWAIT') || t.includes('APPROVAL'))) return 'awaiting_approval';
  if (types.some(t => t.includes('EXECUT') || t.includes('RUN') || t.includes('CODE'))) return 'running';
  if (types.some(t => t.includes('PLAN'))) return 'planning';

  return 'pending';
}

function extractPrUrl(activities) {
  for (const a of activities ?? []) {
    if (a.pullRequest?.url) return a.pullRequest.url;
    if (a.pullRequests?.length) return a.pullRequests[0].url;
  }
  return null;
}

function extractPlanSummary(activities) {
  for (const a of activities ?? []) {
    if (a.plan?.steps || a.plan?.description) {
      return a.plan.description ?? a.plan.steps?.map(s => `• ${s.description ?? s}`).join('\n') ?? null;
    }
  }
  return null;
}

export async function getSources() {
  const data = await julesClient.getSources();
  return data.sources ?? [];
}

export async function createSession({ findingId, sourceName, automationMode, promptOverride, userId }) {
  const finding = await db('osv_scan_findings').where({ id: findingId }).first();
  if (!finding) throw Object.assign(new Error('Finding not found'), { statusCode: 404 });

  const prompt = buildPrompt(finding, promptOverride);

  let julesSessionId = null;
  let status = 'pending';

  try {
    const julesSession = await julesClient.createSession({ sourceName, prompt, automationMode });
    julesSessionId = julesSession.name ?? julesSession.id ?? null;
    status = 'planning';
  } catch (err) {
    logger.warn('Jules API call failed during session creation', err.message);
    status = 'error';
  }

  const session = await julesRepo.createSession({
    julesSessionId,
    findingId,
    findingType: 'osv',
    sourceName,
    prompt,
    automationMode,
    createdBy: userId,
  });

  if (julesSessionId) {
    await julesRepo.updateSession(session.id, { status });
    session.status = status;
  }

  return session;
}

export async function getSessionWithActivities(id) {
  const session = await julesRepo.getSessionById(id);
  if (!session) return null;

  if (!session.jules_session_id || ['done', 'error'].includes(session.status)) {
    return { session, activities: [] };
  }

  let activities = [];
  try {
    const data = await julesClient.getSessionActivities(session.jules_session_id);
    activities = data.activities ?? [];

    const newStatus   = deriveStatus(activities);
    const prUrl       = extractPrUrl(activities);
    const planSummary = extractPlanSummary(activities);

    const updates = {};
    if (newStatus !== session.status)         updates.status       = newStatus;
    if (prUrl && prUrl !== session.pr_url)    updates.pr_url       = prUrl;
    if (planSummary && !session.plan_summary) updates.plan_summary = planSummary;

    if (Object.keys(updates).length) {
      await julesRepo.updateSession(id, updates);
      Object.assign(session, updates);
    }
  } catch (err) {
    logger.warn(`Failed to fetch activities for session ${id}`, err.message);
  }

  return { session, activities };
}

export async function listSessions(opts) {
  return julesRepo.listSessions(opts);
}

export async function approvePlan(id) {
  const session = await julesRepo.getSessionById(id);
  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  if (!session.jules_session_id) throw Object.assign(new Error('Session has no Jules ID'), { statusCode: 409 });
  if (session.status !== 'awaiting_approval') throw Object.assign(new Error('Session is not awaiting approval'), { statusCode: 409 });

  await julesClient.approvePlan(session.jules_session_id);
  return julesRepo.updateSession(id, { status: 'running' });
}

export async function sendMessage(id, message) {
  const session = await julesRepo.getSessionById(id);
  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  if (!session.jules_session_id) throw Object.assign(new Error('Session has no Jules ID'), { statusCode: 409 });

  await julesClient.sendMessage(session.jules_session_id, message);
  return session;
}

export async function deleteSession(id) {
  const deleted = await julesRepo.deleteSession(id);
  if (!deleted) throw Object.assign(new Error('Session not found'), { statusCode: 404 });
}
```

- [ ] **Step 2: Commit**

```bash
git add td.server/src/integrations/jules/jules.service.js
git commit -m "feat(jules): add Jules service layer"
```

---

## Task 5: Jules Controller

**Files:**
- Create: `td.server/src/controllers/jules.controller.js`

- [ ] **Step 1: Create controller**

```javascript
// td.server/src/controllers/jules.controller.js
import * as julesService from '../integrations/jules/jules.service.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/jules.controller.js');

function handleError(res, err) {
  if (err.message === 'JULES_API_KEY is not configured') {
    return res.status(503).json({ error: 'Jules API key is not configured. Set JULES_API_KEY environment variable.' });
  }
  const status = err.statusCode ?? 500;
  return res.status(status).json({ error: err.message ?? 'Internal server error' });
}

export async function listSources(req, res) {
  try {
    const sources = await julesService.getSources();
    return res.json({ sources });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function createSession(req, res) {
  const { finding_id, source_name, automation_mode, prompt_override } = req.body ?? {};

  if (!finding_id)   return res.status(400).json({ error: 'finding_id is required' });
  if (!source_name)  return res.status(400).json({ error: 'source_name is required' });

  const validModes = ['AUTO_CREATE_PR', 'REQUIRE_APPROVAL'];
  const mode = automation_mode ?? 'AUTO_CREATE_PR';
  if (!validModes.includes(mode)) {
    return res.status(400).json({ error: `automation_mode must be one of: ${validModes.join(', ')}` });
  }

  try {
    const session = await julesService.createSession({
      findingId:      finding_id,
      sourceName:     source_name,
      automationMode: mode,
      promptOverride: prompt_override ?? null,
      userId:         req.user?.id ?? null,
    });
    logger.info(`Jules session created by user=${req.user?.id} for finding=${finding_id}`);
    return res.status(201).json({ session });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function listSessions(req, res) {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);

  try {
    const result = await julesService.listSessions({ page, limit });
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function getSession(req, res) {
  const { id } = req.params;
  try {
    const result = await julesService.getSessionWithActivities(id);
    if (!result) return res.status(404).json({ error: 'Session not found' });
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function approveSessionPlan(req, res) {
  const { id } = req.params;
  try {
    const session = await julesService.approvePlan(id);
    logger.info(`Jules plan approved for session=${id} by user=${req.user?.id}`);
    return res.json({ session });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function sendSessionMessage(req, res) {
  const { id } = req.params;
  const { message } = req.body ?? {};

  if (!message) return res.status(400).json({ error: 'message is required' });

  try {
    await julesService.sendMessage(id, message);
    return res.json({ ok: true });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function deleteSession(req, res) {
  const { id } = req.params;
  try {
    await julesService.deleteSession(id);
    logger.info(`Jules session deleted: id=${id} by user=${req.user?.id}`);
    return res.json({ ok: true });
  } catch (err) {
    return handleError(res, err);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add td.server/src/controllers/jules.controller.js
git commit -m "feat(jules): add Jules controller"
```

---

## Task 6: Register Routes

**Files:**
- Modify: `td.server/src/config/routes.config.js`

- [ ] **Step 1: Add import at top of routes file**

Find the block of controller imports (near other `import * as ...Controller` lines) and add:

```javascript
import * as julesController from '../controllers/jules.controller.js';
```

- [ ] **Step 2: Add routes inside the `routes()` function**

Find where other integration routes are registered (near `/api/integrations`) and add after them:

```javascript
  // Jules AI remediation
  router.get('/api/jules/sources',                requireRole('admin', 'analyst', 'viewer'), julesController.listSources);
  router.post('/api/jules/sessions',              requireRole('admin', 'analyst'),           julesController.createSession);
  router.get('/api/jules/sessions',               requireRole('admin', 'analyst', 'viewer'), julesController.listSessions);
  router.get('/api/jules/sessions/:id',           requireRole('admin', 'analyst', 'viewer'), julesController.getSession);
  router.post('/api/jules/sessions/:id/approve',  requireRole('admin', 'analyst'),           julesController.approveSessionPlan);
  router.post('/api/jules/sessions/:id/message',  requireRole('admin', 'analyst'),           julesController.sendSessionMessage);
  router.delete('/api/jules/sessions/:id',        requireRole('admin'),                      julesController.deleteSession);
```

- [ ] **Step 3: Verify server starts**

```bash
cd td.server && node --experimental-vm-modules src/app.js &
sleep 2 && curl -s http://localhost:3001/healthz && kill %1
```

Expected: `{"status":"ok"}` (or similar healthcheck response)

- [ ] **Step 4: Commit**

```bash
git add td.server/src/config/routes.config.js
git commit -m "feat(jules): register Jules API routes"
```

---

## Task 7: Backend Tests

**Files:**
- Create: `td.server/test/controllers/jules.spec.js`

- [ ] **Step 1: Write tests**

```javascript
// td.server/test/controllers/jules.spec.js
import { expect } from 'chai';
import sinon from 'sinon';

// We test the controller layer directly, stubbing the service
import * as julesController from '../../src/controllers/jules.controller.js';
import * as julesService from '../../src/integrations/jules/jules.service.js';

function makeReqRes({ user = { id: 1, role: 'analyst' }, params = {}, body = {}, query = {} } = {}) {
  const req = { user, params, body, query };
  const res = {
    _status: 200, _json: null,
    status(code) { this._status = code; return this; },
    json(data)   { this._json  = data; return this; },
  };
  return { req, res };
}

describe('jules.controller.js', () => {
  afterEach(() => sinon.restore());

  // ── listSources ────────────────────────────────────────────────────────────
  describe('listSources()', () => {
    it('returns sources from service', async () => {
      sinon.stub(julesService, 'getSources').resolves([{ name: 'sources/abc' }]);
      const { req, res } = makeReqRes();
      await julesController.listSources(req, res);
      expect(res._status).to.equal(200);
      expect(res._json.sources).to.deep.equal([{ name: 'sources/abc' }]);
    });

    it('returns 503 when API key not configured', async () => {
      sinon.stub(julesService, 'getSources').rejects(new Error('JULES_API_KEY is not configured'));
      const { req, res } = makeReqRes();
      await julesController.listSources(req, res);
      expect(res._status).to.equal(503);
      expect(res._json.error).to.include('API key');
    });
  });

  // ── createSession ──────────────────────────────────────────────────────────
  describe('createSession()', () => {
    it('returns 400 when finding_id is missing', async () => {
      const { req, res } = makeReqRes({ body: { source_name: 'sources/abc' } });
      await julesController.createSession(req, res);
      expect(res._status).to.equal(400);
      expect(res._json.error).to.include('finding_id');
    });

    it('returns 400 when source_name is missing', async () => {
      const { req, res } = makeReqRes({ body: { finding_id: 'finding-123' } });
      await julesController.createSession(req, res);
      expect(res._status).to.equal(400);
      expect(res._json.error).to.include('source_name');
    });

    it('returns 400 for invalid automation_mode', async () => {
      const { req, res } = makeReqRes({ body: { finding_id: 'f1', source_name: 's1', automation_mode: 'INVALID' } });
      await julesController.createSession(req, res);
      expect(res._status).to.equal(400);
    });

    it('creates session with valid payload', async () => {
      const fakeSession = { id: 'uuid-1', status: 'planning' };
      sinon.stub(julesService, 'createSession').resolves(fakeSession);
      const { req, res } = makeReqRes({ body: { finding_id: 'f1', source_name: 'sources/abc', automation_mode: 'AUTO_CREATE_PR' } });
      await julesController.createSession(req, res);
      expect(res._status).to.equal(201);
      expect(res._json.session).to.deep.equal(fakeSession);
    });

    it('defaults automation_mode to AUTO_CREATE_PR', async () => {
      const stub = sinon.stub(julesService, 'createSession').resolves({ id: 'uuid-2', status: 'planning' });
      const { req, res } = makeReqRes({ body: { finding_id: 'f1', source_name: 'sources/abc' } });
      await julesController.createSession(req, res);
      expect(stub.calledOnce).to.be.true;
      expect(stub.firstCall.args[0].automationMode).to.equal('AUTO_CREATE_PR');
    });
  });

  // ── getSession ─────────────────────────────────────────────────────────────
  describe('getSession()', () => {
    it('returns 404 when session not found', async () => {
      sinon.stub(julesService, 'getSessionWithActivities').resolves(null);
      const { req, res } = makeReqRes({ params: { id: 'no-exist' } });
      await julesController.getSession(req, res);
      expect(res._status).to.equal(404);
    });

    it('returns session and activities', async () => {
      const data = { session: { id: 'uuid-1', status: 'running' }, activities: [] };
      sinon.stub(julesService, 'getSessionWithActivities').resolves(data);
      const { req, res } = makeReqRes({ params: { id: 'uuid-1' } });
      await julesController.getSession(req, res);
      expect(res._status).to.equal(200);
      expect(res._json).to.deep.equal(data);
    });
  });

  // ── approveSessionPlan ─────────────────────────────────────────────────────
  describe('approveSessionPlan()', () => {
    it('returns 409 when service throws statusCode 409', async () => {
      const err = Object.assign(new Error('Session is not awaiting approval'), { statusCode: 409 });
      sinon.stub(julesService, 'approvePlan').rejects(err);
      const { req, res } = makeReqRes({ params: { id: 'uuid-1' } });
      await julesController.approveSessionPlan(req, res);
      expect(res._status).to.equal(409);
    });
  });

  // ── deleteSession ──────────────────────────────────────────────────────────
  describe('deleteSession()', () => {
    it('returns 200 on success', async () => {
      sinon.stub(julesService, 'deleteSession').resolves();
      const { req, res } = makeReqRes({ params: { id: 'uuid-1' } });
      await julesController.deleteSession(req, res);
      expect(res._status).to.equal(200);
      expect(res._json.ok).to.be.true;
    });

    it('returns 404 when not found', async () => {
      const err = Object.assign(new Error('Session not found'), { statusCode: 404 });
      sinon.stub(julesService, 'deleteSession').rejects(err);
      const { req, res } = makeReqRes({ params: { id: 'no-exist' } });
      await julesController.deleteSession(req, res);
      expect(res._status).to.equal(404);
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd td.server && npm test -- --grep "jules.controller"
```

Expected: All tests pass (green)

- [ ] **Step 3: Commit**

```bash
git add td.server/test/controllers/jules.spec.js
git commit -m "test(jules): add Jules controller tests"
```

---

## Task 8: Frontend API Client

**Files:**
- Create: `ct.client/src/api/jules.ts`

- [ ] **Step 1: Create API client**

```typescript
// ct.client/src/api/jules.ts
import { apiClient } from './client';

export type AutomationMode = 'AUTO_CREATE_PR' | 'REQUIRE_APPROVAL';
export type JulesStatus = 'pending' | 'planning' | 'awaiting_approval' | 'running' | 'done' | 'error';

export interface JulesSource {
  name: string;
  displayName?: string;
}

export interface JulesSession {
  id: string;
  jules_session_id: string | null;
  finding_id: string;
  finding_type: string;
  source_name: string;
  prompt: string;
  automation_mode: AutomationMode;
  status: JulesStatus;
  plan_summary: string | null;
  pr_url: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface JulesActivity {
  name?: string;
  activityType?: string;
  type?: string;
  message?: string;
  plan?: { description?: string; steps?: Array<{ description?: string }> };
  pullRequest?: { url: string };
  createTime?: string;
}

export interface CreateSessionPayload {
  finding_id: string;
  source_name: string;
  automation_mode: AutomationMode;
  prompt_override?: string;
}

export async function listSources(): Promise<JulesSource[]> {
  const { data } = await apiClient.get<{ sources: JulesSource[] }>('/jules/sources');
  return data.sources ?? [];
}

export async function createSession(payload: CreateSessionPayload): Promise<JulesSession> {
  const { data } = await apiClient.post<{ session: JulesSession }>('/jules/sessions', payload);
  return data.session;
}

export async function listSessions(page = 1, limit = 20): Promise<{ sessions: JulesSession[]; total: number; page: number; limit: number }> {
  const { data } = await apiClient.get('/jules/sessions', { params: { page, limit } });
  return data;
}

export async function getSession(id: string): Promise<{ session: JulesSession; activities: JulesActivity[] }> {
  const { data } = await apiClient.get(`/jules/sessions/${id}`);
  return data;
}

export async function approvePlan(id: string): Promise<JulesSession> {
  const { data } = await apiClient.post<{ session: JulesSession }>(`/jules/sessions/${id}/approve`);
  return data.session;
}

export async function sendMessage(id: string, message: string): Promise<void> {
  await apiClient.post(`/jules/sessions/${id}/message`, { message });
}

export async function deleteSession(id: string): Promise<void> {
  await apiClient.delete(`/jules/sessions/${id}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add ct.client/src/api/jules.ts
git commit -m "feat(jules): add frontend Jules API client"
```

---

## Task 9: Zustand Store

**Files:**
- Create: `ct.client/src/store/julesStore.ts`

- [ ] **Step 1: Create store**

```typescript
// ct.client/src/store/julesStore.ts
import { create } from 'zustand';
import * as julesApi from '../api/jules';
import type { JulesSession, JulesActivity, CreateSessionPayload } from '../api/jules';

const POLL_INTERVAL_MS = 5000;
const TERMINAL_STATUSES = new Set(['done', 'error']);

interface JulesState {
  sessions: JulesSession[];
  total: number;
  detailSession: JulesSession | null;
  detailActivities: JulesActivity[];
  pollingIds: Set<string>;

  fetchSessions: (page?: number) => Promise<void>;
  createSession: (payload: CreateSessionPayload) => Promise<JulesSession>;
  fetchSessionDetail: (id: string) => Promise<void>;
  startPolling: (id: string) => void;
  stopPolling: (id: string) => void;
  approvePlan: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearDetail: () => void;
}

// Polling timers stored outside Zustand to avoid serialisation issues
const _timers = new Map<string, ReturnType<typeof setInterval>>();

export const useJulesStore = create<JulesState>((set, get) => ({
  sessions: [],
  total: 0,
  detailSession: null,
  detailActivities: [],
  pollingIds: new Set(),

  fetchSessions: async (page = 1) => {
    const result = await julesApi.listSessions(page);
    set({ sessions: result.sessions, total: result.total });
  },

  createSession: async (payload) => {
    const session = await julesApi.createSession(payload);
    set(s => ({ sessions: [session, ...s.sessions], total: s.total + 1 }));
    if (!TERMINAL_STATUSES.has(session.status)) {
      get().startPolling(session.id);
    }
    return session;
  },

  fetchSessionDetail: async (id) => {
    const { session, activities } = await julesApi.getSession(id);
    set({ detailSession: session, detailActivities: activities });

    // update in sessions list too
    set(s => ({
      sessions: s.sessions.map(ss => ss.id === id ? session : ss),
    }));
  },

  startPolling: (id) => {
    if (_timers.has(id)) return;
    set(s => ({ pollingIds: new Set([...s.pollingIds, id]) }));

    const timer = setInterval(async () => {
      const { session } = await julesApi.getSession(id);
      set(s => ({
        sessions: s.sessions.map(ss => ss.id === id ? session : ss),
        detailSession: s.detailSession?.id === id ? session : s.detailSession,
      }));

      if (TERMINAL_STATUSES.has(session.status)) {
        get().stopPolling(id);
      }
    }, POLL_INTERVAL_MS);

    _timers.set(id, timer);
  },

  stopPolling: (id) => {
    const timer = _timers.get(id);
    if (timer) { clearInterval(timer); _timers.delete(id); }
    set(s => {
      const next = new Set(s.pollingIds);
      next.delete(id);
      return { pollingIds: next };
    });
  },

  approvePlan: async (id) => {
    const session = await julesApi.approvePlan(id);
    set(s => ({
      sessions: s.sessions.map(ss => ss.id === id ? session : ss),
      detailSession: s.detailSession?.id === id ? session : s.detailSession,
    }));
    get().startPolling(id);
  },

  deleteSession: async (id) => {
    get().stopPolling(id);
    await julesApi.deleteSession(id);
    set(s => ({ sessions: s.sessions.filter(ss => ss.id !== id), total: Math.max(0, s.total - 1) }));
  },

  clearDetail: () => set({ detailSession: null, detailActivities: [] }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add ct.client/src/store/julesStore.ts
git commit -m "feat(jules): add Jules Zustand store with polling"
```

---

## Task 10: JulesStatusBadge Component

**Files:**
- Create: `ct.client/src/components/Jules/JulesStatusBadge.tsx`

- [ ] **Step 1: Create component**

```tsx
// ct.client/src/components/Jules/JulesStatusBadge.tsx
import React from 'react';
import type { JulesStatus } from '../../api/jules';

const STATUS_CONFIG: Record<JulesStatus, { label: string; color: string; pulse?: boolean }> = {
  pending:           { label: 'PENDING',            color: 'var(--on-surface-muted)' },
  planning:          { label: 'PLANNING',            color: 'var(--primary)',  pulse: true },
  awaiting_approval: { label: 'AWAITING APPROVAL',   color: '#f59e0b' },
  running:           { label: 'RUNNING',             color: 'var(--primary)',  pulse: true },
  done:              { label: 'DONE',                color: '#52c41a' },
  error:             { label: 'ERROR',               color: 'var(--error)' },
};

export function JulesStatusBadge({ status }: { status: JulesStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '2px 8px', borderRadius: '4px', fontSize: '10px',
      fontFamily: 'var(--font-label)', letterSpacing: '0.5px',
      background: `${cfg.color}18`, color: cfg.color,
      border: `1px solid ${cfg.color}40`,
    }}>
      {cfg.pulse && (
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: cfg.color,
          animation: 'jules-pulse 1.4s ease-in-out infinite',
        }} />
      )}
      {cfg.label}
    </span>
  );
}
```

- [ ] **Step 2: Add pulse animation to index.css**

Find the end of `ct.client/src/index.css` and append:

```css
@keyframes jules-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.85); }
}
```

- [ ] **Step 3: Commit**

```bash
git add ct.client/src/components/Jules/JulesStatusBadge.tsx ct.client/src/index.css
git commit -m "feat(jules): add JulesStatusBadge component"
```

---

## Task 11: JulesCreateSessionModal Component

**Files:**
- Create: `ct.client/src/components/Jules/JulesCreateSessionModal.tsx`

- [ ] **Step 1: Create modal component**

```tsx
// ct.client/src/components/Jules/JulesCreateSessionModal.tsx
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listSources } from '../../api/jules';
import { useJulesStore } from '../../store/julesStore';
import type { AutomationMode, JulesSession } from '../../api/jules';
import type { ScanFinding } from '../../api/scanner';

interface Props {
  finding: ScanFinding;
  onClose: () => void;
  onCreated?: (session: JulesSession) => void;
}

export function JulesCreateSessionModal({ finding, onClose, onCreated }: Props) {
  const [sourceName, setSourceName]     = useState('');
  const [mode, setMode]                 = useState<AutomationMode>('AUTO_CREATE_PR');
  const [promptOverride, setPrompt]     = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const createSession = useJulesStore(s => s.createSession);

  const { data: sources, isLoading: sourcesLoading, error: sourcesError } = useQuery({
    queryKey: ['jules-sources'],
    queryFn:  listSources,
    retry: false,
  });

  useEffect(() => {
    if (sources?.length && !sourceName) setSourceName(sources[0].name);
  }, [sources]);

  const defaultPrompt = `Fix vulnerability ${finding.vuln_id}: ${finding.title ?? 'security vulnerability'} in package ${finding.package_name}${finding.package_version ? `@${finding.package_version}` : ''}.${finding.fixed_version ? ` Upgrade to ${finding.fixed_version}.` : ''}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceName) { setError('Select a repository'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const session = await createSession({
        finding_id:     finding.id,
        source_name:    sourceName,
        automation_mode: mode,
        prompt_override: promptOverride.trim() || undefined,
      });
      onCreated?.(session);
      onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create session');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--surface)', border: '1px solid rgba(0,242,255,0.2)', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '500px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: 'var(--primary)', fontFamily: 'var(--font-label)', letterSpacing: '1px', fontSize: '14px' }}>
            REMEDIAR COM JULES
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--on-surface-muted)', cursor: 'pointer', fontSize: '18px' }}>×</button>
        </div>

        <div style={{ marginBottom: '16px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '12px', color: 'var(--on-surface-muted)' }}>
          <span style={{ color: 'var(--error)', fontWeight: 600 }}>{finding.vuln_id}</span>
          {' — '}{finding.package_name}{finding.package_version ? `@${finding.package_version}` : ''}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Source */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--on-surface-muted)', marginBottom: '6px', letterSpacing: '0.5px' }}>
              REPOSITÓRIO GITHUB
            </label>
            {sourcesLoading && <p style={{ color: 'var(--on-surface-muted)', fontSize: '12px' }}>Loading repositories…</p>}
            {sourcesError && <p style={{ color: 'var(--error)', fontSize: '12px' }}>Could not load repositories. Check Jules API key.</p>}
            {sources && (
              <select
                value={sourceName}
                onChange={e => setSourceName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#e2e8f0', fontSize: '13px' }}
              >
                {sources.map(s => (
                  <option key={s.name} value={s.name}>{s.displayName ?? s.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Mode toggle */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--on-surface-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>
              MODO DE AUTOMAÇÃO
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['AUTO_CREATE_PR', 'REQUIRE_APPROVAL'] as AutomationMode[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '6px', cursor: 'pointer',
                    border: mode === m ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                    background: mode === m ? 'rgba(0,242,255,0.1)' : 'rgba(255,255,255,0.03)',
                    color: mode === m ? 'var(--primary)' : 'var(--on-surface-muted)',
                    fontSize: '11px', fontFamily: 'var(--font-label)', letterSpacing: '0.3px',
                  }}
                >
                  {m === 'AUTO_CREATE_PR' ? 'Auto PR' : 'Aprovação Manual'}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--on-surface-muted)', marginBottom: '6px', letterSpacing: '0.5px' }}>
              PROMPT (editável)
            </label>
            <textarea
              rows={4}
              value={promptOverride || defaultPrompt}
              onChange={e => setPrompt(e.target.value)}
              style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#e2e8f0', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }}
            />
          </div>

          {error && (
            <p style={{ color: 'var(--error)', fontSize: '12px', marginBottom: '14px' }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--on-surface-muted)', cursor: 'pointer', fontSize: '13px' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || sourcesLoading || !sourceName}
              style={{
                padding: '8px 20px', borderRadius: '6px', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                background: submitting ? 'rgba(0,242,255,0.3)' : 'var(--primary)', color: '#000', fontWeight: 600, fontSize: '13px',
              }}
            >
              {submitting ? 'Criando…' : 'Criar Sessão Jules'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ct.client/src/components/Jules/JulesCreateSessionModal.tsx
git commit -m "feat(jules): add JulesCreateSessionModal"
```

---

## Task 12: JulesActivityFeed & JulesSessionDetail

**Files:**
- Create: `ct.client/src/components/Jules/JulesActivityFeed.tsx`
- Create: `ct.client/src/components/Jules/JulesSessionDetail.tsx`

- [ ] **Step 1: Create JulesActivityFeed**

```tsx
// ct.client/src/components/Jules/JulesActivityFeed.tsx
import React from 'react';
import type { JulesActivity } from '../../api/jules';

export function JulesActivityFeed({ activities }: { activities: JulesActivity[] }) {
  if (!activities.length) {
    return <p style={{ fontSize: '12px', color: 'var(--on-surface-muted)', textAlign: 'center', padding: '20px 0' }}>Aguardando atividades do Jules…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {activities.map((a, i) => (
        <div key={i} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: '2px solid rgba(0,242,255,0.3)' }}>
          <div style={{ fontSize: '10px', color: 'var(--on-surface-muted)', marginBottom: '4px', letterSpacing: '0.3px' }}>
            {a.activityType ?? a.type ?? 'ACTIVITY'}
            {a.createTime && ` · ${new Date(a.createTime).toLocaleTimeString()}`}
          </div>
          {a.message && <p style={{ margin: 0, fontSize: '12px', color: '#e2e8f0' }}>{a.message}</p>}
          {a.plan?.description && <p style={{ margin: 0, fontSize: '12px', color: '#e2e8f0' }}>{a.plan.description}</p>}
          {a.pullRequest?.url && (
            <a href={a.pullRequest.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--primary)' }}>
              Ver Pull Request →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create JulesSessionDetail**

```tsx
// ct.client/src/components/Jules/JulesSessionDetail.tsx
import React from 'react';
import { useJulesStore } from '../../store/julesStore';
import { JulesStatusBadge } from './JulesStatusBadge';
import { JulesActivityFeed } from './JulesActivityFeed';

export function JulesSessionDetail({ onClose }: { onClose: () => void }) {
  const session    = useJulesStore(s => s.detailSession);
  const activities = useJulesStore(s => s.detailActivities);
  const approvePlan = useJulesStore(s => s.approvePlan);
  const deleteSession = useJulesStore(s => s.deleteSession);

  if (!session) return null;

  async function handleApprove() {
    await approvePlan(session!.id);
  }

  async function handleDelete() {
    if (confirm('Remover esta sessão Jules do histórico?')) {
      await deleteSession(session!.id);
      onClose();
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', justifyContent: 'flex-end', zIndex: 900,
      background: 'rgba(0,0,0,0.5)',
    }} onClick={onClose}>
      <div
        style={{ width: '480px', maxWidth: '100vw', background: 'var(--surface)', borderLeft: '1px solid rgba(0,242,255,0.15)', padding: '28px', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--primary)', fontFamily: 'var(--font-label)', letterSpacing: '1px' }}>
              SESSÃO JULES
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--on-surface-muted)' }}>
              {session.finding_id} · {session.source_name.split('/').pop()}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--on-surface-muted)', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>

        {/* Status + PR link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <JulesStatusBadge status={session.status} />
          {session.pr_url && (
            <a href={session.pr_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--primary)' }}>
              Ver PR →
            </a>
          )}
        </div>

        {/* Approve plan button */}
        {session.status === 'awaiting_approval' && (
          <button
            onClick={handleApprove}
            style={{
              width: '100%', padding: '10px', marginBottom: '20px',
              background: '#f59e0b', border: 'none', borderRadius: '6px',
              color: '#000', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            }}
          >
            Aprovar Plano Jules
          </button>
        )}

        {/* Prompt */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--on-surface-muted)', letterSpacing: '0.5px' }}>PROMPT</p>
          <pre style={{ margin: 0, padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '11px', color: '#e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {session.prompt}
          </pre>
        </div>

        {/* Plan summary */}
        {session.plan_summary && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--on-surface-muted)', letterSpacing: '0.5px' }}>PLANO</p>
            <pre style={{ margin: 0, padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '11px', color: '#e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {session.plan_summary}
            </pre>
          </div>
        )}

        {/* Activities */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--on-surface-muted)', letterSpacing: '0.5px' }}>ATIVIDADES</p>
          <JulesActivityFeed activities={activities} />
        </div>

        {/* Delete */}
        <button
          onClick={handleDelete}
          style={{ padding: '6px 14px', border: '1px solid rgba(255,80,80,0.3)', borderRadius: '6px', background: 'transparent', color: 'var(--error)', cursor: 'pointer', fontSize: '12px' }}
        >
          Remover Sessão
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add ct.client/src/components/Jules/JulesActivityFeed.tsx ct.client/src/components/Jules/JulesSessionDetail.tsx
git commit -m "feat(jules): add JulesActivityFeed and JulesSessionDetail"
```

---

## Task 13: JulesButton Component

**Files:**
- Create: `ct.client/src/components/Jules/JulesButton.tsx`

- [ ] **Step 1: Create button component**

```tsx
// ct.client/src/components/Jules/JulesButton.tsx
import React, { useState } from 'react';
import { JulesCreateSessionModal } from './JulesCreateSessionModal';
import type { ScanFinding } from '../../api/scanner';

interface Props {
  finding: ScanFinding;
  julesConfigured?: boolean;
}

export function JulesButton({ finding, julesConfigured = true }: Props) {
  const [showModal, setShowModal] = useState(false);

  if (!julesConfigured) {
    return (
      <span title="Configure JULES_API_KEY para usar esta feature" style={{ cursor: 'not-allowed' }}>
        <button
          disabled
          style={{
            padding: '3px 10px', borderRadius: '4px', fontSize: '10px', cursor: 'not-allowed',
            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
            color: 'var(--on-surface-muted)', fontFamily: 'var(--font-label)', letterSpacing: '0.3px',
          }}
        >
          Jules
        </button>
      </span>
    );
  }

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setShowModal(true); }}
        style={{
          padding: '3px 10px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer',
          border: '1px solid rgba(0,242,255,0.3)', background: 'rgba(0,242,255,0.08)',
          color: 'var(--primary)', fontFamily: 'var(--font-label)', letterSpacing: '0.3px',
        }}
      >
        Jules
      </button>
      {showModal && (
        <JulesCreateSessionModal
          finding={finding}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ct.client/src/components/Jules/JulesButton.tsx
git commit -m "feat(jules): add JulesButton inline component"
```

---

## Task 14: JulesView (Dedicated Tab)

**Files:**
- Create: `ct.client/src/views/JulesView.tsx`

- [ ] **Step 1: Create view**

```tsx
// ct.client/src/views/JulesView.tsx
import React, { useEffect, useState } from 'react';
import { useJulesStore } from '../store/julesStore';
import { JulesStatusBadge } from '../components/Jules/JulesStatusBadge';
import { JulesSessionDetail } from '../components/Jules/JulesSessionDetail';
import type { JulesSession } from '../api/jules';

export default function JulesView() {
  const { sessions, total, fetchSessions, fetchSessionDetail, startPolling, clearDetail } = useJulesStore();
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    fetchSessions()
      .catch(err => setError(err?.response?.data?.error ?? err.message ?? 'Erro ao carregar sessões'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Resume polling for non-terminal sessions on mount
    const TERMINAL = new Set(['done', 'error']);
    sessions.forEach(s => {
      if (!TERMINAL.has(s.status)) startPolling(s.id);
    });
  }, [sessions.length]);

  async function openDetail(session: JulesSession) {
    await fetchSessionDetail(session.id);
    setShowDetail(true);
  }

  function closeDetail() {
    clearDetail();
    setShowDetail(false);
    fetchSessions(); // refresh list
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 className="label-text glow-text-cyan" style={{ margin: 0, fontSize: '16px', letterSpacing: '2px' }}>
          JULES — REMEDIAÇÃO AUTOMÁTICA
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--on-surface-muted)' }}>
          Sessões de remediação de vulnerabilidades via Google Jules AI. Dispare sessões diretamente nas abas Scanner ou ATT&CK.
        </p>
      </div>

      {loading && <p style={{ color: 'var(--on-surface-muted)', fontSize: '13px' }}>Carregando sessões…</p>}

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: '8px', color: 'var(--error)', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {!loading && sessions.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--on-surface-muted)', fontSize: '13px' }}>
          Nenhuma sessão Jules criada ainda.<br />
          Clique em <strong>Jules</strong> em qualquer vulnerabilidade na aba Scanner para iniciar.
        </div>
      )}

      {sessions.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Finding', 'Repositório', 'Modo', 'Status', 'PR', 'Data', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--on-surface-muted)', fontWeight: 500, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr
                  key={s.id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => openDetail(s)}
                >
                  <td style={{ padding: '10px 12px', color: 'var(--primary)', fontFamily: 'monospace', fontSize: '11px' }}>
                    {s.finding_id.slice(0, 24)}…
                  </td>
                  <td style={{ padding: '10px 12px', color: '#e2e8f0', fontSize: '11px' }}>
                    {s.source_name.split('/').pop()}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--on-surface-muted)', fontSize: '11px' }}>
                    {s.automation_mode === 'AUTO_CREATE_PR' ? 'Auto PR' : 'Manual'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <JulesStatusBadge status={s.status} />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {s.pr_url
                      ? <a href={s.pr_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)', fontSize: '11px' }}>Ver PR →</a>
                      : <span style={{ color: 'var(--on-surface-muted)', fontSize: '11px' }}>–</span>
                    }
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--on-surface-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                    {new Date(s.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--on-surface-muted)', fontSize: '11px' }}>
                    Detalhes →
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: '11px', color: 'var(--on-surface-muted)', marginTop: '8px', textAlign: 'right' }}>
            {sessions.length} de {total} sessões
          </p>
        </div>
      )}

      {showDetail && <JulesSessionDetail onClose={closeDetail} />}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ct.client/src/views/JulesView.tsx
git commit -m "feat(jules): add JulesView dedicated tab"
```

---

## Task 15: Wire Navigation in App.tsx

**Files:**
- Modify: `ct.client/src/App.tsx`

- [ ] **Step 1: Add import at top**

After existing view imports, add:

```typescript
import JulesView from './views/JulesView';
```

- [ ] **Step 2: Add Jules SVG icon**

After the existing icon definitions (e.g., after `IconScanner`), add:

```typescript
const IconJules = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>;
```

- [ ] **Step 3: Add to BASE_MENU array**

After the `Scanner` menu item, add:

```typescript
  { id: 'Jules', icon: <IconJules /> },
```

- [ ] **Step 4: Add to renderView switch**

After the `Scanner` case, add:

```typescript
      case 'Jules': return <JulesView />;
```

- [ ] **Step 5: Commit**

```bash
git add ct.client/src/App.tsx
git commit -m "feat(jules): add Jules to main navigation"
```

---

## Task 16: Add JulesButton to FindingsTable in ScannerView

**Files:**
- Modify: `ct.client/src/views/ScannerView.tsx`

- [ ] **Step 1: Add import**

At the top of `ScannerView.tsx`, after existing imports, add:

```typescript
import { JulesButton } from '../components/Jules/JulesButton';
```

- [ ] **Step 2: Add "Jules" column header**

Find the headers array in `FindingsTable` (line ~226):

```typescript
{['Package', 'Version', 'Ecosystem', 'Vuln ID', 'Summary', 'Sev.', 'CVSS', 'Fixed In'].map(h => (
```

Change to:

```typescript
{['Package', 'Version', 'Ecosystem', 'Vuln ID', 'Summary', 'Sev.', 'CVSS', 'Fixed In', ''].map(h => (
```

- [ ] **Step 3: Add JulesButton cell to each finding row**

Find the last `<td>` in the findings row (the one with `fixed_version`, line ~268):

```tsx
                  <td style={{ padding: '8px 10px', color: f.fixed_version ? '#52c41a' : 'var(--on-surface-muted)', fontFamily: 'monospace', fontSize: '11px' }}>
                    {f.fixed_version ?? '–'}
                  </td>
```

Add this new `<td>` immediately after it, before the closing `</tr>`:

```tsx
                  <td style={{ padding: '8px 6px' }}>
                    <JulesButton finding={f} />
                  </td>
```

- [ ] **Step 4: Commit**

```bash
git add ct.client/src/views/ScannerView.tsx
git commit -m "feat(jules): add Jules button to vulnerability findings table"
```

---

## Task 17: Set Jules API Key and Final Verification

- [ ] **Step 1: Set environment variable**

Add to `td.server/.env` (create if it doesn't exist):

```
JULES_API_KEY=<your-key-from-jules.google.com/settings>
```

- [ ] **Step 2: Start backend and frontend**

```bash
cd /path/to/project && npm run dev
```

- [ ] **Step 3: Verify backend endpoints respond**

```bash
curl -s http://localhost:3001/api/jules/sources -H "Authorization: Bearer <token>"
```

Expected: `{ "sources": [...] }` or `401` if no token (not `503`)

- [ ] **Step 4: Verify Jules tab appears in navigation**

Open http://localhost:5173 → confirm "Jules" appears in sidebar

- [ ] **Step 5: Verify Jules button appears in Scanner**

Navigate to Scanner → run a scan or view existing findings → confirm "Jules" button appears on each row

- [ ] **Step 6: Run full backend test suite**

```bash
cd td.server && npm test
```

Expected: All tests pass

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat(jules): complete Jules integration — ready for use"
```
