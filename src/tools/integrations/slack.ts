import type { MCPTool, MCPToolResult } from '../mcp';

export const SlackTool: MCPTool = {
  name: 'slack',
  description: 'Send messages to Slack channels, list channels, or search messages. Requires SLACK_WEBHOOK_URL or SLACK_BOT_TOKEN env var.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['send_message', 'list_channels', 'search'], description: 'Action to perform' },
      channel: { type: 'string', description: 'Channel name or ID (for send_message)' },
      text: { type: 'string', description: 'Message text (for send_message) or search query (for search)' },
    },
    required: ['action'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const action = String(input.action ?? '');
    const token = process.env.SLACK_BOT_TOKEN;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    try {
      if (action === 'send_message') {
        if (!input.text) return { content: 'Error: text is required', isError: true };
        if (webhookUrl) {
          const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: input.channel, text: input.text }),
          });
          return { content: `Message sent (status: ${res.status})` };
        }
        if (!token) return { content: 'Error: SLACK_BOT_TOKEN or SLACK_WEBHOOK_URL required', isError: true };
        const res = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel: input.channel, text: input.text }),
        });
        const data = await res.json() as Record<string, unknown>;
        return { content: data.ok ? 'Message sent' : `Error: ${data.error}`, isError: !data.ok };
      }

      if (action === 'list_channels') {
        if (!token) return { content: 'Error: SLACK_BOT_TOKEN required', isError: true };
        const res = await fetch('https://slack.com/api/conversations.list', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json() as Record<string, unknown>;
        return { content: JSON.stringify(data, null, 2) };
      }

      if (action === 'search') {
        if (!token) return { content: 'Error: SLACK_BOT_TOKEN required', isError: true };
        const res = await fetch(`https://slack.com/api/search.messages?query=${encodeURIComponent(String(input.text ?? ''))}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json() as Record<string, unknown>;
        return { content: JSON.stringify(data, null, 2) };
      }

      return { content: `Unknown action: ${action}`, isError: true };
    } catch (err) {
      return { content: `Slack error: ${(err as Error).message}`, isError: true };
    }
  },
};
