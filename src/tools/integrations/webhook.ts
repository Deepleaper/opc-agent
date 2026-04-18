import type { MCPTool, MCPToolResult } from '../mcp';

export const WebhookTool: MCPTool = {
  name: 'webhook',
  description: 'Send HTTP requests to arbitrary webhook URLs. Supports POST and GET.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Webhook URL' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], description: 'HTTP method (default: POST)' },
      headers: { type: 'object', description: 'Custom headers as key-value pairs' },
      body: { type: 'string', description: 'Request body (JSON string)' },
    },
    required: ['url'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const url = String(input.url ?? '');
    if (!url) return { content: 'Error: url is required', isError: true };

    const method = String(input.method ?? 'POST').toUpperCase();
    const customHeaders = (input.headers ?? {}) as Record<string, string>;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...customHeaders };

    try {
      const opts: RequestInit = { method, headers };
      if (method !== 'GET' && method !== 'HEAD' && input.body) {
        opts.body = String(input.body);
      }
      const res = await fetch(url, opts);
      const text = await res.text();
      const truncated = text.length > 4000 ? text.slice(0, 4000) + '...(truncated)' : text;
      return { content: `Status: ${res.status}\n${truncated}`, metadata: { status: res.status } };
    } catch (err) {
      return { content: `Webhook error: ${(err as Error).message}`, isError: true };
    }
  },
};
