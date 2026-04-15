import { describe, it, expect } from 'vitest';
import { BaseAgent } from '../src/core/agent';

describe('BaseAgent', () => {
  it('should start in init state', () => {
    const agent = new BaseAgent({ name: 'test' });
    expect(agent.state).toBe('init');
    expect(agent.name).toBe('test');
  });

  it('should transition through lifecycle', async () => {
    const agent = new BaseAgent({ name: 'test' });
    const states: string[] = [];
    agent.on('state:change', (_from, to) => states.push(to));

    await agent.init();
    expect(agent.state).toBe('ready');

    await agent.start();
    expect(agent.state).toBe('running');

    await agent.stop();
    expect(agent.state).toBe('stopped');

    expect(states).toEqual(['ready', 'running', 'stopped']);
  });

  it('should not start if not ready', async () => {
    const agent = new BaseAgent({ name: 'test' });
    await expect(agent.start()).rejects.toThrow('Cannot start agent in state: init');
  });

  it('should handle messages with stub provider', async () => {
    const agent = new BaseAgent({ name: 'test', systemPrompt: 'Be helpful' });
    await agent.init();

    const response = await agent.handleMessage({
      id: 'msg_1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    });

    expect(response.role).toBe('assistant');
    expect(response.content).toContain('Hello');
  });

  it('should use skills before LLM fallback', async () => {
    const agent = new BaseAgent({ name: 'test' });
    await agent.init();

    agent.registerSkill({
      name: 'greeter',
      description: 'Greets users',
      execute: async (_ctx, msg) => {
        if (msg.content.toLowerCase().includes('hello')) {
          return { handled: true, response: 'Hi there!', confidence: 1.0 };
        }
        return { handled: false, confidence: 0 };
      },
    });

    const response = await agent.handleMessage({
      id: 'msg_1',
      role: 'user',
      content: 'Hello!',
      timestamp: Date.now(),
    });

    expect(response.content).toBe('Hi there!');
  });
});
