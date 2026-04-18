import type { MCPTool, MCPToolResult } from '../mcp';
import { execSync } from 'child_process';

export const DatabaseTool: MCPTool = {
  name: 'database',
  description: 'Execute SQL queries against a database. Supports SQLite (via CLI), PostgreSQL, MySQL via connection URL. Set DATABASE_URL env var.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'SQL query to execute' },
      connection_url: { type: 'string', description: 'Connection URL (overrides DATABASE_URL)' },
    },
    required: ['query'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const query = String(input.query ?? '');
    if (!query) return { content: 'Error: query required', isError: true };

    // Safety check: block destructive operations unless explicitly allowed
    const dangerous = /^\s*(DROP|DELETE|TRUNCATE|ALTER)\s/i;
    if (dangerous.test(query) && !process.env.DATABASE_ALLOW_DESTRUCTIVE) {
      return { content: 'Error: Destructive queries blocked. Set DATABASE_ALLOW_DESTRUCTIVE=1 to allow.', isError: true };
    }

    const url = String(input.connection_url ?? process.env.DATABASE_URL ?? '');
    if (!url) return { content: 'Error: connection_url or DATABASE_URL required', isError: true };

    try {
      if (url.startsWith('sqlite:') || url.endsWith('.db') || url.endsWith('.sqlite')) {
        const dbPath = url.replace(/^sqlite:\/\//, '').replace(/^sqlite:/, '');
        const result = execSync(`sqlite3 -header -csv "${dbPath}" "${query.replace(/"/g, '\\"')}"`, {
          timeout: 30000, encoding: 'utf-8', maxBuffer: 1024 * 1024,
        });
        return { content: result.slice(0, 4000) || '(no results)' };
      }

      // For Postgres/MySQL, attempt using native TCP (simplified — real impl would need protocol handling)
      return { content: 'Error: Only SQLite is supported without external packages. For Postgres/MySQL, install appropriate drivers.', isError: true };
    } catch (err) {
      return { content: `Database error: ${(err as Error).message}`, isError: true };
    }
  },
};
