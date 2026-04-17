import axios from 'axios';
import dns from 'dns/promises';
import net from 'net';

/**
 * Validate that a user-configured integration URL points at a public host
 * rather than an internal / metadata / loopback service. Admin-supplied URLs
 * are otherwise a SSRF primitive: an attacker with admin access (or a
 * compromised admin session) could point Jira/ServiceNow integrations at
 * cloud metadata endpoints (169.254.169.254), localhost, or RFC1918 space.
 */
function isPrivateIp(ip) {
    if (!ip) {return true;}
    if (net.isIP(ip) === 0) {return true;} // not an IP — suspicious
    if (ip.startsWith('127.') || ip === '::1') {return true;}
    if (ip.startsWith('10.')) {return true;}
    if (ip.startsWith('192.168.')) {return true;}
    if (ip.startsWith('169.254.')) {return true;}         // link-local (AWS/GCP/Azure metadata)
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) {return true;}
    if (/^f[cd][0-9a-f]{2}:/i.test(ip)) {return true;}    // IPv6 ULA
    if (/^fe80:/i.test(ip)) {return true;}                // IPv6 link-local
    if (ip === '0.0.0.0' || ip === '::') {return true;}
    return false;
}

async function assertPublicUrl(rawUrl) {
    let url;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error('Integration serverUrl is not a valid URL');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`Integration serverUrl uses unsupported protocol: ${url.protocol}`);
    }
    const hostname = url.hostname;
    if (!hostname) {throw new Error('Integration serverUrl has no hostname');}

    // Literal-IP hostnames are validated directly; DNS names are resolved to
    // catch rebinding / CNAMEs that point at internal space.
    const literalFamily = net.isIP(hostname);
    if (literalFamily !== 0) {
        if (isPrivateIp(hostname)) {
            throw new Error(`Integration serverUrl targets a non-public address: ${hostname}`);
        }
        return url;
    }

    let addrs;
    try {
        addrs = await dns.lookup(hostname, { all: true });
    } catch {
        throw new Error(`Integration serverUrl hostname could not be resolved: ${hostname}`);
    }
    for (const { address } of addrs) {
        if (isPrivateIp(address)) {
            throw new Error(`Integration serverUrl resolves to a non-public address: ${hostname} → ${address}`);
        }
    }
    return url;
}

const REQUEST_DEFAULTS = {
    timeout: 10_000,
    maxRedirects: 0, // don't auto-follow — avoid redirect-to-metadata
};

function buildValidatedUrl(baseUrl, apiPath) {
  try {
    // Minimal path validation
    if (baseUrl.includes('/../') || /\/%2e%2e\//i.test(baseUrl)) {
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
