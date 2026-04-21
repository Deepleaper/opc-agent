// v2 studio assistant tools — tools exposed to Studio's built-in assistant agent
import type { ToolDefinition } from '../core/types';

export const STUDIO_ASSISTANT_TOOLS: ToolDefinition[] = [
  {
    name: 'list_agents',
    description: 'List all agents currently running in the Studio pool',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'create_agent',
    description: 'Create a new agent from a config or template name',
    parameters: {
      type: 'object',
      properties: {
        template: { type: 'string', description: 'Template name or "custom"' },
        name: { type: 'string', description: 'Agent display name' },
      },
      required: ['template', 'name'],
    },
  },
  {
    name: 'stop_agent',
    description: 'Stop a running agent by id',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
];

export function getStudioTool(name: string): ToolDefinition | undefined {
  return STUDIO_ASSISTANT_TOOLS.find((t) => t.name === name);
}
