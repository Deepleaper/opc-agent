import type { MCPTool, MCPToolResult } from '../mcp';

export const JiraTool: MCPTool = {
  name: 'jira',
  description: 'Interact with Jira: create issues, update status, search, add comments. Requires JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN env vars.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create_issue', 'update_status', 'search', 'add_comment'], description: 'Action to perform' },
      project: { type: 'string', description: 'Project key (for create_issue)' },
      summary: { type: 'string', description: 'Issue summary' },
      description: { type: 'string', description: 'Issue description' },
      issue_type: { type: 'string', description: 'Issue type (default: Task)' },
      issue_key: { type: 'string', description: 'Issue key (e.g., PROJ-123)' },
      status: { type: 'string', description: 'Target status (for update_status)' },
      comment: { type: 'string', description: 'Comment text' },
      jql: { type: 'string', description: 'JQL query (for search)' },
    },
    required: ['action'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const baseUrl = process.env.JIRA_URL;
    const email = process.env.JIRA_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN;
    if (!baseUrl || !email || !apiToken) return { content: 'Error: JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN required', isError: true };

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const headers = { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'Accept': 'application/json' };
    const action = String(input.action ?? '');

    try {
      if (action === 'create_issue') {
        if (!input.project || !input.summary) return { content: 'Error: project, summary required', isError: true };
        const res = await fetch(`${baseUrl}/rest/api/3/issue`, {
          method: 'POST', headers,
          body: JSON.stringify({
            fields: {
              project: { key: input.project },
              summary: input.summary,
              description: input.description ? { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: String(input.description) }] }] } : undefined,
              issuetype: { name: String(input.issue_type ?? 'Task') },
            },
          }),
        });
        const data = await res.json() as Record<string, unknown>;
        return { content: `Issue created: ${data.key}` };
      }

      if (action === 'update_status') {
        if (!input.issue_key || !input.status) return { content: 'Error: issue_key, status required', isError: true };
        const trRes = await fetch(`${baseUrl}/rest/api/3/issue/${input.issue_key}/transitions`, { headers });
        const trData = await trRes.json() as { transitions: Array<{ id: string; name: string }> };
        const transition = trData.transitions?.find((t) => t.name.toLowerCase() === String(input.status).toLowerCase());
        if (!transition) return { content: `No transition found for status: ${input.status}`, isError: true };
        await fetch(`${baseUrl}/rest/api/3/issue/${input.issue_key}/transitions`, {
          method: 'POST', headers, body: JSON.stringify({ transition: { id: transition.id } }),
        });
        return { content: `${input.issue_key} moved to ${input.status}` };
      }

      if (action === 'search') {
        if (!input.jql) return { content: 'Error: jql required', isError: true };
        const res = await fetch(`${baseUrl}/rest/api/3/search?jql=${encodeURIComponent(String(input.jql))}&maxResults=20`, { headers });
        const data = await res.json() as Record<string, unknown>;
        return { content: JSON.stringify(data, null, 2).slice(0, 4000) };
      }

      if (action === 'add_comment') {
        if (!input.issue_key || !input.comment) return { content: 'Error: issue_key, comment required', isError: true };
        await fetch(`${baseUrl}/rest/api/3/issue/${input.issue_key}/comment`, {
          method: 'POST', headers,
          body: JSON.stringify({ body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: String(input.comment) }] }] } }),
        });
        return { content: `Comment added to ${input.issue_key}` };
      }

      return { content: `Unknown action: ${action}`, isError: true };
    } catch (err) {
      return { content: `Jira error: ${(err as Error).message}`, isError: true };
    }
  },
};
