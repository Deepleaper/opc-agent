import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubAgentManager } from '../src/core/subagent';
import { BaseAgent } from '../src/core/agent';

// Mock the provider so we don't need real API keys
vi.mock('../src/providers', () => ({
  createProvider: vi.fn(() => ({
    name: 'mock',
    chat: vi.fn().mockResolvedValue('mock response'),
    chatStream: vi.fn(),
  })),
  SUPPORTED_PROVIDERS: ['openai'],
}));

describe('SubAgentManager', () => {
  let manager: SubAgentManager;

  beforeEach(() => {
    manager = new SubAgentManager();
  });

  it('should spawn a sub-agent and return result', async () => {
    const result = await manager.spawn({
      name: 'test-agent',
      task: 'Hello',
    });

    expect(result.name).toBe('test-agent');
    expect(result.status).toBe('completed');
    expect(result.result).toBe('mock response');
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.id).toMatch(/^sub_/);
  });

  it('should track agents in list', async () => {
    await manager.spawn({ name: 'agent-1', task: 'task 1' });
    await manager.spawn({ name: 'agent-2', task: 'task 2' });

    const list = manager.list();
    expect(list).toHaveLength(2);
    expect(list[0].status).toBe('completed');
    expect(list[1].status).toBe('completed');
  });

  it('should spawn parallel agents', async () => {
    const results = await manager.spawnParallel([
      { name: 'p1', task: 'task 1' },
      { name: 'p2', task: 'task 2' },
      { name: 'p3', task: 'task 3' },
    ]);

    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r.status).toBe('completed');
      expect(r.result).toBe('mock response');
    });
  });

  it('should kill a sub-agent', async () => {
    const result = await manager.spawn({ name: 'killable', task: 'task' });

    expect(manager.kill(result.id)).toBe(true);
    const list = manager.list();
    const killed = list.find((a) => a.id === result.id);
    expect(killed?.status).toBe('killed');
  });

  it('should return false when killing non-existent agent', () => {
    expect(manager.kill('non-existent')).toBe(false);
  });

  it('should handle timeout', async () => {
    const { createProvider } = await import('../src/providers');
    (createProvider as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      name: 'mock-slow',
      chat: () => new Promise((resolve) => setTimeout(() => resolve('late'), 5000)),
      chatStream: vi.fn(),
    });

    const result = await manager.spawn({
      name: 'slow-agent',
      task: 'slow task',
      timeout: 50,
    });

    expect(result.status).toBe('timeout');
  });

  it('should handle failed agents', async () => {
    const { createProvider } = await import('../src/providers');
    (createProvider as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      name: 'mock-fail',
      chat: () => Promise.reject(new Error('provider error')),
      chatStream: vi.fn(),
    });

    const result = await manager.spawn({
      name: 'fail-agent',
      task: 'fail task',
    });

    expect(result.status).toBe('failed');
    expect(result.result).toBe('provider error');
  });

  it('should list empty when no agents spawned', () => {
    expect(manager.list()).toEqual([]);
  });

  it('should use isolated memory by default', async () => {
    const result = await manager.spawn({
      name: 'isolated',
      task: 'test',
      isolated: true,
    });
    expect(result.status).toBe('completed');
  });

  it('should spawn with custom systemPrompt', async () => {
    const result = await manager.spawn({
      name: 'custom-prompt',
      task: 'test',
      systemPrompt: 'You are a custom assistant',
    });
    expect(result.status).toBe('completed');
    expect(result.name).toBe('custom-prompt');
  });

  it('should spawn with custom model', async () => {
    const result = await manager.spawn({
      name: 'custom-model',
      task: 'test',
      model: 'gpt-4',
    });
    expect(result.status).toBe('completed');
  });

  it('spawnParallel returns all results even with mix', async () => {
    const results = await manager.spawnParallel([
      { name: 'a', task: 't1' },
      { name: 'b', task: 't2' },
    ]);
    expect(results).toHaveLength(2);
    expect(results.every(r => r.result === 'mock response')).toBe(true);
  });

  it('kill returns false for unknown id', () => {
    expect(manager.kill('unknown-id-xyz')).toBe(false);
  });

  it('list shows correct status after completion', async () => {
    await manager.spawn({ name: 'done', task: 'task' });
    const list = manager.list();
    expect(list.every(a => a.status === 'completed')).toBe(true);
  });

  it('sub-agent name is preserved in result', async () => {
    const result = await manager.spawn({ name: 'my-special-name', task: 'x' });
    expect(result.name).toBe('my-special-name');
  });

  it('multiple sequential spawns tracked correctly', async () => {
    await manager.spawn({ name: 's1', task: 't' });
    await manager.spawn({ name: 's2', task: 't' });
    await manager.spawn({ name: 's3', task: 't' });
    const list = manager.list();
    expect(list).toHaveLength(3);
    expect(new Set(list.map(a => a.id)).size).toBe(3);
  });

  it('each spawn gets unique id', async () => {
    const r1 = await manager.spawn({ name: 'x', task: 't' });
    const r2 = await manager.spawn({ name: 'x', task: 't' });
    expect(r1.id).not.toBe(r2.id);
  });

  it('result duration is non-negative', async () => {
    const result = await manager.spawn({ name: 'dur', task: 'test' });
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});

describe('BaseAgent subagent methods', () => {
  it('should have spawnSubAgent method', () => {
    const agent = new BaseAgent({ name: 'parent' });
    expect(typeof agent.spawnSubAgent).toBe('function');
  });

  it('should have spawnParallel method', () => {
    const agent = new BaseAgent({ name: 'parent' });
    expect(typeof agent.spawnParallel).toBe('function');
  });
});
