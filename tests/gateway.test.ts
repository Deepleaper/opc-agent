import { describe, it, expect, beforeEach } from 'vitest';
import { Gateway } from '../src/core/gateway';

describe('Gateway', () => {
  let gw: Gateway;

  beforeEach(() => {
    gw = new Gateway({
      port: 3000,
      agents: [{ id: 'agent-1', name: 'Test Agent' }],
      channels: [{ id: 'ch-1', type: 'web' }],
    });
  });

  it('should start and stop', async () => {
    await gw.start();
    expect(gw.getStatus().agents).toBe(1);
    await gw.stop();
  });

  it('should throw on double start', async () => {
    await gw.start();
    await expect(gw.start()).rejects.toThrow('already running');
    await gw.stop();
  });

  it('should route messages', async () => {
    await gw.start();
    const agentId = await gw.routeMessage({ id: '1', content: 'hi', channel: 'web', timestamp: Date.now() }, 'web');
    expect(agentId).toBe('agent-1');
    await gw.stop();
  });

  it('should add and remove agents', async () => {
    gw.addAgent({ id: 'agent-2', name: 'Agent 2' });
    expect(gw.getStatus().agents).toBe(2);
    gw.removeAgent('agent-2');
    expect(gw.getStatus().agents).toBe(1);
  });

  it('should throw removing unknown agent', () => {
    expect(() => gw.removeAgent('unknown')).toThrow('not found');
  });

  it('should track status', async () => {
    await gw.start();
    const status = gw.getStatus();
    expect(status.agents).toBe(1);
    expect(status.channels).toBe(1);
    expect(status.messagesProcessed).toBe(0);
    expect(status.uptime).toBeGreaterThanOrEqual(0);
    await gw.stop();
  });

  it('should report metrics', async () => {
    await gw.start();
    await gw.routeMessage({ id: '1', content: 'test', channel: 'web', timestamp: Date.now() }, 'web');
    const metrics = gw.getMetrics();
    expect(metrics.messagesPerMinute).toBeGreaterThan(0);
    expect(metrics.errorRate).toBe(0);
    await gw.stop();
  });
});
