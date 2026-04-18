import type { MCPTool, MCPToolResult } from '../mcp';

export const NpmTool: MCPTool = {
  name: 'npm',
  description: 'Search npm registry, get package info, or list installed packages.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['search', 'info', 'install'], description: 'Action' },
      package: { type: 'string', description: 'Package name' },
      query: { type: 'string', description: 'Search query (for search)' },
    },
    required: ['action'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const action = String(input.action ?? '');

    try {
      if (action === 'search') {
        const q = String(input.query ?? input.package ?? '');
        if (!q) return { content: 'Error: query required', isError: true };
        const res = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}&size=10`);
        const data = await res.json() as { objects?: Array<{ package: { name: string; version: string; description: string } }> };
        const results = (data.objects ?? []).map((o) => `${o.package.name}@${o.package.version} — ${o.package.description}`).join('\n');
        return { content: results || 'No results' };
      }

      if (action === 'info') {
        const pkg = String(input.package ?? '');
        if (!pkg) return { content: 'Error: package required', isError: true };
        const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`);
        if (!res.ok) return { content: `Package not found: ${pkg}`, isError: true };
        const data = await res.json() as Record<string, unknown>;
        const latest = (data['dist-tags'] as Record<string, string>)?.latest;
        return { content: `${data.name}@${latest}\n${data.description}\nLicense: ${data.license}\nHomepage: ${data.homepage}` };
      }

      if (action === 'install') {
        return { content: 'Error: npm install is not supported via this tool for security. Use shell access instead.', isError: true };
      }

      return { content: `Unknown action: ${action}`, isError: true };
    } catch (err) {
      return { content: `NPM error: ${(err as Error).message}`, isError: true };
    }
  },
};
