import axios from 'axios';
import { query } from '../config/pg.config.js';

export async function suggestThreats(nodeData) {
  try {
    // Fetch configured provider
    const result = await query("SELECT value FROM app_config WHERE key = 'llm_provider'");
    const providerConfig = result.rows[0]?.value || { provider: 'openai' };

    const prompt = `
      Analyze the following architecture component and suggest potential STRIDE threats:
      Component Name: ${nodeData.label}
      Component Type: ${nodeData.type || 'Custom'}
  
      Ensure output is valid JSON formatting an array of objects: 
      { "title": string, "severity": "High"|"Medium"|"Low", "mitigation": string, "strideCategory": string }
    `;

    if (providerConfig.provider === 'local') {
      // LM Studio or Ollama (OpenAI compatible endpoint schema)
      const url = providerConfig.url || 'http://localhost:1234/v1/chat/completions';
      const response = await axios.post(url, {
        model: providerConfig.model || 'local-model',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      });
      // Extract from markdown if local model ignores format
      const rawContent = response.data.choices[0].message.content;
      const jsonStr = rawContent.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);

    } else {
      // OpenAI Setup
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4-turbo-preview',
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: 'You are a cybersecurity expert.'}, 
          { role: 'user', content: prompt }
        ]
      }, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
      });
      return JSON.parse(response.data.choices[0].message.content);
    }
  } catch (error) {
    console.error('Threat Bot AI Failed:', error);
    return [];
  }
}
