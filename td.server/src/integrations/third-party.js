import axios from 'axios';

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
          `${config.serverUrl}/rest/api/2/issue`,
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
          `${config.serverUrl}/api/now/table/incident`,
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
