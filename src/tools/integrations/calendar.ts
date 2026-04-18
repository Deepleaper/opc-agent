import type { MCPTool, MCPToolResult } from '../mcp';

export const CalendarTool: MCPTool = {
  name: 'calendar',
  description: 'Google Calendar integration: create events, list events, check availability. Requires GOOGLE_CALENDAR_API_KEY or GOOGLE_ACCESS_TOKEN env var.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create_event', 'list_events', 'check_availability'], description: 'Action' },
      calendar_id: { type: 'string', description: 'Calendar ID (default: primary)' },
      summary: { type: 'string', description: 'Event title' },
      start: { type: 'string', description: 'Start time (ISO 8601)' },
      end: { type: 'string', description: 'End time (ISO 8601)' },
      description: { type: 'string', description: 'Event description' },
      time_min: { type: 'string', description: 'Start of time range (ISO 8601)' },
      time_max: { type: 'string', description: 'End of time range (ISO 8601)' },
    },
    required: ['action'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const token = process.env.GOOGLE_ACCESS_TOKEN;
    if (!token) return { content: 'Error: GOOGLE_ACCESS_TOKEN required', isError: true };

    const calId = encodeURIComponent(String(input.calendar_id ?? 'primary'));
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const action = String(input.action ?? '');

    try {
      if (action === 'create_event') {
        if (!input.summary || !input.start || !input.end) return { content: 'Error: summary, start, end required', isError: true };
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events`, {
          method: 'POST', headers,
          body: JSON.stringify({
            summary: input.summary,
            description: input.description ?? '',
            start: { dateTime: input.start },
            end: { dateTime: input.end },
          }),
        });
        const data = await res.json() as Record<string, unknown>;
        return { content: `Event created: ${data.htmlLink ?? data.id}` };
      }

      if (action === 'list_events') {
        const now = new Date().toISOString();
        const timeMin = String(input.time_min ?? now);
        const timeMax = input.time_max ? `&timeMax=${encodeURIComponent(String(input.time_max))}` : '';
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events?timeMin=${encodeURIComponent(timeMin)}${timeMax}&maxResults=20&singleEvents=true&orderBy=startTime`, { headers });
        const data = await res.json() as Record<string, unknown>;
        return { content: JSON.stringify(data, null, 2).slice(0, 4000) };
      }

      if (action === 'check_availability') {
        if (!input.time_min || !input.time_max) return { content: 'Error: time_min, time_max required', isError: true };
        const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
          method: 'POST', headers,
          body: JSON.stringify({
            timeMin: input.time_min,
            timeMax: input.time_max,
            items: [{ id: String(input.calendar_id ?? 'primary') }],
          }),
        });
        const data = await res.json() as Record<string, unknown>;
        return { content: JSON.stringify(data, null, 2).slice(0, 4000) };
      }

      return { content: `Unknown action: ${action}`, isError: true };
    } catch (err) {
      return { content: `Calendar error: ${(err as Error).message}`, isError: true };
    }
  },
};
