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

  if (!finding_id)  return res.status(400).json({ error: 'finding_id is required' });
  if (!source_name) return res.status(400).json({ error: 'source_name is required' });

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
