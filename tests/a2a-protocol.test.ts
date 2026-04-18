import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { A2AServer } from '../src/protocols/a2a/server';
import { A2AClient } from '../src/protocols/a2a/client';
import { oadToAgentCard } from '../src/protocols/a2a/utils';
import { JSON_RPC_ERRORS } from '../src/protocols/a2a/types';
import type { A2AAgentCard, A2ATask, A2AMessage } from '../src/protocols/a2a/types';

// Mock agent
function createMockAgent(name = 'test-agent') {
  return {
    name,
    config: { systemPrompt: 'I am a test agent' },
    handleMessage: async (msg: any) => ({ content: `Echo: ${msg.content}`, role: 'assistant' }),
  };
}

describe('oadToAgentCard', () => {
  it('should generate card from OAD', () => {
    const oad = {
      metadata: { name: 'my-agent', description: 'A test agent', version: '2.0.0' },
      spec: {
        skills: [
          { id: 'sum', name: 'Summarize', description: 'Summarize text', tags: ['nlp'] },
        ],
        channels: [{ type: 'websocket' }],
      },
    };
    const card = oadToAgentCard(oad, 'http://localhost:3001');
    expect(card.name).toBe('my-agent');
    expect(card.description).toBe('A test agent');
    expect(card.version).toBe('2.0.0');
    expect(card.url).toBe('http://localhost:3001');
    expect(card.skills).toHaveLength(1);
    expect(card.skills[0].id).toBe('sum');
    expect(card.capabilities.streaming).toBe(true);
  });

  it('should create default skill when none defined', () => {
    const oad = { metadata: { name: 'basic', description: 'Basic agent' }, spec: {} };
    const card = oadToAgentCard(oad, 'http://localhost:3001');
    expect(card.skills).toHaveLength(1);
    expect(card.skills[0].id).toBe('default');
  });

  it('should handle empty OAD', () => {
    const card = oadToAgentCard({}, 'http://localhost:3001');
    expect(card.name).toBe('opc-agent');
    expect(card.url).toBe('http://localhost:3001');
  });

  it('should strip trailing slash from URL', () => {
    const card = oadToAgentCard({}, 'http://localhost:3001/');
    expect(card.url).toBe('http://localhost:3001');
  });
});

describe('A2AServer', () => {
  let server: A2AServer;
  const PORT = 39871;

  beforeEach(async () => {
    const agent = createMockAgent();
    server = new A2AServer(agent, {
      card: { name: 'test-server', description: 'Test', url: `http://localhost:${PORT}` },
    });
    await server.start(PORT);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should serve /.well-known/agent.json', async () => {
    const res = await fetch(`http://localhost:${PORT}/.well-known/agent.json`);
    expect(res.status).toBe(200);
    const card: A2AAgentCard = await res.json() as any;
    expect(card.name).toBe('test-server');
  });

  it('should handle tasks/send', async () => {
    const res = await fetch(`http://localhost:${PORT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: '1', method: 'tasks/send',
        params: { id: 'task-1', message: { role: 'user', parts: [{ type: 'text', text: 'Hello' }] } },
      }),
    });
    const json = await res.json() as any;
    expect(json.result.id).toBe('task-1');
    expect(json.result.status.state).toBe('completed');
    expect(json.result.history).toHaveLength(2); // user + agent
  });

  it('should handle tasks/get', async () => {
    // First create a task
    await fetch(`http://localhost:${PORT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: '1', method: 'tasks/send',
        params: { id: 'task-get-1', message: { role: 'user', parts: [{ type: 'text', text: 'Hi' }] } },
      }),
    });

    // Then get it
    const res = await fetch(`http://localhost:${PORT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: '2', method: 'tasks/get', params: { id: 'task-get-1' } }),
    });
    const json = await res.json() as any;
    expect(json.result.id).toBe('task-get-1');
    expect(json.result.status.state).toBe('completed');
  });

  it('should handle tasks/cancel', async () => {
    // Create task
    await fetch(`http://localhost:${PORT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: '1', method: 'tasks/send',
        params: { id: 'task-cancel-1', message: { role: 'user', parts: [{ type: 'text', text: 'Hi' }] } },
      }),
    });

    const res = await fetch(`http://localhost:${PORT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: '2', method: 'tasks/cancel', params: { id: 'task-cancel-1' } }),
    });
    const json = await res.json() as any;
    expect(json.result.status.state).toBe('canceled');
  });

  it('should return error for unknown task', async () => {
    const res = await fetch(`http://localhost:${PORT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'tasks/get', params: { id: 'nonexistent' } }),
    });
    const json = await res.json() as any;
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe(JSON_RPC_ERRORS.TASK_NOT_FOUND);
  });

  it('should return error for unknown method', async () => {
    const res = await fetch(`http://localhost:${PORT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'unknown/method', params: {} }),
    });
    const json = await res.json() as any;
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe(JSON_RPC_ERRORS.METHOD_NOT_FOUND);
  });

  it('should return parse error for invalid JSON', async () => {
    const res = await fetch(`http://localhost:${PORT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const json = await res.json() as any;
    expect(json.error.code).toBe(JSON_RPC_ERRORS.PARSE_ERROR);
  });

  it('should return getAgentCard()', () => {
    const card = server.getAgentCard();
    expect(card.name).toBe('test-server');
    expect(card.capabilities).toBeDefined();
  });
});

