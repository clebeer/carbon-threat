import axios from 'axios';
import { query } from '../config/pg.config.js';

export async function suggestThreats(nodeData) {
  try {
    // Fetch configured provider
    const result = await query("SELECT value FROM app_config WHERE key = 'llm_provider'");
    const providerConfig = result.rows[0]?.value || { provider: 'openai' };

    // Sanitize user-supplied values — strip newlines and control characters to prevent
    // prompt injection attacks where a crafted label could override system instructions.
    const safeLabel = (nodeData.label || '').replace(/[\r\n\t\x00-\x1F]/g, ' ').slice(0, 200);
    const safeType  = (nodeData.type  || '').replace(/[\r\n\t\x00-\x1F]/g, ' ').slice(0, 100);

    const systemPrompt =
      'You are a cybersecurity expert. Given an architecture component (provided as JSON in the user message), ' +
      'suggest potential STRIDE threats. Respond with a JSON array of objects: ' +
      '{ "title": string, "severity": "High"|"Medium"|"Low", "mitigation": string, "strideCategory": string }';

    // Node data is passed as structured JSON in the user turn — not string-interpolated into the system prompt.
    const userMessage = JSON.stringify({ componentName: safeLabel, componentType: safeType });

    if (providerConfig.provider === 'local') {
      // LM Studio or Ollama (OpenAI compatible endpoint schema)
      const url = providerConfig.url || 'http://localhost:1234/v1/chat/completions';
      const response = await axios.post(url, {
        model: providerConfig.model || 'local-model',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage },
        ],
        temperature: 0.2
      });
      // Extract from markdown if local model ignores format
      const rawContent = response.data.choices[0].message.content;
      const jsonStr = rawContent.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);

    } else {
      // OpenAI
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4-turbo-preview',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage },
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
