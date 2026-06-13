import axios from 'axios';
import http from 'http';
import https from 'https';
import { assertPublicUrl as assertPublicUrlShared, safeLookup } from '../helpers/ssrfGuard.helper.js';

/**
 * SSRF guard for user-configured integration URLs. Admin-supplied URLs are
 * otherwise a SSRF primitive: an attacker with admin access (or a compromised
 * admin session) could point Jira/ServiceNow integrations at cloud metadata
 * endpoints (169.254.169.254), localhost, or RFC1918 space.
 *
 * Pre-flight validation lives in the shared helper; here we additionally pin
 * the validation to *connect* time via agents whose `lookup` re-checks the
 * resolved address, defeating DNS rebinding between validation and request.
 */
function assertPublicUrl(rawUrl) {
    return assertPublicUrlShared(rawUrl, 'Integration serverUrl');
}

// Agents that re-validate the resolved IP at socket-connect time.
const safeHttpAgent = new http.Agent({ lookup: safeLookup });
const safeHttpsAgent = new https.Agent({ lookup: safeLookup });

const REQUEST_DEFAULTS = {
    timeout: 10_000,
    maxRedirects: 0, // don't auto-follow — avoid redirect-to-metadata
    httpAgent: safeHttpAgent,
    httpsAgent: safeHttpsAgent,
};

function buildValidatedUrl(baseUrl, apiPath) {
  try {
    // Minimal path validation
    if (baseUrl.includes('/../') || (/\/%2e%2e\//i).test(baseUrl)) {
      throw new Error('Invalid path');
    }
    
    const url = new URL(baseUrl);
    
    // Protocol checks
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
    
    // Build pathname from fixed literals
    url.pathname = apiPath;
    
    return url.href;
  } catch {
    throw new Error('Invalid URL');
  }
}

export async function createThirdPartyIssue(platform, issueDetails, config) {
  const { title, description } = issueDetails;

  try {
    switch (platform) {
      case 'github':
        // GitHub is a fixed host; no user-controlled server URL to validate.
        await axios.post(
          `https://api.github.com/repos/${config.repo}/issues`,
          { title, body: description },
          { ...REQUEST_DEFAULTS, headers: { Authorization: `token ${config.token}` } }
        );
        break;

      case 'jira': {
        await assertPublicUrl(config.serverUrl);
        await axios.post(
          buildValidatedUrl(config.serverUrl, '/rest/api/2/issue'),
          {
            fields: {
              project: { key: config.projectKey },
              summary: title,
              description: description,
              issuetype: { name: 'Bug' }
            }
          },
          { ...REQUEST_DEFAULTS, headers: { Authorization: `Basic ${Buffer.from(config.email + ':' + config.token).toString('base64')}` } }
        );
        break;
      }

      case 'servicenow': {
        await assertPublicUrl(config.serverUrl);
        await axios.post(
          buildValidatedUrl(config.serverUrl, '/api/now/table/incident'),
          { short_description: title, description },
          { ...REQUEST_DEFAULTS, headers: { Authorization: `Basic ${Buffer.from(config.username + ':' + config.password).toString('base64')}` } }
        );
        break;
      }

      default:
        throw new Error(`Unsupported integration platform: ${platform}`);
    }
    return { success: true };
  } catch (error) {
    console.error(`Failed to create issue on ${platform}`, error);
    return { success: false, error: error.message };
  }
}
