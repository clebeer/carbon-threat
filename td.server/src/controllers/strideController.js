/**
 * STRIDE AI Analysis Controller
 */
import { runFullAnalysis } from '../services/strideEngineService.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/strideController');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_APP_TYPES = [
  'Traditional application',
  'Generative AI application',
  'Agentic AI application',
];

/**
 * POST /api/threatmodels/:id/ai-analyze
 */
export async function aiAnalyze(req, res) {
  const modelId = req.params.id;
  if (!UUID_RE.test(modelId)) {
    return res.status(400).json({ error: 'Invalid model id' });
  }

  const body = req.body || {};

  // Sanitize inputs
  const appType = VALID_APP_TYPES.includes(body.appType) ? body.appType : 'Traditional application';
  const authentication = typeof body.authentication === 'string'
    ? body.authentication.slice(0, 200) : 'None';
  const internetFacing = Boolean(body.internetFacing);
  const sensitiveData = Boolean(body.sensitiveData);
  const runDread = Boolean(body.runDread);
  const runMitigations = Boolean(body.runMitigations);
  const runTestCases = Boolean(body.runTestCases);
  const description = typeof body.description === 'string'
    ? body.description.slice(0, 5000) : '';

  try {
    const result = await runFullAnalysis(modelId, {
      appType,
      authentication,
      internetFacing,
      sensitiveData,
      runDread,
      runMitigations,
      runTestCases,
      description,
    }, req.user || {});

    return res.json(result);
  } catch (err) {
    logger.error('aiAnalyze failed', err);
    if (err.message === 'Threat model not found') {
      return res.status(404).json({ error: 'Threat model not found' });
    }
    return res.status(502).json({ error: 'AI analysis failed', detail: err.message });
  }
}

export default { aiAnalyze };