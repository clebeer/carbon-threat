/**
 * STRIDE Engine Service — orchestrates AI-powered threat analysis
 * via the internal stride-engine Python microservice.
 */
import db from '../db/knex.js';
import { decryptModel } from '../security/encryption.js';
import loggerHelper from '../helpers/logger.helper.js';
import axios from 'axios';

const logger = loggerHelper.get('services/strideEngineService');

const STRIDE_ENGINE_URL = process.env.STRIDE_ENGINE_URL || 'http://stride-engine:8000';
const STRIDE_ENGINE_TOKEN = process.env.STRIDE_ENGINE_TOKEN || '';

// ── STRIDE category normalization ───────────────────────────────────────────

const STRIDE_CATEGORY_MAP = {
  'spoofing': 'Spoofing',
  'tampering': 'Tampering',
  'repudiation': 'Repudiation',
  'information disclosure': 'Information Disclosure',
  'denial of service': 'DoS',
  'dos': 'DoS',
  'elevation of privilege': 'Elevation of Privilege',
  'privilege escalation': 'Elevation of Privilege',
  'elevation': 'Elevation of Privilege',
};

function normalizeStrideCategory(raw) {
  if (!raw) {return 'Tampering';}
  const lower = raw.toLowerCase().trim();
  for (const [key, value] of Object.entries(STRIDE_CATEGORY_MAP)) {
    if (lower.includes(key)) {return value;}
  }
  return 'Tampering';
}

// ── Severity from DREAD score ───────────────────────────────────────────────

function severityFromDread(riskScore) {
  if (riskScore >= 8) {return 'Critical';}
  if (riskScore >= 6) {return 'High';}
  if (riskScore >= 4) {return 'Medium';}
  return 'Low';
}

// ── Build app_input from diagram ────────────────────────────────────────────

function buildAppInput(modelRow) {
  const parts = [];

  if (modelRow.title) {
    parts.push(`Application Name: ${modelRow.title}`);
  }
  if (modelRow.description) {
    parts.push(`Description: ${modelRow.description}`);
  }

  // Decrypt diagram content
  let content = {};
  if (modelRow.content_encrypted) {
    try {
      content = decryptModel(JSON.parse(modelRow.content_encrypted));
    } catch (e) {
      logger.warn(`Failed to decrypt model ${modelRow.id}`, e);
    }
  }

  const nodes = content.nodes || [];
  const edges = content.edges || [];

  if (nodes.length > 0) {
    parts.push('\nDiagram Components:');
    for (const node of nodes) {
      const label = node.data?.label || node.data?.name || node.id || 'Unknown';
      const type = node.type || 'component';
      parts.push(`- [${type}] ${label}`);
    }
  }

  if (edges.length > 0) {
    parts.push('\nData Flows:');
    for (const edge of edges) {
      const label = edge.label || edge.data?.label || 'unnamed';
      const source = edge.source || '?';
      const target = edge.target || '?';
      parts.push(`- ${source} → ${target} (${label})`);
    }
  }

  return parts.join('\n');
}

// ── Call stride-engine ──────────────────────────────────────────────────────

async function callStrideEngine(endpoint, payload) {
  const url = `${STRIDE_ENGINE_URL}${endpoint}`;
  const resp = await axios.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': STRIDE_ENGINE_TOKEN,
    },
    timeout: 600_000, // 10 min — LLM calls can be slow
  });
  return resp.data;
}

// ── Read provider/model from app_config ─────────────────────────────────────

async function getProviderConfig() {
  const row = await db('app_config').where({ key: 'llm_provider' }).
first();
  if (!row) {
    return { provider: 'ollama', model: 'llama3.1:8b' };
  }
  try {
    const config = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    return {
      provider: config.provider || 'ollama',
      model: config.model || 'llama3.1:8b',
    };
  } catch {
    return { provider: 'ollama', model: 'llama3.1:8b' };
  }
}

// ── Main analysis function ──────────────────────────────────────────────────

/**
 * Run full STRIDE GPT analysis for a threat model.
 *
 * @param {string} modelId - UUID of the threat_models row
 * @param {object} opts - { appType, authentication, internetFacing, sensitiveData, runDread, runMitigations, runTestCases, description }
 * @param {object} user - req.user object
 * @returns {Promise<{threats, improvement_suggestions, analysisId}>}
 */
