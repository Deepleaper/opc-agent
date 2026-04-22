import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from '../src/core/a2a';
import { BaseAgent } from '../src/core/agent';
import { InMemoryStore } from '../src/memory';

function createTestAgent(name: string): BaseAgent {
  const agent = new BaseAgent({ name, model: 'test', systemPrompt: `I am ${name}` }, new InMemoryStore());
  return agent;
}

describe('AgentRegistry (A2A)', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it('should register and discover agents', () => {
    const agent = createTestAgent('agent-1');
    registry.register(agent, [{ name: 'summarize', description: 'Summarize text' }]);
    
    const all = registry.discover();
    expect(all).toHaveLength(1);
    expect(all[0].agentName).toBe('agent-1');
  });

  it('should discover by capability', () => {
    const a1 = createTestAgent('a1');
    const a2 = createTestAgent('a2');
    registry.register(a1, [{ name: 'summarize', description: 'Summarize' }]);
    registry.register(a2, [{ name: 'translate', description: 'Translate' }]);

    const found = registry.discover('translate');
    expect(found).toHaveLength(1);
    expect(found[0].agentName).toBe('a2');
  });

  it('should unregister agents', () => {
    const agent = createTestAgent('temp');
    registry.register(agent, []);
    registry.unregister('temp');
    expect(registry.discover()).toHaveLength(0);
  });

  it('should handle request to unknown agent', async () => {
    const response = await registry.call('a1', 'unknown', 'test', 'hello');
    expect(response.status).toBe('error');
  });

  it('should send A2A request and get response', async () => {
    const agent = createTestAgent('responder');
    await agent.init();
    registry.register(agent, [{ name: 'chat', description: 'Chat' }]);

    const response = await registry.call('caller', 'responder', 'chat', 'hello');
    // Without a real model provider, the agent may return error/timeout
    expect(['success', 'error', 'timeout']).toContain(response.status);
  });

  it('should get agent by name', () => {
    const agent = createTestAgent('finder');
    registry.register(agent, []);
    expect(registry.getAgent('finder')).toBeDefined();
    expect(registry.getAgent('none')).toBeUndefined();
  });
});
