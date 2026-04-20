import axios from 'axios';

const BASE_URL = 'https://jules.googleapis.com';
const RETRY_DELAYS = [1000, 2000, 4000];

/**
 * Resolves the API key to use for Jules requests.
 * Priority: explicit override > env var JULES_API_KEY.
 */
function resolveApiKey(overrideKey) {
  const key = overrideKey || process.env.JULES_API_KEY;
  if (!key) throw new Error('Jules API key is not configured. Configure it in Settings > Integrations or set JULES_API_KEY env var.');
  return key;
}

function makeClient() {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function request(method, path, data, apiKeyOverride) {
  const client = makeClient();
  const headers = { 'X-Goog-Api-Key': resolveApiKey(apiKeyOverride) };

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

export async function getSources(apiKey) {
  return request('get', '/v1alpha/sources', null, apiKey);
}

export async function createSession({ sourceName, prompt, automationMode }, apiKey) {
  return request('post', '/v1alpha/sessions', {
    source: { name: sourceName },
    prompt,
    automationMode,
  }, apiKey);
}

export async function getSessionActivities(julesSessionId, apiKey) {
  return request('get', `/v1alpha/${julesSessionId}/activities`, null, apiKey);
}

export async function approvePlan(julesSessionId, apiKey) {
  return request('post', `/v1alpha/${julesSessionId}:approvePlan`, {}, apiKey);
}

export async function sendMessage(julesSessionId, message, apiKey) {
  return request('post', `/v1alpha/${julesSessionId}:sendMessage`, { message }, apiKey);
}
