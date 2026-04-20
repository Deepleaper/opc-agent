import { describe, it, expect } from 'vitest';
import { PriorityQueue, FastModeManager } from '../src/core/priority-queue';

describe('PriorityQueue', () => {
  it('dequeues fast before normal', () => {
    const pq = new PriorityQueue();
    pq.enqueue({ id: '1', priority: 'normal', provider: 'openai', model: 'gpt-4', payload: {}, enqueuedAt: Date.now() });
    pq.enqueue({ id: '2', priority: 'fast', provider: 'openai', model: 'gpt-4', payload: {}, enqueuedAt: Date.now() });

    const first = pq.dequeue();
    expect(first?.id).toBe('2');
    expect(first?.priority).toBe('fast');

    pq.complete('openai', 'fast');
    const second = pq.dequeue();
    expect(second?.id).toBe('1');
  });

  it('respects concurrency limits', () => {
    const pq = new PriorityQueue({ maxConcurrentFast: 1 });
    pq.enqueue({ id: '1', priority: 'fast', provider: 'openai', model: 'gpt-4', payload: {}, enqueuedAt: Date.now() });
    pq.enqueue({ id: '2', priority: 'fast', provider: 'openai', model: 'gpt-4', payload: {}, enqueuedAt: Date.now() });

    const first = pq.dequeue();
    expect(first?.id).toBe('1');

    // Second should be blocked
    const second = pq.dequeue();
    expect(second).toBeUndefined();

    // After completing first, second should be available
    pq.complete('openai', 'fast');
    const third = pq.dequeue();
    expect(third?.id).toBe('2');
  });

  it('supportsPriority checks config', () => {
    const pq = new PriorityQueue({ supportedProviders: ['openai'] });
    expect(pq.supportsPriority('openai')).toBe(true);
    expect(pq.supportsPriority('local')).toBe(false);
  });

  it('getStats returns correct counts', () => {
    const pq = new PriorityQueue();
    pq.enqueue({ id: '1', priority: 'fast', provider: 'openai', model: 'gpt-4', payload: {}, enqueuedAt: Date.now() });
    pq.enqueue({ id: '2', priority: 'normal', provider: 'openai', model: 'gpt-4', payload: {}, enqueuedAt: Date.now() });
    pq.enqueue({ id: '3', priority: 'batch', provider: 'openai', model: 'gpt-4', payload: {}, enqueuedAt: Date.now() });

    const stats = pq.getStats();
    expect(stats.fast).toBe(1);
    expect(stats.normal).toBe(1);
    expect(stats.batch).toBe(1);
    expect(stats.total).toBe(3);
  });

  it('drain returns all queued requests', () => {
    const pq = new PriorityQueue();
    pq.enqueue({ id: '1', priority: 'fast', provider: 'openai', model: 'gpt-4', payload: {}, enqueuedAt: Date.now() });
    pq.enqueue({ id: '2', priority: 'normal', provider: 'openai', model: 'gpt-4', payload: {}, enqueuedAt: Date.now() });

    const drained = pq.drain();
    expect(drained).toHaveLength(2);
    expect(pq.getStats().total).toBe(0);
  });

  it('registerEndpoint adds custom provider', () => {
    const pq = new PriorityQueue();
    expect(pq.supportsPriority('custom-llm')).toBe(false);
    pq.registerEndpoint({ provider: 'custom-llm', priorityHeader: { key: 'X-Fast', value: '1' } });
    expect(pq.supportsPriority('custom-llm')).toBe(true);
    expect(pq.getEndpoint('custom-llm')?.priorityHeader?.key).toBe('X-Fast');
  });
});

describe('FastModeManager', () => {
  it('toggles per-session', () => {
    const fm = new FastModeManager();
    expect(fm.isEnabled('sess1')).toBe(false);
    expect(fm.toggle('sess1')).toBe(true);
    expect(fm.isEnabled('sess1')).toBe(true);
    expect(fm.toggle('sess1')).toBe(false);
  });

  it('getPriority returns correct level', () => {
    const fm = new FastModeManager();
    expect(fm.getPriority('sess1')).toBe('normal');
    fm.set('sess1', true);
    expect(fm.getPriority('sess1')).toBe('fast');
  });
});
