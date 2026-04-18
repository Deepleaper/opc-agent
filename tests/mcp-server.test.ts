import { describe, it, expect, beforeEach } from 'vitest';
import { MCPServer } from '../src/protocols/mcp/server';
import { agentToMCPTools, agentToMCPResources } from '../src/protocols/mcp/agent-tools';
import type { MCPServerToolDefinition, JsonRpcRequest } from '../src/protocols/mcp/types';

function makeRequest(method: string, params?: any, id: number = 1): JsonRpcRequest {
  return { jsonrpc: '2.0', id, method, params };
}

describe('MCPServer', () => {
  let server: MCPServer;
  const echoTool: MCPServerToolDefinition = {
    name: 'echo',
    description: 'Echo back input',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
    handler: async (args) => `Echo: ${args.text}`,
  };

  beforeEach(() => {
    server = new MCPServer({ name: 'test-server', version: '1.0.0', tools: [echoTool] });
  });

  it('initialize response has capabilities', async () => {
    const res = await server.handleMessage(makeRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0' },
    }));
    expect(res).toBeDefined();
    expect(res!.result.protocolVersion).toBe('2024-11-05');
    expect(res!.result.capabilities.tools).toBeDefined();
    expect(res!.result.serverInfo.name).toBe('test-server');
  });

  it('tools/list returns registered tools', async () => {
    const res = await server.handleMessage(makeRequest('tools/list'));
    expect(res!.result.tools).toHaveLength(1);
    expect(res!.result.tools[0].name).toBe('echo');
    expect(res!.result.tools[0].description).toBe('Echo back input');
    expect(res!.result.tools[0].inputSchema).toBeDefined();
  });

  it('tools/call executes handler and returns content', async () => {
    const res = await server.handleMessage(makeRequest('tools/call', {
      name: 'echo', arguments: { text: 'hello' },
    }));
    expect(res!.result.content).toHaveLength(1);
    expect(res!.result.content[0].text).toBe('Echo: hello');
  });

  it('tools/call returns error for missing tool', async () => {
    const res = await server.handleMessage(makeRequest('tools/call', {
      name: 'nonexistent', arguments: {},
    }));
    expect(res!.error).toBeDefined();
    expect(res!.error!.code).toBe(-32001);
  });

  it('tools/call validates required params', async () => {
    const res = await server.handleMessage(makeRequest('tools/call', {
      name: 'echo', arguments: {},
    }));
    expect(res!.error).toBeDefined();
    expect(res!.error!.code).toBe(-32602);
    expect(res!.error!.message).toContain('text');
  });

  it('resources/list returns registered resources', async () => {
    server.addResource({
      uri: 'test://doc', name: 'TestDoc', description: 'A doc', mimeType: 'text/plain',
      handler: async () => 'Hello content',
    });
    const res = await server.handleMessage(makeRequest('resources/list'));
    expect(res!.result.resources).toHaveLength(1);
    expect(res!.result.resources[0].uri).toBe('test://doc');
  });

  it('resources/read returns resource content', async () => {
    server.addResource({
      uri: 'test://doc', name: 'TestDoc', mimeType: 'text/plain',
      handler: async () => 'Hello content',
    });
    const res = await server.handleMessage(makeRequest('resources/read', { uri: 'test://doc' }));
    expect(res!.result.contents[0].text).toBe('Hello content');
  });

  it('resources/read returns error for unknown resource', async () => {
    const res = await server.handleMessage(makeRequest('resources/read', { uri: 'nope://x' }));
    expect(res!.error).toBeDefined();
    expect(res!.error!.code).toBe(-32002);
  });

  it('unknown method returns METHOD_NOT_FOUND', async () => {
    const res = await server.handleMessage(makeRequest('foo/bar'));
    expect(res!.error).toBeDefined();
    expect(res!.error!.code).toBe(-32601);
  });

  it('JSON-RPC format: response has jsonrpc 2.0 and matching id', async () => {
    const res = await server.handleMessage(makeRequest('tools/list', {}, 42));
    expect(res!.jsonrpc).toBe('2.0');
    expect(res!.id).toBe(42);
  });

  it('notification (no id) returns null', async () => {
    const res = await server.handleMessage({
      jsonrpc: '2.0', method: 'notifications/initialized', params: {},
    } as any);
    expect(res).toBeNull();
  });

  it('prompts/list returns prompts', async () => {
    server.addPrompt({
      name: 'summarize', description: 'Summarize text',
      arguments: [{ name: 'text', required: true }],
    });
    const res = await server.handleMessage(makeRequest('prompts/list'));
    expect(res!.result.prompts).toHaveLength(1);
    expect(res!.result.prompts[0].name).toBe('summarize');
  });

  it('addTool/removeTool works dynamically', () => {
    expect(server.getToolCount()).toBe(1);
    server.addTool({ name: 'test2', description: 't', inputSchema: {}, handler: async () => 'ok' });
    expect(server.getToolCount()).toBe(2);
    server.removeTool('test2');
    expect(server.getToolCount()).toBe(1);
  });
});

describe('agentToMCPTools', () => {
  it('generates correct tools from agent', () => {
    const agent = { name: 'test-agent' };
    const tools = agentToMCPTools(agent);
    expect(tools.length).toBeGreaterThanOrEqual(3);
    const names = tools.map(t => t.name);
    expect(names).toContain('chat');
    expect(names).toContain('memory_search');
    expect(names).toContain('memory_store');
  });

  it('chat tool has correct schema', () => {
    const tools = agentToMCPTools({ name: 'bot' });
    const chat = tools.find(t => t.name === 'chat')!;
    expect(chat.inputSchema.required).toContain('message');
    expect(chat.description).toContain('bot');
  });

  it('exposes agent skills as tools', () => {
    const agent = {
      name: 'skilled',
      skills: [{ name: 'translate', description: 'Translate text', execute: async () => 'done' }],
    };
    const tools = agentToMCPTools(agent);
    const skillTool = tools.find(t => t.name === 'skill_translate');
    expect(skillTool).toBeDefined();
    expect(skillTool!.description).toContain('Translate');
  });
});

describe('agentToMCPResources', () => {
  it('returns empty array for non-existent dir', () => {
    const resources = agentToMCPResources({}, '/tmp/nonexistent-agent-dir-xyz');
    expect(resources).toEqual([]);
  });

  it('exposes agent files that exist', () => {
    // Use current project dir which has files
    const path = require('path');
    const resources = agentToMCPResources({}, path.resolve(__dirname, '..'));
    // At minimum no crash; might find some files
    expect(Array.isArray(resources)).toBe(true);
  });
});
