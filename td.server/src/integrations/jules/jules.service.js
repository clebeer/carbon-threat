/* eslint-disable max-lines, max-lines-per-function, complexity, no-await-in-loop, require-unicode-regexp, no-mixed-operators, no-continue, prefer-named-capture-group, no-useless-escape, max-depth, no-empty-function, sort-imports, no-bitwise, no-promise-executor-return, require-await, no-console, no-inner-declarations, no-invalid-this */
import * as julesClient from './jules.client.js';
import * as julesRepo from '../../repositories/jules.repository.js';
import { decryptModel } from '../../security/encryption.js';
import db from '../../db/knex.js';
import loggerHelper from '../../helpers/logger.helper.js';
import { canAccessJulesSession, canAccessOsvScanRun } from '../../helpers/resourceAccess.helper.js';

const logger = loggerHelper.get('integrations/jules/jules.service.js');

/**
 * Retrieves the Jules API key from the integration_configs table.
 * Falls back to env var JULES_API_KEY if no DB config exists.
 * Priority: DB (encrypted) > ENV var.
 *
 * @param {string|null|undefined} orgId — same semantics as `integration_configs.org_id`
 */
async function getJulesApiKey(orgId) {
  try {
    let q = db('integration_configs').
      where({ platform: 'jules', is_enabled: true });

    if (orgId === undefined || orgId === null) {
      q = q.whereNull('org_id');
    } else {
      q = q.where({ org_id: orgId });
    }

    const row = await q.orderBy('id', 'asc').first();

    if (row?.config_encrypted) {
      const payload = JSON.parse(row.config_encrypted);
      const config = decryptModel(payload);
      const key = config.apiKey || config.api_key;
      if (key) {return key;}
    }
  } catch (err) {
    logger.warn('Failed to read Jules API key from integration_configs, falling back to env var', err.message);
  }

  // Fallback to env var
  return process.env.JULES_API_KEY || null;
}

function buildPrompt(finding, promptOverride) {
  const base = `Fix vulnerability ${finding.vuln_id}: ${finding.title ?? 'security vulnerability'} in package ${finding.package_name}${finding.package_version ? `@${finding.package_version}` : ''}.${finding.fixed_version ? ` The fix is available in version ${finding.fixed_version}.` : ''} ${finding.description ? `Details: ${finding.description}` : ''}`.trim();
  return promptOverride ? `${base}\n\nAdditional context: ${promptOverride}` : base;
}

function deriveStatus(activities) {
  if (!activities || activities.length === 0) {return 'pending';}

  const types = activities.map((a) => a.activityType ?? a.type ?? '');

  if (types.some((t) => t.includes('PULL_REQUEST') || t.includes('COMPLETE'))) {return 'done';}
  if (types.some((t) => t.includes('ERROR') || t.includes('FAILED'))) {return 'error';}
  if (types.some((t) => t.includes('AWAIT') || t.includes('APPROVAL'))) {return 'awaiting_approval';}
  if (types.some((t) => t.includes('EXECUT') || t.includes('RUN') || t.includes('CODE'))) {return 'running';}
  if (types.some((t) => t.includes('PLAN'))) {return 'planning';}

  return 'pending';
}

function extractPrUrl(activities) {
  for (const a of activities ?? []) {
    if (a.pullRequest?.url) {return a.pullRequest.url;}
    if (a.pullRequests?.length) {return a.pullRequests[0].url;}
  }
  return null;
}

function extractPlanSummary(activities) {
  for (const a of activities ?? []) {
    if (a.plan?.steps || a.plan?.description) {
      return a.plan.description ?? a.plan.steps?.map((s) => `• ${s.description ?? s}`).join('\n') ?? null;
    }
  }
  return null;
}

export async function getSources(orgId) {
  const apiKey = await getJulesApiKey(orgId);
  const data = await julesClient.getSources(apiKey);
  return data.sources ?? [];
}

