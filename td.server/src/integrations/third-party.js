import axios from 'axios';

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
        await axios.post(
          `https://api.github.com/repos/${config.repo}/issues`,
          { title, body: description },
          { headers: { Authorization: `token ${config.token}` } }
        );
        break;
        
      case 'jira':
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
          { headers: { Authorization: `Basic ${Buffer.from(config.email + ':' + config.token).toString('base64')}` } }
        );
        break;

      case 'servicenow':
        await axios.post(
          buildValidatedUrl(config.serverUrl, '/api/now/table/incident'),
          { short_description: title, description },
          { headers: { Authorization: `Basic ${Buffer.from(config.username + ':' + config.password).toString('base64')}` } }
        );
        break;
        
      default:
        throw new Error(`Unsupported integration platform: ${platform}`);
    }
    return { success: true };
  } catch (error) {
    console.error(`Failed to create issue on ${platform}`, error);
    return { success: false, error: error.message };
  }
}
