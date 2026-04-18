import type { MCPServerConfig } from '../../protocols/mcp/types';

export function createGitHubServer(token?: string): MCPServerConfig {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'opc-mcp-github/1.0',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const ghFetch = async (path: string, opts: any = {}) => {
    const res = await fetch(`https://api.github.com${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    return res.json();
  };

  return {
    name: 'github',
    version: '1.0.0',
    tools: [
      {
        name: 'github_get_repo',
        description: 'Get repository information',
        inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' } }, required: ['owner', 'repo'] },
        handler: async (args: { owner: string; repo: string }) => ghFetch(`/repos/${args.owner}/${args.repo}`),
      },
      {
        name: 'github_list_issues',
        description: 'List repository issues',
        inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, state: { type: 'string', enum: ['open', 'closed', 'all'], default: 'open' } }, required: ['owner', 'repo'] },
        handler: async (args: { owner: string; repo: string; state?: string }) => ghFetch(`/repos/${args.owner}/${args.repo}/issues?state=${args.state || 'open'}`),
      },
      {
        name: 'github_create_issue',
        description: 'Create a new issue',
        inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' } }, required: ['owner', 'repo', 'title'] },
        handler: async (args: { owner: string; repo: string; title: string; body?: string }) =>
          ghFetch(`/repos/${args.owner}/${args.repo}/issues`, { method: 'POST', body: JSON.stringify({ title: args.title, body: args.body }), headers: { 'Content-Type': 'application/json' } }),
      },
      {
        name: 'github_search_repos',
        description: 'Search GitHub repositories',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        handler: async (args: { query: string }) => ghFetch(`/search/repositories?q=${encodeURIComponent(args.query)}`),
      },
      {
        name: 'github_get_file',
        description: 'Get file contents from a repository',
        inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, path: { type: 'string' }, ref: { type: 'string' } }, required: ['owner', 'repo', 'path'] },
        handler: async (args: { owner: string; repo: string; path: string; ref?: string }) => {
          const q = args.ref ? `?ref=${args.ref}` : '';
          const data: any = await ghFetch(`/repos/${args.owner}/${args.repo}/contents/${args.path}${q}`);
          if (data.content) data.decoded = Buffer.from(data.content, 'base64').toString('utf-8');
          return data;
        },
      },
    ],
  };
}
