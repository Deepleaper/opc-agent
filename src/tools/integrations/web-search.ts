import type { MCPTool, MCPToolResult } from '../mcp';

export const WebSearchTool: MCPTool = {
  name: 'web-search',
  description: 'Search the web using SerpAPI, Tavily, or Brave Search. Requires SERPAPI_KEY, TAVILY_API_KEY, or BRAVE_SEARCH_KEY env var.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      provider: { type: 'string', enum: ['serpapi', 'tavily', 'brave'], description: 'Search provider (auto-detects from env)' },
      count: { type: 'number', description: 'Number of results (default: 5)' },
    },
    required: ['query'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const query = String(input.query ?? '');
    if (!query) return { content: 'Error: query required', isError: true };
    const count = Number(input.count ?? 5);

    try {
      const provider = String(input.provider ?? '');
      if (provider === 'tavily' || process.env.TAVILY_API_KEY) {
        const key = process.env.TAVILY_API_KEY;
        if (!key) return { content: 'Error: TAVILY_API_KEY required', isError: true };
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: key, query, max_results: count }),
        });
        const data = await res.json() as Record<string, unknown>;
        return { content: JSON.stringify(data, null, 2).slice(0, 4000) };
      }

      if (provider === 'brave' || process.env.BRAVE_SEARCH_KEY) {
        const key = process.env.BRAVE_SEARCH_KEY;
        if (!key) return { content: 'Error: BRAVE_SEARCH_KEY required', isError: true };
        const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`, {
          headers: { 'X-Subscription-Token': key, 'Accept': 'application/json' },
        });
        const data = await res.json() as Record<string, unknown>;
        return { content: JSON.stringify(data, null, 2).slice(0, 4000) };
      }

      if (provider === 'serpapi' || process.env.SERPAPI_KEY) {
        const key = process.env.SERPAPI_KEY;
        if (!key) return { content: 'Error: SERPAPI_KEY required', isError: true };
        const res = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=${count}&api_key=${key}`);
        const data = await res.json() as Record<string, unknown>;
        return { content: JSON.stringify(data, null, 2).slice(0, 4000) };
      }

      return { content: 'Error: No search API key configured (TAVILY_API_KEY, BRAVE_SEARCH_KEY, or SERPAPI_KEY)', isError: true };
    } catch (err) {
      return { content: `Search error: ${(err as Error).message}`, isError: true };
    }
  },
};
