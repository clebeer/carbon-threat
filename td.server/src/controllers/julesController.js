/* eslint-disable max-lines, max-lines-per-function, complexity, no-await-in-loop, require-unicode-regexp, no-mixed-operators, no-continue, prefer-named-capture-group, no-useless-escape, max-depth, no-empty-function, sort-imports, no-bitwise, no-promise-executor-return, require-await, no-console, no-inner-declarations, no-invalid-this, radix, no-new, no-nested-ternary, no-unused-vars, no-eq-null, no-control-regex */
import * as julesService from '../integrations/jules/jules.service.js';
import loggerHelper from '../helpers/logger.helper.js';
import { getOrgId } from '../helpers/scope.helper.js';

const logger = loggerHelper.get('controllers/julesController.js');

/**
 * GET /api/jules/sources
 * Lists available Jules sources (repositories).
 */
export async function listSources(req, res, next) {
  try {
    const sources = await julesService.getSources(getOrgId(req));
    return res.json({ sources });
  } catch (err) {
    logger.error('listSources failed', err);
    err.statusCode = err.statusCode || 502;
    return next(err);
  }
}

/**
 * POST /api/jules/sessions
 * Creates a new Jules remediation session from a vulnerability finding.
 * Body: { finding_id, source_name, automation_mode, prompt_override? }
 */
export async function createSession(req, res, next) {
  try {
    const { finding_id, source_name, automation_mode, prompt_override } = req.body || {};
    if (!finding_id || !source_name) {
      return res.status(400).json({ error: 'finding_id and source_name are required' });
    }

    const session = await julesService.createSession({
      findingId: finding_id,
      sourceName: source_name,
      automationMode: automation_mode || 'REQUIRE_APPROVAL',
      promptOverride: prompt_override || null,
      user:    req.user,
      orgId:   getOrgId(req),
    });

    return res.status(201).json({ session });
  } catch (err) {
    logger.error('createSession failed', err);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
}

/**
 * GET /api/jules/sessions
 * Lists Jules sessions with pagination.
 */
export async function listSessions(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await julesService.listSessions({ page, limit, viewer: req.user });
    return res.json(result);
  } catch (err) {
    logger.error('listSessions failed', err);
    return next(err);
  }
}

/**
 * GET /api/jules/sessions/:id
 * Gets session detail with live activities from Jules API.
 */
export async function getSession(req, res, next) {
  try {
    const { id } = req.params;
    const result = await julesService.getSessionWithActivities(id, req.user, getOrgId(req));
    if (!result) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.json(result);
  } catch (err) {
    logger.error('getSession failed', err);
    return next(err);
  }
}

/**
 * POST /api/jules/sessions/:id/approve
 * Approves a session's plan for execution.
 */
export async function approveSessionPlan(req, res, next) {
  try {
    const { id } = req.params;
    const session = await julesService.approvePlan(id, req.user, getOrgId(req));
    return res.json({ session });
  } catch (err) {
    logger.error('approveSessionPlan failed', err);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
}

/**
 * POST /api/jules/sessions/:id/message
 * Sends a user message to a Jules session.
 * Body: { message: string }
 */
export async function sendSessionMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { message } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }
    const result = await julesService.sendMessage(id, message, req.user, getOrgId(req));
    return res.json(result);
  } catch (err) {
    logger.error('sendSessionMessage failed', err);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
}

/**
 * DELETE /api/jules/sessions/:id
 * Deletes a Jules session (local record only).
 */
export async function deleteSession(req, res, next) {
  try {
    const { id } = req.params;
    await julesService.deleteSession(id, req.user);
    return res.json({ message: 'Session deleted' });
  } catch (err) {
    logger.error('deleteSession failed', err);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
}
