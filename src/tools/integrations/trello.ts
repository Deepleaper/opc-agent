import type { MCPTool, MCPToolResult } from '../mcp';

export const TrelloTool: MCPTool = {
  name: 'trello',
  description: 'Interact with Trello: create cards, move cards, list boards. Requires TRELLO_API_KEY, TRELLO_TOKEN env vars.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create_card', 'move_card', 'list_boards'], description: 'Action' },
      list_id: { type: 'string', description: 'List ID (for create_card/move_card)' },
      card_id: { type: 'string', description: 'Card ID (for move_card)' },
      name: { type: 'string', description: 'Card name' },
      description: { type: 'string', description: 'Card description' },
    },
    required: ['action'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const key = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;
    if (!key || !token) return { content: 'Error: TRELLO_API_KEY, TRELLO_TOKEN required', isError: true };

    const auth = `key=${key}&token=${token}`;
    const action = String(input.action ?? '');

    try {
      if (action === 'create_card') {
        if (!input.list_id || !input.name) return { content: 'Error: list_id, name required', isError: true };
        const res = await fetch(`https://api.trello.com/1/cards?${auth}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idList: input.list_id, name: input.name, desc: input.description ?? '' }),
        });
        const data = await res.json() as Record<string, unknown>;
        return { content: `Card created: ${data.shortUrl ?? data.id}` };
      }

      if (action === 'move_card') {
        if (!input.card_id || !input.list_id) return { content: 'Error: card_id, list_id required', isError: true };
        await fetch(`https://api.trello.com/1/cards/${input.card_id}?${auth}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idList: input.list_id }),
        });
        return { content: `Card ${input.card_id} moved to list ${input.list_id}` };
      }

      if (action === 'list_boards') {
        const res = await fetch(`https://api.trello.com/1/members/me/boards?${auth}`);
        const data = await res.json() as Array<Record<string, unknown>>;
        const summary = Array.isArray(data) ? data.map((b) => `${b.name} (${b.id})`).join('\n') : JSON.stringify(data);
        return { content: summary };
      }

      return { content: `Unknown action: ${action}`, isError: true };
    } catch (err) {
      return { content: `Trello error: ${(err as Error).message}`, isError: true };
    }
  },
};
