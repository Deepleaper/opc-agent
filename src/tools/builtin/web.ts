import type { MCPTool, MCPToolResult } from '../mcp';

export const webTool: MCPTool = {
  name: 'web_fetch',
  description: 'Fetch content from a URL',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' },
      maxLength: { type: 'number', default: 5000 },
    },
    required: ['url'],
  },
  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const url = input.url as string;
    const method = (input.method as string) || 'GET';
    const maxLength = (input.maxLength as number) || 5000;

    try {
      const response = await fetch(url, { method, signal: AbortSignal.timeout(15000) });
      const text = await response.text();
      const truncated = text.length > maxLength ? text.slice(0, maxLength) + '\n...[truncated]' : text;
      return {
        content: `Status: ${response.status}\n\n${truncated}`,
        isError: false,
      };
    } catch (err) {
      return {
        content: `Fetch error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },
};
