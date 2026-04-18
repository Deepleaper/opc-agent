import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginManager } from '../src/plugins';
import type { Plugin } from '../src/plugins';
import { loggerPlugin } from '../src/plugins/logger';
import { rateLimiterPlugin, createRateLimiterPlugin } from '../src/plugins/rate-limiter';
import { contentFilterPlugin, createContentFilterPlugin } from '../src/plugins/content-filter';
import { AgentCardRegistry } from '../src/core/a2a';
import type { AgentCard } from '../src/core/a2a';

// ── PluginManager Enhanced Tests ────────────────────────────

describe('PluginManager (enhanced middleware)', () => {
  let pm: PluginManager;

  beforeEach(() => {
    pm = new PluginManager();
  });

  it('should register and list enhanced plugins', () => {
    const p: Plugin = { name: 'test', version: '1.0.0' };
    pm.registerEnhanced(p);
    expect(pm.has('test')).toBe(true);
    expect(pm.listEnhanced()).toHaveLength(1);
  });

  it('should unregister enhanced plugins', () => {
    pm.registerEnhanced({ name: 'tmp', version: '1.0.0' });
    pm.unregisterEnhanced('tmp');
    expect(pm.getEnhanced('tmp')).toBeUndefined();
  });

  it('should get enhanced plugin by name', () => {
    pm.registerEnhanced({ name: 'foo', version: '2.0.0' });
    expect(pm.getEnhanced('foo')?.version).toBe('2.0.0');
  });

  it('should run message middleware chain in order', async () => {
    const order: number[] = [];
    pm.registerEnhanced({
      name: 'p1', version: '1.0.0',
      onMessage: async (msg, next) => { order.push(1); return next({ ...msg, p1: true }); },
    });
    pm.registerEnhanced({
      name: 'p2', version: '1.0.0',
      onMessage: async (msg, next) => { order.push(2); return next({ ...msg, p2: true }); },
    });

    const result = await pm.runMessageMiddleware({ content: 'hi' });
    expect(order).toEqual([1, 2]);
    expect(result.p1).toBe(true);
    expect(result.p2).toBe(true);
  });

  it('should run response middleware chain', async () => {
    pm.registerEnhanced({
      name: 'r1', version: '1.0.0',
      onResponse: async (res, next) => next({ ...res, tagged: true }),
    });

    const result = await pm.runResponseMiddleware({ content: 'reply' });
    expect(result.tagged).toBe(true);
  });

  it('should pass through when no middleware registered', async () => {
    const msg = { content: 'hello' };
    const result = await pm.runMessageMiddleware(msg);
    expect(result).toEqual(msg);
  });

  it('middleware can short-circuit by not calling next', async () => {
    pm.registerEnhanced({
      name: 'blocker', version: '1.0.0',
      onMessage: async (_msg, _next) => ({ content: 'blocked' }),
    });
    pm.registerEnhanced({
      name: 'never', version: '1.0.0',
      onMessage: async (msg, next) => { throw new Error('should not reach'); },
    });

    const result = await pm.runMessageMiddleware({ content: 'test' });
    expect(result.content).toBe('blocked');
  });

  it('initAll calls onInit for enhanced plugins', async () => {
    const inited: string[] = [];
    pm.registerEnhanced({
      name: 'init-test', version: '1.0.0',
      onInit: async () => { inited.push('init-test'); },
    });
    await pm.initAll({});
    expect(inited).toContain('init-test');
  });

  it('shutdownAll calls onShutdown for enhanced plugins', async () => {
    const shutdown: string[] = [];
    pm.registerEnhanced({
      name: 'sd-test', version: '1.0.0',
      onShutdown: async () => { shutdown.push('sd-test'); },
    });
    await pm.shutdownAll();
    expect(shutdown).toContain('sd-test');
  });

  it('list() includes both legacy and enhanced plugins', () => {
    pm.register({ name: 'legacy', version: '1.0.0' });
    pm.registerEnhanced({ name: 'enhanced', version: '1.0.0' });
    expect(pm.list()).toHaveLength(2);
  });
});

// ── Built-in Plugin Tests ───────────────────────────────────

