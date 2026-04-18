import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { MCPServerToolDefinition, MCPResourceDefinition } from './types';

/**
 * Convert an OPC agent into MCP tool definitions.
 * Works with any agent-like object that has name/handleMessage/brain.
 */
export function agentToMCPTools(agent: any): MCPServerToolDefinition[] {
  const tools: MCPServerToolDefinition[] = [];
  const agentName = agent?.name || agent?.config?.name || 'agent';

  // 1. Chat tool
  tools.push({
    name: 'chat',
    description: `Chat with ${agentName} agent`,
    inputSchema: {
      type: 'object',
      properties: { message: { type: 'string', description: 'Message to send to the agent' } },
      required: ['message'],
    },
    handler: async (args: any) => {
      if (typeof agent.handleMessage === 'function') {
        const result = await agent.handleMessage({
          role: 'user', content: args.message, channel: 'mcp',
        });
        return typeof result === 'string' ? result : result?.content || JSON.stringify(result);
      }
      return `Agent ${agentName} does not support handleMessage`;
    },
  });

  // 2. Memory search
  tools.push({
    name: 'memory_search',
    description: 'Search agent memory/knowledge',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query' } },
      required: ['query'],
    },
    handler: async (args: any) => {
      const brain = agent.brain || agent.memory || agent.memoryStore;
      if (brain && typeof brain.query === 'function') {
        return await brain.query(args.query);
      }
      if (brain && typeof brain.search === 'function') {
        return await brain.search(args.query);
      }
      return 'Memory search not available';
    },
  });

  // 3. Memory store
  tools.push({
    name: 'memory_store',
    description: 'Store knowledge in agent memory',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Identifier/key for the memory entry' },
        content: { type: 'string', description: 'Content to store' },
      },
      required: ['slug', 'content'],
    },
    handler: async (args: any) => {
      const brain = agent.brain || agent.memory || agent.memoryStore;
      if (brain && typeof brain.put === 'function') {
        await brain.put(args.slug, args.content);
        return `Stored: ${args.slug}`;
      }
      if (brain && typeof brain.store === 'function') {
        await brain.store(args.slug, args.content);
        return `Stored: ${args.slug}`;
      }
      return 'Memory store not available';
    },
  });

  // 4. Expose agent skills as individual tools
  const skills = agent.skills || agent.skillRegistry?.list?.() || [];
  for (const skill of Array.isArray(skills) ? skills : []) {
    const skillName = skill.name || skill.id;
    if (!skillName) continue;
    tools.push({
      name: `skill_${skillName}`,
      description: skill.description || `Execute ${skillName} skill`,
      inputSchema: skill.inputSchema || {
        type: 'object',
        properties: { input: { type: 'string' } },
        required: ['input'],
      },
      handler: async (args: any) => {
        if (typeof skill.execute === 'function') {
          return await skill.execute(args);
        }
        return `Skill ${skillName} not executable`;
      },
    });
  }

  return tools;
}

/**
 * Expose agent files and brain pages as MCP resources.
 */
export function agentToMCPResources(agent: any, agentDir: string): MCPResourceDefinition[] {
  const resources: MCPResourceDefinition[] = [];

  // Standard agent files
  const standardFiles = [
    { name: 'SOUL.md', desc: 'Agent personality and identity' },
    { name: 'CONTEXT.md', desc: 'Agent context' },
    { name: 'AGENTS.md', desc: 'Agent instructions' },
    { name: 'USER.md', desc: 'User profile' },
    { name: 'agent.yaml', desc: 'Agent OAD configuration' },
  ];

  for (const file of standardFiles) {
    const filePath = join(agentDir, file.name);
    if (existsSync(filePath)) {
      resources.push({
        uri: `agent:///${file.name}`,
        name: file.name,
        description: file.desc,
        mimeType: file.name.endsWith('.yaml') ? 'text/yaml' : 'text/markdown',
        handler: async () => readFileSync(filePath, 'utf-8'),
      });
    }
  }

  return resources;
}
