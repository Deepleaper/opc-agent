import type { MCPTool, MCPToolResult } from '../mcp';

export interface HomeAssistantConfig {
  url: string;
  token: string;
}

let haConfig: HomeAssistantConfig | null = null;

export function configureHomeAssistant(config: HomeAssistantConfig): void {
  haConfig = config;
}

async function haFetch(path: string, options?: RequestInit): Promise<any> {
  if (!haConfig) throw new Error('Home Assistant not configured. Call configureHomeAssistant({ url, token }) first.');
  const resp = await fetch(`${haConfig.url}/api${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${haConfig.token}`, 'Content-Type': 'application/json', ...options?.headers as Record<string, string> },
  });
  if (!resp.ok) throw new Error(`HA API error: ${resp.status} ${resp.statusText}`);
  return resp.json();
}

export const haGetStates: MCPTool = {
  name: 'ha_get_states',
  description: 'Get all Home Assistant entity states or filter by domain',
  inputSchema: {
    type: 'object',
    properties: { domain: { type: 'string', description: 'Filter by domain (e.g. light, switch)' } },
  },
  async execute(input): Promise<MCPToolResult> {
    try {
      let states = await haFetch('/states');
      if (input.domain) states = states.filter((s: any) => s.entity_id.startsWith(`${input.domain}.`));
      return { content: JSON.stringify(states.map((s: any) => ({ entity_id: s.entity_id, state: s.state, attributes: s.attributes }))) };
    } catch (e: any) { return { content: e.message, isError: true }; }
  },
};

export const haCallService: MCPTool = {
  name: 'ha_call_service',
  description: 'Call a Home Assistant service (turn_on, turn_off, toggle, etc.)',
  inputSchema: {
    type: 'object',
    properties: {
      domain: { type: 'string' },
      service: { type: 'string' },
      entity_id: { type: 'string' },
      data: { type: 'object' },
    },
    required: ['domain', 'service'],
  },
  async execute(input): Promise<MCPToolResult> {
    try {
      const body: any = {};
      if (input.entity_id) body.entity_id = input.entity_id;
      if (input.data) Object.assign(body, input.data);
      const result = await haFetch(`/services/${input.domain}/${input.service}`, {
        method: 'POST', body: JSON.stringify(body),
      });
      return { content: JSON.stringify({ success: true, result }) };
    } catch (e: any) { return { content: e.message, isError: true }; }
  },
};

export const haGetHistory: MCPTool = {
  name: 'ha_get_history',
  description: 'Get entity history for a time period',
  inputSchema: {
    type: 'object',
    properties: {
      entity_id: { type: 'string' },
      start: { type: 'string', description: 'ISO datetime' },
      end: { type: 'string', description: 'ISO datetime' },
    },
    required: ['entity_id'],
  },
  async execute(input): Promise<MCPToolResult> {
    try {
      const start = input.start || new Date(Date.now() - 86400000).toISOString();
      let path = `/history/period/${start}?filter_entity_id=${input.entity_id}`;
      if (input.end) path += `&end_time=${input.end}`;
      const result = await haFetch(path);
      return { content: JSON.stringify(result) };
    } catch (e: any) { return { content: e.message, isError: true }; }
  },
};

export const haAutomation: MCPTool = {
  name: 'ha_automation',
  description: 'Trigger or manage Home Assistant automations',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['trigger', 'turn_on', 'turn_off', 'list'] },
      automation_id: { type: 'string' },
    },
    required: ['action'],
  },
  async execute(input): Promise<MCPToolResult> {
    try {
      if (input.action === 'list') {
        const states = await haFetch('/states');
        const automations = states.filter((s: any) => s.entity_id.startsWith('automation.'));
        return { content: JSON.stringify(automations.map((a: any) => ({ entity_id: a.entity_id, state: a.state }))) };
      }
      if (!input.automation_id) return { content: 'automation_id required for this action', isError: true };
      const result = await haFetch(`/services/automation/${input.action}`, {
        method: 'POST', body: JSON.stringify({ entity_id: input.automation_id }),
      });
      return { content: JSON.stringify({ success: true, result }) };
    } catch (e: any) { return { content: e.message, isError: true }; }
  },
};

export const homeAssistantTools: MCPTool[] = [haGetStates, haCallService, haGetHistory, haAutomation];
