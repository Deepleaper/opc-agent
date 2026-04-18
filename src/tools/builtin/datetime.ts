import type { MCPTool, MCPToolResult } from '../mcp';

export const datetimeTool: MCPTool = {
  name: 'datetime',
  description: 'Get current date, time, timezone info',
  inputSchema: {
    type: 'object',
    properties: {
      format: { type: 'string', default: 'iso' },
      timezone: { type: 'string' },
    },
  },
  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const now = new Date();
    const timezone = input.timezone as string | undefined;
    const format = (input.format as string) || 'iso';

    let content: string;
    if (format === 'iso') {
      content = now.toISOString();
    } else if (format === 'locale') {
      content = timezone
        ? now.toLocaleString('en-US', { timeZone: timezone })
        : now.toLocaleString();
    } else if (format === 'unix') {
      content = String(Math.floor(now.getTime() / 1000));
    } else {
      content = now.toISOString();
    }

    return {
      content: JSON.stringify({
        iso: now.toISOString(),
        unix: Math.floor(now.getTime() / 1000),
        formatted: content,
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      isError: false,
    };
  },
};
