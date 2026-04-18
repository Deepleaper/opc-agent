import type { MCPTool, MCPToolResult } from '../mcp';

export const NotionTool: MCPTool = {
  name: 'notion',
  description: 'Interact with Notion API: create pages, search, append blocks. Requires NOTION_API_KEY env var.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create_page', 'search', 'append_block'], description: 'Action to perform' },
      parent_id: { type: 'string', description: 'Parent page/database ID' },
      title: { type: 'string', description: 'Page title (for create_page)' },
      content: { type: 'string', description: 'Content text (for create_page or append_block)' },
      query: { type: 'string', description: 'Search query (for search)' },
      block_id: { type: 'string', description: 'Block ID (for append_block)' },
    },
    required: ['action'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const apiKey = process.env.NOTION_API_KEY;
    if (!apiKey) return { content: 'Error: NOTION_API_KEY required', isError: true };

    const action = String(input.action ?? '');
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    };

    try {
      if (action === 'create_page') {
        if (!input.parent_id) return { content: 'Error: parent_id required', isError: true };
        const res = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST', headers,
          body: JSON.stringify({
            parent: { page_id: input.parent_id },
            properties: { title: { title: [{ text: { content: String(input.title ?? 'Untitled') } }] } },
            children: input.content ? [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: String(input.content) } }] } }] : [],
          }),
        });
        const data = await res.json() as Record<string, unknown>;
        return { content: `Page created: ${data.id ?? 'unknown'}` };
      }

      if (action === 'search') {
        const res = await fetch('https://api.notion.com/v1/search', {
          method: 'POST', headers,
          body: JSON.stringify({ query: String(input.query ?? '') }),
        });
        const data = await res.json() as Record<string, unknown>;
        return { content: JSON.stringify(data, null, 2).slice(0, 4000) };
      }

      if (action === 'append_block') {
        if (!input.block_id) return { content: 'Error: block_id required', isError: true };
        const res = await fetch(`https://api.notion.com/v1/blocks/${input.block_id}/children`, {
          method: 'PATCH', headers,
          body: JSON.stringify({
            children: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: String(input.content ?? '') } }] } }],
          }),
        });
        const data = await res.json() as Record<string, unknown>;
        return { content: `Block appended: ${JSON.stringify(data).slice(0, 500)}` };
      }

      return { content: `Unknown action: ${action}`, isError: true };
    } catch (err) {
      return { content: `Notion error: ${(err as Error).message}`, isError: true };
    }
  },
};
