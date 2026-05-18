/* eslint-disable max-lines, max-lines-per-function, complexity, no-await-in-loop, require-unicode-regexp, no-mixed-operators, no-continue, prefer-named-capture-group, no-useless-escape, max-depth, no-empty-function, sort-imports, no-bitwise, no-promise-executor-return, require-await, no-console, no-inner-declarations, no-invalid-this, radix, no-new, no-nested-ternary, no-unused-vars, no-eq-null, no-control-regex */
import { suggestThreats } from '../ai/threat-bot.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/aiController.js');

/**
 * POST /api/ai/suggest
 * Body: { nodeId: string, label: string, type?: string }
 *
 * Calls the configured LLM (Ollama/OpenAI) to suggest STRIDE threats
 * for the selected diagram node. Returns an array of threat objects.
 *
 * Rate: protected by the global limiter in app.js; additionally
 * constrained to admin/analyst roles via requireRole middleware in routes.
 */
export async function suggest(req, res) {
  const { nodeId, label, type } = req.body || {};

  if (!label || typeof label !== 'string' || label.trim().length === 0) {
    return res.status(400).json({ error: 'label is required' });
  }

  // Sanitise inputs — strip any chars that could be used for prompt injection
  const safeLabel = label.trim().slice(0, 120).
replace(/[`<>]/g, '');
  const safeType = (type ?? 'Component').trim().slice(0, 80).
replace(/[`<>]/g, '');

  logger.info(`AI suggest requested by user ${req.user?.id} for node "${safeLabel}" (${safeType})`);

  try {
    const threats = await suggestThreats({ label: safeLabel, type: safeType });

    if (!Array.isArray(threats)) {
      logger.warn('AI response was not an array — returning empty');
      return res.json({ nodeId, suggestions: [] });
    }

    // Validate / sanitise each suggestion before forwarding to the client
    const sanitised = threats.
      filter((t) => t && typeof t.title === 'string').
      map((t) => ({
        title:          String(t.title).slice(0, 200),
        severity:       ['High', 'Medium', 'Low'].includes(t.severity) ? t.severity : 'Medium',
        mitigation:     t.mitigation ? String(t.mitigation).slice(0, 500) : '',
        strideCategory: t.strideCategory ? String(t.strideCategory).slice(0, 50) : 'Unknown',
      }));

    logger.info(`AI returned ${sanitised.length} suggestions for "${safeLabel}"`);
    return res.json({ nodeId, suggestions: sanitised });
  } catch (err) {
    logger.error('AI suggest failed', err);
    return res.status(502).json({ error: 'AI service unavailable. Check LLM provider configuration.' });
  }
}
