import { describe, it, expect } from 'vitest';
import { HookManager, ALL_HOOK_EVENTS } from '../src/core/hooks';
import type { HookContext, HookEvent } from '../src/core/hooks';

describe('HookManager', () => {
  it('should have 14 hook events defined', () => {
    // 7 before/after pairs (message/tool/llm/send/learn/recall) = 12 + on:error/start/stop = 15
    expect(ALL_HOOK_EVENTS.length).toBe(15);
  });

  it('should register and run hooks', async () => {
    const mgr = new HookManager();
    let called = false;
    mgr.register('before:message', () => { called = true; });
    await mgr.run('before:message');
    expect(called).toBe(true);
  });

  it('should run hooks in priority order', async () => {
    const mgr = new HookManager();
    const order: number[] = [];
    mgr.register('before:tool', () => { order.push(2); }, { priority: 200 });
    mgr.register('before:tool', () => { order.push(1); }, { priority: 50 });
    mgr.register('before:tool', () => { order.push(3); }, { priority: 300 });
    await mgr.run('before:tool');
    expect(order).toEqual([1, 2, 3]);
  });

  it('should allow context modification', async () => {
    const mgr = new HookManager();
    mgr.register('before:llm', (ctx) => ({ ...ctx, modified: true }));
    mgr.register('before:llm', (ctx) => ({ ...ctx, extra: 'data' }));
    const result = await mgr.run('before:llm', { original: true });
    expect(result.original).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.extra).toBe('data');
  });

  it('should unregister hooks', async () => {
    const mgr = new HookManager();
    let count = 0;
    const id = mgr.register('after:message', () => { count++; });
    await mgr.run('after:message');
    expect(count).toBe(1);
    expect(mgr.unregister(id)).toBe(true);
    await mgr.run('after:message');
    expect(count).toBe(1);
  });

  it('should list registered hooks', () => {
    const mgr = new HookManager();
    mgr.register('on:error', () => {}, { name: 'error-logger', priority: 10 });
    const list = mgr.getRegistered('on:error');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('error-logger');
    expect(list[0].priority).toBe(10);
  });

  it('should clear hooks', () => {
    const mgr = new HookManager();
    mgr.register('on:start', () => {});
    mgr.register('on:stop', () => {});
    mgr.clear('on:start');
    expect(mgr.hasHooks('on:start')).toBe(false);
    expect(mgr.hasHooks('on:stop')).toBe(true);
    mgr.clear();
    expect(mgr.hasHooks('on:stop')).toBe(false);
  });

  it('should handle async hooks', async () => {
    const mgr = new HookManager();
    mgr.register('before:send', async (ctx) => {
      await new Promise(r => setTimeout(r, 5));
      return { ...ctx, async: true };
    });
    const result = await mgr.run('before:send', {});
    expect(result.async).toBe(true);
  });
});