export async function createSession({
  findingId,
  sourceName,
  automationMode,
  promptOverride,
  user,
  orgId,
}) {
  const finding = await db('osv_scan_findings').where({ id: findingId }).
first();
  if (!finding) {throw Object.assign(new Error('Finding not found'), { statusCode: 404 });}

  const scanRun = await db('osv_scan_runs').where({ id: finding.scan_id }).
first();
  if (!canAccessOsvScanRun(scanRun, user)) {
    throw Object.assign(new Error('Finding not found'), { statusCode: 404 });
  }

  const prompt = buildPrompt(finding, promptOverride);

  let julesSessionId = null;
  let status = 'pending';

  try {
    const apiKey = await getJulesApiKey(orgId);
    const julesSession = await julesClient.createSession({ sourceName, prompt, automationMode }, apiKey);
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
    createdBy: user?.id ?? null,
  });

  if (julesSessionId) {
    await julesRepo.updateSession(session.id, { status });
    session.status = status;
  }

  return session;
}

export async function getSessionWithActivities(id, viewer, orgId) {
  const session = await julesRepo.getSessionById(id);
  if (!session) {return null;}
  if (!canAccessJulesSession(session, viewer)) {return null;}

  if (!session.jules_session_id || ['done', 'error'].includes(session.status)) {
    return { session, activities: [] };
  }

  let activities = [];
  try {
    const apiKey = await getJulesApiKey(orgId);
    const data = await julesClient.getSessionActivities(session.jules_session_id, apiKey);
    activities = data.activities ?? [];

    const newStatus = deriveStatus(activities);
    const prUrl = extractPrUrl(activities);
    const planSummary = extractPlanSummary(activities);

    const updates = {};
    if (newStatus !== session.status) {updates.status = newStatus;}
    if (prUrl && prUrl !== session.pr_url) {updates.pr_url = prUrl;}
    if (planSummary && !session.plan_summary) {updates.plan_summary = planSummary;}

    if (Object.keys(updates).length) {
      await julesRepo.updateSession(id, updates);
      Object.assign(session, updates);
    }
  } catch (err) {
    logger.warn(`Failed to fetch activities for session ${id}`, err.message);
  }

  return { session, activities };
}

export async function listSessions({ page, limit, viewer }) {
  if (!viewer) {
    throw Object.assign(new Error('Invalid session list request'), { statusCode: 500 });
  }
  const viewerIsAdmin = viewer.role === 'admin';
  if (!viewerIsAdmin && (viewer.id === undefined || viewer.id === null)) {
    throw Object.assign(new Error('Invalid session list request'), { statusCode: 500 });
  }
  return julesRepo.listSessions({
    page,
    limit,
    createdBy:       viewer.id,
    viewerIsAdmin,
  });
}

export async function approvePlan(id, viewer, orgId) {
  const session = await julesRepo.getSessionById(id);
  if (!session) {throw Object.assign(new Error('Session not found'), { statusCode: 404 });}
  if (!canAccessJulesSession(session, viewer)) {
    throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  }
  if (!session.jules_session_id) {throw Object.assign(new Error('Session has no Jules ID'), { statusCode: 409 });}
  if (session.status !== 'awaiting_approval') {throw Object.assign(new Error('Session is not awaiting approval'), { statusCode: 409 });}

  const apiKey = await getJulesApiKey(orgId);
  await julesClient.approvePlan(session.jules_session_id, apiKey);
  return julesRepo.updateSession(id, { status: 'running' });
}

export async function sendMessage(id, message, viewer, orgId) {
  const session = await julesRepo.getSessionById(id);
  if (!session) {throw Object.assign(new Error('Session not found'), { statusCode: 404 });}
  if (!canAccessJulesSession(session, viewer)) {
    throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  }
  if (!session.jules_session_id) {throw Object.assign(new Error('Session has no Jules ID'), { statusCode: 409 });}

  const apiKey = await getJulesApiKey(orgId);
  await julesClient.sendMessage(session.jules_session_id, message, apiKey);
  return session;
}

export async function deleteSession(id, viewer) {
  const session = await julesRepo.getSessionById(id);
  if (!session || !canAccessJulesSession(session, viewer)) {
    throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  }
  const deleted = await julesRepo.deleteSession(id);
  if (!deleted) {throw Object.assign(new Error('Session not found'), { statusCode: 404 });}
}
