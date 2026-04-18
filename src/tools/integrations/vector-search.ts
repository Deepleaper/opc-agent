import type { MCPTool, MCPToolResult } from '../mcp';

export const VectorSearchTool: MCPTool = {
  name: 'vector-search',
  description: 'Search vector embeddings via DeepBrain or compatible API. Requires DEEPBRAIN_URL and DEEPBRAIN_API_KEY env vars.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query text' },
      collection: { type: 'string', description: 'Collection/namespace to search' },
      top_k: { type: 'number', description: 'Number of results (default: 5)' },
    },
    required: ['query'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const baseUrl = process.env.DEEPBRAIN_URL;
    const apiKey = process.env.DEEPBRAIN_API_KEY;
    if (!baseUrl) return { content: 'Error: DEEPBRAIN_URL required', isError: true };

    const query = String(input.query ?? '');
    if (!query) return { content: 'Error: query required', isError: true };

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch(`${baseUrl}/api/search`, {
        method: 'POST', headers,
        body: JSON.stringify({
          query,
          collection: input.collection ?? 'default',
          top_k: Number(input.top_k ?? 5),
        }),
      });
      const data = await res.json() as Record<string, unknown>;
      return { content: JSON.stringify(data, null, 2).slice(0, 4000) };
    } catch (err) {
      return { content: `Vector search error: ${(err as Error).message}`, isError: true };
    }
  },
};
