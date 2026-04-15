import { describe, it, expect } from 'vitest';
import { PluginManager } from '../src/plugins';
import type { IPlugin } from '../src/plugins';

describe('Plugin System', () => {
  it('should register and list plugins', () => {
    const pm = new PluginManager();
    const plugin: IPlugin = { name: 'test-plugin', version: '1.0.0', description: 'Test' };
    pm.register(plugin);
    expect(pm.has('test-plugin')).toBe(true);
    expect(pm.list().length).toBe(1);
    expect(pm.list()[0].name).toBe('test-plugin');
  });

  it('should run lifecycle hooks', async () => {
    const pm = new PluginManager();
    const calls: string[] = [];

    pm.register({
      name: 'hook-plugin',
      version: '1.0.0',
      hooks: {
        beforeInit: async () => { calls.push('beforeInit'); },
        afterInit: async () => { calls.push('afterInit'); },
        beforeShutdown: async () => { calls.push('beforeShutdown'); },
      },
    });

    await pm.runHook('beforeInit');
    await pm.runHook('afterInit');
    await pm.runHook('beforeShutdown');
    expect(calls).toEqual(['beforeInit', 'afterInit', 'beforeShutdown']);
  });

  it('should collect skills from plugins', () => {
    const pm = new PluginManager();
    pm.register({
      name: 'skill-plugin',
      version: '1.0.0',
      skills: [{
        name: 'test-skill',
        description: 'Test',
        execute: async () => ({ handled: false, confidence: 0 }),
      }],
    });

    expect(pm.getAllSkills().length).toBe(1);
    expect(pm.getAllSkills()[0].name).toBe('test-skill');
  });

  it('should unregister plugins', () => {
    const pm = new PluginManager();
    pm.register({ name: 'temp', version: '1.0.0' });
    pm.unregister('temp');
    expect(pm.has('temp')).toBe(false);
  });

  it('should run hooks from multiple plugins in order', async () => {
    const pm = new PluginManager();
    const order: string[] = [];

    pm.register({
      name: 'p1', version: '1.0.0',
      hooks: { beforeInit: async () => { order.push('p1'); } },
    });
    pm.register({
      name: 'p2', version: '1.0.0',
      hooks: { beforeInit: async () => { order.push('p2'); } },
    });

    await pm.runHook('beforeInit');
    expect(order).toEqual(['p1', 'p2']);
  });
});