export async function runFullAnalysis(modelId, opts = {}, user = {}) {
  // 1. Load model
  const model = await db('threat_models').
    where({ id: modelId, is_archived: false }).
    first();

  if (!model) {
    throw new Error('Threat model not found');
  }

  // 2. Build app_input
  const appInput = buildAppInput(model) + (opts.description ? `\n\nAdditional Context: ${opts.description}` : '');

  // 3. Get provider config
  const providerConfig = await getProviderConfig();
  const provider = opts.provider || providerConfig.provider;
  const modelName = opts.model || providerConfig.model;

  // 4. Call threat-model endpoint
  logger.info(`Calling stride-engine /threat-model with provider=${provider}, model=${modelName}`);
  const tmResult = await callStrideEngine('/threat-model', {
    provider,
    model: modelName,
    app_type: opts.appType || 'Traditional application',
    authentication: opts.authentication || 'None',
    internet_facing: opts.internetFacing ? 'Yes' : 'No',
    sensitive_data: opts.sensitiveData ? 'Yes' : 'No',
    app_input: appInput,
  });

  const threatModelArray = tmResult.threat_model || [];
  const improvementSuggestions = tmResult.improvement_suggestions || [];

  // 5. Optionally run DREAD
  let dreadResult = null;
  if (opts.runDread && threatModelArray.length > 0) {
    logger.info('Calling stride-engine /dread');
    try {
      dreadResult = await callStrideEngine('/dread', {
        provider,
        model: modelName,
        threat_model: threatModelArray,
      });
    } catch (err) {
      logger.warn('DREAD analysis failed', err);
    }
  }

  // 6. Optionally run Mitigations
  let mitigationsResult = null;
  if (opts.runMitigations && threatModelArray.length > 0) {
    logger.info('Calling stride-engine /mitigations');
    try {
      mitigationsResult = await callStrideEngine('/mitigations', {
        provider,
        model: modelName,
        threat_model: threatModelArray,
      });
    } catch (err) {
      logger.warn('Mitigations analysis failed', err);
    }
  }

  // 7. Optionally run Test Cases
  let testCasesResult = null;
  if (opts.runTestCases && threatModelArray.length > 0) {
    logger.info('Calling stride-engine /test-cases');
    try {
      testCasesResult = await callStrideEngine('/test-cases', {
        provider,
        model: modelName,
        threat_model: threatModelArray,
      });
    } catch (err) {
      logger.warn('Test cases generation failed', err);
    }
  }

  // 8. Normalize and persist threats
  const dreadAssessments = dreadResult?.['Risk Assessment'] || [];
  const mitigationsList = mitigationsResult?.mitigations || [];
  const testCasesList = testCasesResult?.test_cases || [];

  const threats = [];
  for (let i = 0; i < threatModelArray.length; i++) {
    const t = threatModelArray[i];
    const dreadInfo = dreadAssessments[i] || null;
    const mitInfo = mitigationsList[i] || null;
    const tcInfo = testCasesList[i] || null;

    // Compute severity from DREAD if available
    let severity = 'Medium';
    let dreadData = null;
    if (dreadInfo && dreadInfo['Risk Score'] != null) {
      severity = severityFromDread(dreadInfo['Risk Score']);
      dreadData = {
        damage: dreadInfo['Damage Potential'],
        reproducibility: dreadInfo.Reproducibility,
        exploitability: dreadInfo.Exploitability,
        affected_users: dreadInfo['Affected Users'],
        discoverability: dreadInfo.Discoverability,
        average: dreadInfo['Risk Score'],
      };
    }

    // Collect OWASP refs
    const owaspRefs = [];
    if (t.OWASP_LLM) {
      owaspRefs.push({ type: 'OWASP_LLM', ref: t.OWASP_LLM, title: t.OWASP_LLM, url: `https://owasp.org/www-project-top-10-for-large-language-model-applications/` });
    }
    if (t.OWASP_ASI) {
      owaspRefs.push({ type: 'OWASP_ASI', ref: t.OWASP_ASI, title: t.OWASP_ASI, url: `https://owasp.org/www-project-ai-security-and-privacy-guide/` });
    }

    const mitigationText = mitInfo?.Mitigations ? mitInfo.Mitigations.join('\n') : null;
    const testCasesText = tcInfo?.['Test Cases']
      ? tcInfo['Test Cases'].map((tc) => `${tc.name}: ${tc.description}`).join('\n')
      : null;

    const [threat] = await db('threats').insert({
      model_id: modelId,
      org_id: model.org_id || null,
      title: `${t['Threat Type']}: ${(t.Scenario || 'AI-generated threat').slice(0, 80)}`,
      description: `${t.Scenario || ''}\n\nImpact: ${t['Potential Impact'] || ''}`,
      stride_category: normalizeStrideCategory(t['Threat Type']),
      severity,
      status: 'Open',
      source: 'ai',
      mitigation: mitigationText,
      owasp_refs: JSON.stringify(owaspRefs),
      dread: dreadData ? JSON.stringify(dreadData) : null,
      test_cases: testCasesText,
    }).
returning('*');

    threats.push(threat);
  }

  // 9. Save analysis record
  const [analysis] = await db('ai_analyses').insert({
    model_id: modelId,
    org_id: model.org_id || null,
    app_type: opts.appType || 'Traditional application',
    inputs: JSON.stringify({
      authentication: opts.authentication,
      internetFacing: opts.internetFacing,
      sensitiveData: opts.sensitiveData,
      description: opts.description,
    }),
    provider,
    model: modelName,
    improvement_suggestions: JSON.stringify(improvementSuggestions),
    raw_output: JSON.stringify(tmResult),
    created_by: user.id || null,
  }).
returning('*');

  logger.info(`runFullAnalysis: ${threats.length} threats for model ${modelId}, analysis ${analysis.id}`);

  return {
    threats,
    improvement_suggestions: improvementSuggestions,
    analysisId: analysis.id,
  };
}

export default { runFullAnalysis };