describe('loggerPlugin', () => {
  it('should log and pass through messages', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const msg = { content: 'hello world' };
    const result = await loggerPlugin.onMessage!(msg, async (m) => m);
    expect(spy).toHaveBeenCalled();
    expect(result.content).toBe('hello world');
    spy.mockRestore();
  });

  it('should log and pass through responses', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = { content: 'response text' };
    const result = await loggerPlugin.onResponse!(res, async (r) => r);
    expect(spy).toHaveBeenCalled();
    expect(result.content).toBe('response text');
    spy.mockRestore();
  });
});

describe('rateLimiterPlugin', () => {
  it('should allow messages under limit', async () => {
    const plugin = createRateLimiterPlugin(5);
    const msg = { content: 'test', id: 'session-1' };
    for (let i = 0; i < 5; i++) {
      await plugin.onMessage!(msg, async (m) => m);
    }
  });

  it('should reject messages over limit', async () => {
    const plugin = createRateLimiterPlugin(2);
    const msg = { content: 'test', id: 'session-rl' };
    await plugin.onMessage!(msg, async (m) => m);
    await plugin.onMessage!(msg, async (m) => m);
    await expect(plugin.onMessage!(msg, async (m) => m)).rejects.toThrow('Rate limit exceeded');
  });
});

describe('contentFilterPlugin', () => {
  it('should pass clean messages', async () => {
    const plugin = createContentFilterPlugin(['spam', 'abuse']);
    const result = await plugin.onMessage!({ content: 'hello' }, async (m) => m);
    expect(result.content).toBe('hello');
  });

  it('should block messages with blocked words', async () => {
    const plugin = createContentFilterPlugin(['spam']);
    await expect(
      plugin.onMessage!({ content: 'this is spam' }, async (m) => m)
    ).rejects.toThrow('Content blocked');
  });
});

// ── AgentCardRegistry Tests ─────────────────────────────────

describe('AgentCardRegistry', () => {
  let registry: AgentCardRegistry;

  beforeEach(() => {
    registry = new AgentCardRegistry();
  });

  it('should register and list agent cards', () => {
    registry.register({ name: 'bot', description: 'A bot', capabilities: ['chat'] });
    expect(registry.list()).toHaveLength(1);
  });

  it('should unregister agent cards', () => {
    registry.register({ name: 'tmp', description: 'Temp', capabilities: [] });
    registry.unregister('tmp');
    expect(registry.list()).toHaveLength(0);
  });

  it('should get agent by name', () => {
    registry.register({ name: 'a1', description: 'Agent 1', capabilities: [] });
    expect(registry.get('a1')?.name).toBe('a1');
    expect(registry.get('missing')).toBeUndefined();
  });

  it('should find by name', () => {
    registry.register({ name: 'search-bot', description: 'Searches', capabilities: ['search'] });
    registry.register({ name: 'chat-bot', description: 'Chats', capabilities: ['chat'] });
    expect(registry.find('search')).toHaveLength(1);
    expect(registry.find('search')[0].name).toBe('search-bot');
  });

  it('should find by capability', () => {
    registry.register({ name: 'translator', description: 'Translates', capabilities: ['translate', 'detect-lang'] });
    const found = registry.find('translate');
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe('translator');
  });

  it('should find by description', () => {
    registry.register({ name: 'x', description: 'Summarizes documents', capabilities: [] });
    expect(registry.find('summarize')).toHaveLength(1);
  });

  it('should send to local handler', async () => {
    registry.register({
      name: 'echo',
      description: 'Echo agent',
      capabilities: ['echo'],
      handler: async (msg) => `echo: ${msg}`,
    });
    const result = await registry.send('echo', 'hello');
    expect(result).toBe('echo: hello');
  });

  it('should throw when sending to unknown agent', async () => {
    await expect(registry.send('ghost', 'hi')).rejects.toThrow("Agent 'ghost' not found");
  });

  it('should throw when agent has no handler or endpoint', async () => {
    registry.register({ name: 'empty', description: 'No handler', capabilities: [] });
    await expect(registry.send('empty', 'hi')).rejects.toThrow('has no handler or endpoint');
  });
});
