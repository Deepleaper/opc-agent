import type { MCPTool, MCPToolResult } from '../mcp';

export const TranslatorTool: MCPTool = {
  name: 'translator',
  description: 'Translate text between languages using an LLM. Requires OPENAI_API_KEY or LLM_API_URL env var.',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to translate' },
      from: { type: 'string', description: 'Source language (auto-detect if omitted)' },
      to: { type: 'string', description: 'Target language (required)' },
    },
    required: ['text', 'to'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const text = String(input.text ?? '');
    const to = String(input.to ?? '');
    if (!text || !to) return { content: 'Error: text and to are required', isError: true };

    const from = input.from ? ` from ${input.from}` : '';
    const prompt = `Translate the following text${from} to ${to}. Return only the translation, no explanations:\n\n${text.slice(0, 10000)}`;

    try {
      const apiKey = process.env.OPENAI_API_KEY;
      const apiUrl = process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions';
      if (!apiKey && apiUrl === 'https://api.openai.com/v1/chat/completions') {
        return { content: 'Error: OPENAI_API_KEY or LLM_API_URL required', isError: true };
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch(apiUrl, {
        method: 'POST', headers,
        body: JSON.stringify({
          model: process.env.LLM_MODEL || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json() as { choices?: Array<{ message: { content: string } }> };
      const translation = data.choices?.[0]?.message?.content ?? 'No translation generated';
      return { content: translation };
    } catch (err) {
      return { content: `Translation error: ${(err as Error).message}`, isError: true };
    }
  },
};
