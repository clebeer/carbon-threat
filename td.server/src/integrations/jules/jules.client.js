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
