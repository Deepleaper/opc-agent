import type { MCPServerConfig } from '../../protocols/mcp/types';

export function createWebServer(): MCPServerConfig {
  return {
    name: 'web',
    version: '1.0.0',
    tools: [
      {
        name: 'web_fetch',
        description: 'Fetch a URL and return its content',
        inputSchema: { type: 'object', properties: { url: { type: 'string' }, method: { type: 'string', default: 'GET' }, headers: { type: 'object' }, body: { type: 'string' } }, required: ['url'] },
        handler: async (args: { url: string; method?: string; headers?: Record<string, string>; body?: string }) => {
          const res = await fetch(args.url, { method: args.method || 'GET', headers: args.headers, body: args.body });
          const contentType = res.headers.get('content-type') || '';
          const text = await res.text();
          return { status: res.status, contentType, body: text.slice(0, 50000), truncated: text.length > 50000 };
        },
      },
      {
        name: 'web_extract_text',
        description: 'Fetch a URL and extract readable text (strips HTML tags)',
        inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
        handler: async (args: { url: string }) => {
          const res = await fetch(args.url);
          const html = await res.text();
          const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          return { text: text.slice(0, 30000), truncated: text.length > 30000 };
        },
      },
      {
        name: 'web_search',
        description: 'Search the web (simulated — returns search URL for manual use)',
        inputSchema: { type: 'object', properties: { query: { type: 'string' }, engine: { type: 'string', enum: ['google', 'bing', 'duckduckgo'], default: 'duckduckgo' } }, required: ['query'] },
        handler: async (args: { query: string; engine?: string }) => {
          const engines: Record<string, string> = {
            google: `https://www.google.com/search?q=${encodeURIComponent(args.query)}`,
            bing: `https://www.bing.com/search?q=${encodeURIComponent(args.query)}`,
            duckduckgo: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`,
          };
          const url = engines[args.engine || 'duckduckgo'];
          const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 opc-mcp/1.0' } });
          const html = await res.text();
          const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          return { query: args.query, engine: args.engine || 'duckduckgo', results: text.slice(0, 20000) };
        },
      },
    ],
  };
}
