import type { MCPTool, MCPToolResult } from '../mcp';

export const SummarizerTool: MCPTool = {
  name: 'summarizer',
  description: 'Summarize long text using an LLM API. Requires OPENAI_API_KEY or LLM_API_URL env var.',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to summarize' },
      max_length: { type: 'number', description: 'Approximate max summary length in words (default: 200)' },
      style: { type: 'string', enum: ['brief', 'detailed', 'bullets'], description: 'Summary style (default: brief)' },
    },
    required: ['text'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const text = String(input.text ?? '');
    if (!text) return { content: 'Error: text required', isError: true };

    const style = String(input.style ?? 'brief');
    const maxLen = Number(input.max_length ?? 200);
    const prompt = `Summarize the following text in a ${style} style, approximately ${maxLen} words:\n\n${text.slice(0, 15000)}`;

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
          max_tokens: maxLen * 3,
        }),
      });
      const data = await res.json() as { choices?: Array<{ message: { content: string } }> };
      const summary = data.choices?.[0]?.message?.content ?? 'No summary generated';
      return { content: summary };
    } catch (err) {
      return { content: `Summarizer error: ${(err as Error).message}`, isError: true };
    }
  },
};
