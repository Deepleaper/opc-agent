import { describe, it, expect } from 'vitest';
import { AgentRuntime } from '../src/core/runtime';
import { createCustomerServiceConfig } from '../src/templates/customer-service';

describe('AgentRuntime', () => {
  it('should initialize from config object', async () => {
    const runtime = new AgentRuntime();
    const config = createCustomerServiceConfig();
    const agent = await runtime.initialize(config);
    expect(agent.name).toBe('customer-service');
    expect(agent.state).toBe('ready');
  });

  it('should throw if no config loaded', async () => {
    const runtime = new AgentRuntime();
    await expect(runtime.initialize()).rejects.toThrow('No config loaded');
  });

  it('should register skills after initialization', async () => {
    const runtime = new AgentRuntime();
    const config = createCustomerServiceConfig();
    await runtime.initialize(config);

    runtime.registerSkill({
      name: 'test-skill',
      description: 'Test',
      execute: async () => ({ handled: false, confidence: 0 }),
    });
    // No throw = success
  });

  it('should throw registering skill before init', () => {
    const runtime = new AgentRuntime();
    expect(() =>
      runtime.registerSkill({
        name: 'test',
        description: 'Test',
        execute: async () => ({ handled: false, confidence: 0 }),
      })
    ).toThrow('Agent not initialized');
  });
});