describe('A2AClient', () => {
  let server: A2AServer;
  let client: A2AClient;
  const PORT = 39872;

  beforeEach(async () => {
    const agent = createMockAgent();
    server = new A2AServer(agent, {
      card: { name: 'client-test', description: 'Test' },
    });
    await server.start(PORT);
    client = new A2AClient(`http://localhost:${PORT}`);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should getAgentCard', async () => {
    const card = await client.getAgentCard();
    expect(card.name).toBe('client-test');
  });

  it('should sendText and get response', async () => {
    const response = await client.sendText('Hello agent');
    expect(response).toContain('Echo: Hello agent');
  });

  it('should sendTask with message', async () => {
    const task = await client.sendTask(
      { role: 'user', parts: [{ type: 'text', text: 'Test message' }] },
      { taskId: 'client-task-1' },
    );
    expect(task.id).toBe('client-task-1');
    expect(task.status.state).toBe('completed');
  });

  it('should getTask', async () => {
    await client.sendText('setup', { taskId: 'get-test' });
    const task = await client.getTask('get-test');
    expect(task.id).toBe('get-test');
  });

  it('should cancelTask', async () => {
    await client.sendText('setup', { taskId: 'cancel-test' });
    const task = await client.cancelTask('cancel-test');
    expect(task.status.state).toBe('canceled');
  });
});

describe('Task state transitions', () => {
  it('should track state transitions through task lifecycle', async () => {
    const states: string[] = [];
    const agent = createMockAgent();
    const server = new A2AServer(agent);
    
    server.onTask(async (task) => {
      states.push(task.status.state);
      task.status = { state: 'working', timestamp: new Date().toISOString() };
      states.push('working');
      task.status = { state: 'completed', timestamp: new Date().toISOString() };
      states.push('completed');
      return task;
    });

    const PORT = 39873;
    await server.start(PORT);
    
    const client = new A2AClient(`http://localhost:${PORT}`);
    await client.sendText('test');
    
    expect(states).toContain('working');
    expect(states).toContain('completed');
    
    await server.stop();
  });
});

describe('Message part types', () => {
  it('should handle text parts', async () => {
    const server = new A2AServer(createMockAgent());
    const PORT = 39874;
    await server.start(PORT);

    const msg: A2AMessage = { role: 'user', parts: [{ type: 'text', text: 'hello' }] };
    const client = new A2AClient(`http://localhost:${PORT}`);
    const task = await client.sendTask(msg);
    expect(task.history[0].parts[0].type).toBe('text');

    await server.stop();
  });

  it('should handle file parts in message', () => {
    const msg: A2AMessage = {
      role: 'user',
      parts: [{ type: 'file', file: { name: 'test.txt', mimeType: 'text/plain', bytes: 'aGVsbG8=' } }],
    };
    expect(msg.parts[0].type).toBe('file');
    expect((msg.parts[0] as any).file.name).toBe('test.txt');
  });

  it('should handle data parts in message', () => {
    const msg: A2AMessage = {
      role: 'user',
      parts: [{ type: 'data', data: { key: 'value', count: 42 } }],
    };
    expect(msg.parts[0].type).toBe('data');
    expect((msg.parts[0] as any).data.key).toBe('value');
  });
});
