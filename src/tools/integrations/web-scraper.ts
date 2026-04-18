import type { MCPTool, MCPToolResult } from '../mcp';

export const WebScraperTool: MCPTool = {
  name: 'web-scraper',
  description: 'Fetch and extract readable content from a URL.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to scrape' },
      max_length: { type: 'number', description: 'Max characters to return (default: 5000)' },
    },
    required: ['url'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const url = String(input.url ?? '');
    if (!url) return { content: 'Error: url required', isError: true };
    const maxLen = Number(input.max_length ?? 5000);

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OPCAgent/1.0)' },
      });
      if (!res.ok) return { content: `HTTP ${res.status}: ${res.statusText}`, isError: true };

      const html = await res.text();
      // Simple HTML to text extraction
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

      const truncated = text.length > maxLen ? text.slice(0, maxLen) + '...(truncated)' : text;
      return { content: truncated, metadata: { url, length: text.length } };
    } catch (err) {
      return { content: `Scraper error: ${(err as Error).message}`, isError: true };
    }
  },
};
