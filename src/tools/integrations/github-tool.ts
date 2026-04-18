import type { MCPTool, MCPToolResult } from '../mcp';

export const GitHubTool: MCPTool = {
  name: 'github',
  description: 'Interact with GitHub API: create issues, list issues, create PRs, search code. Requires GITHUB_TOKEN env var.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create_issue', 'list_issues', 'create_pr', 'search_code'], description: 'Action to perform' },
      owner: { type: 'string', description: 'Repository owner' },
      repo: { type: 'string', description: 'Repository name' },
      title: { type: 'string', description: 'Issue/PR title' },
      body: { type: 'string', description: 'Issue/PR body' },
      head: { type: 'string', description: 'PR head branch' },
      base: { type: 'string', description: 'PR base branch (default: main)' },
      query: { type: 'string', description: 'Search query' },
    },
    required: ['action'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return { content: 'Error: GITHUB_TOKEN required', isError: true };

    const action = String(input.action ?? '');
    const owner = String(input.owner ?? '');
    const repo = String(input.repo ?? '');
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    try {
      if (action === 'create_issue') {
        if (!owner || !repo || !input.title) return { content: 'Error: owner, repo, title required', isError: true };
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
          method: 'POST', headers,
          body: JSON.stringify({ title: input.title, body: input.body ?? '' }),
        });
        const data = await res.json() as Record<string, unknown>;
        return { content: `Issue created: #${data.number} ${data.html_url}` };
      }

      if (action === 'list_issues') {
        if (!owner || !repo) return { content: 'Error: owner, repo required', isError: true };
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?per_page=20`, { headers });
        const data = await res.json() as Array<Record<string, unknown>>;
        const summary = Array.isArray(data) ? data.map((i) => `#${i.number} ${i.title}`).join('\n') : JSON.stringify(data);
        return { content: summary };
      }

      if (action === 'create_pr') {
        if (!owner || !repo || !input.title || !input.head) return { content: 'Error: owner, repo, title, head required', isError: true };
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
          method: 'POST', headers,
          body: JSON.stringify({ title: input.title, body: input.body ?? '', head: input.head, base: input.base ?? 'main' }),
        });
        const data = await res.json() as Record<string, unknown>;
        return { content: `PR created: #${data.number} ${data.html_url}` };
      }

      if (action === 'search_code') {
        if (!input.query) return { content: 'Error: query required', isError: true };
        const res = await fetch(`https://api.github.com/search/code?q=${encodeURIComponent(String(input.query))}`, { headers });
        const data = await res.json() as Record<string, unknown>;
        return { content: JSON.stringify(data, null, 2).slice(0, 4000) };
      }

      return { content: `Unknown action: ${action}`, isError: true };
    } catch (err) {
      return { content: `GitHub error: ${(err as Error).message}`, isError: true };
    }
  },
};
