import { describe, it, expect, beforeEach } from 'vitest';
import { A2AHttpServer, A2AHttpClient, NetworkRegistry } from '../src/core/a2a-http';
import { AgentCardRegistry } from '../src/core/a2a';
import type { AgentCard } from '../src/core/a2a';

const testCard: AgentCard = {
  name: 'test-agent',
  description: 'A test agent for unit tests',
  capabilities: ['chat', 'search'],
  endpoint: 'http://localhost:3000',
  handler: async (msg: string) => `Echo: ${msg}`,
};

describe('A2AHttpServer', () => {
  it('should create server with router', () => {
    const server = new A2AHttpServer({ card: testCard });
    expect(server.router).toBeDefined();
  });

  it('should expose registry', () => {
    const registry = new AgentCardRegistry();
    const server = new A2AHttpServer({ card: testCard, registry });
    expect(server.getRegistry()).toBe(registry);
    expect(server.getRegistry().get('test-agent')).toBeDefined();
  });

  it('should update card', () => {
    const server = new A2AHttpServer({ card: { ...testCard } });
    server.updateCard({ description: 'Updated' });
    const reg = server.getRegistry().get('test-agent');
    expect(reg?.description).toBe('Updated');
  });
});

describe('A2AHttpClient', () => {
  it('should instantiate', () => {
    const client = new A2AHttpClient();
    expect(client).toBeDefined();
  });
});

describe('NetworkRegistry', () => {
  let network: NetworkRegistry;

  beforeEach(() => {
    network = new NetworkRegistry();
  });

  it('should register local agent', () => {
    network.registerLocal(testCard);
    const found = network.get('test-agent');
    expect(found).toBeDefined();
    expect(found?.type).toBe('local');
  });

  it('should list all agents', () => {
    network.registerLocal(testCard);
    const all = network.listAll();
    expect(all.length).toBe(1);
    expect(all[0].type).toBe('local');
  });

  it('should call local agent', async () => {
    network.registerLocal(testCard);
    const result = await network.call('caller', 'test-agent', 'chat', 'hello');
    expect(result.status).toBe('success');
    expect(result.response).toBe('Echo: hello');
  });

  it('should return error for unknown agent', async () => {
    const result = await network.call('caller', 'unknown', 'chat', 'hello');
    expect(result.status).toBe('error');
    expect(result.error).toContain('not found');
  });

  it('should unregister agent', () => {
    network.registerLocal(testCard);
    network.unregister('test-agent');
    expect(network.get('test-agent')).toBeUndefined();
  });

  it('should expose client and local registry', () => {
    expect(network.getClient()).toBeDefined();
    expect(network.getLocalRegistry()).toBeDefined();
  });
});
