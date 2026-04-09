import axios from 'axios';
import { query } from '../config/pg.config.js';

// F8 — allowlist of hostnames permitted for local LLM endpoints.
// Override with LLM_ALLOWED_HOSTS=host1,host2 in the environment.
const LLM_ALLOWED_HOSTS = (process.env.LLM_ALLOWED_HOSTS || 'localhost,127.0.0.1,::1')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

function validateLlmUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid LLM URL: ${rawUrl}`);
  }
  if (!LLM_ALLOWED_HOSTS.includes(parsed.hostname.toLowerCase())) {
    throw new Error(`LLM URL hostname "${parsed.hostname}" is not in the allowed list. Set LLM_ALLOWED_HOSTS to permit it.`);
  }
  return rawUrl;
}

// F4 — system prompt carries all instructions; user content holds only data.
const SYSTEM_PROMPT =
  'You are a cybersecurity expert analyzing software architecture components for STRIDE threats. ' +
  'Output ONLY a valid JSON array of objects. Each object must have exactly these keys: ' +
  '"title" (string), "severity" ("High"|"Medium"|"Low"), "mitigation" (string), "strideCategory" (string). ' +
  'No markdown fences, no explanations, no extra keys.';

export async function suggestThreats(nodeData) {
  try {
    // Fetch configured provider
    const result = await query("SELECT value FROM app_config WHERE key = 'llm_provider'");
    const providerConfig = result.rows[0]?.value || { provider: 'openai' };

    // F4 — user-controlled values are JSON-stringified so they cannot escape
    // the data context and inject instructions into the prompt.
    const userContent =
      `Component Name: ${JSON.stringify(nodeData.label)}\n` +
      `Component Type: ${JSON.stringify(nodeData.type || 'Custom')}`;

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userContent },
    ];

    if (providerConfig.provider === 'local') {
      // LM Studio or Ollama (OpenAI-compatible endpoint)
      // F8 — validate hostname before making the request
      const url = validateLlmUrl(providerConfig.url || 'http://localhost:1234/v1/chat/completions');
      const response = await axios.post(url, {
        model:       providerConfig.model || 'local-model',
        messages,
        temperature: 0.2,
      });
      // Strip markdown fences in case the local model ignores format instructions
      const rawContent = response.data.choices[0].message.content;
      const jsonStr = rawContent.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);

    } else {
      // OpenAI
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model:           'gpt-4-turbo-preview',
        response_format: { type: 'json_object' },
        messages,
      }, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      });
      return JSON.parse(response.data.choices[0].message.content);
    }
  } catch (error) {
    console.error('Threat Bot AI Failed:', error);
    return [];
  }
}
