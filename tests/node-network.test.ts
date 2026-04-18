import { describe, it, expect, beforeEach } from 'vitest';
import { NodeNetwork } from '../src/core/node-network';

describe('NodeNetwork', () => {
  let network: NodeNetwork;

  beforeEach(() => { network = new NodeNetwork(); });

  it('should add a node', () => {
    const node = network.addNode({ name: 'pi-1', type: 'pi', host: '192.168.1.10' });
    expect(node.id).toBeTruthy();
    expect(node.name).toBe('pi-1');
    expect(network.listNodes().length).toBe(1);
  });

  it('should remove a node', () => {
    const node = network.addNode({ name: 'test' });
    network.removeNode(node.id);
    expect(network.listNodes().length).toBe(0);
  });

  it('should throw on removing unknown node', () => {
    expect(() => network.removeNode('unknown')).toThrow('not found');
  });

  it('should get node by id', () => {
    const node = network.addNode({ name: 'desktop-1' });
    expect(network.getNode(node.id)?.name).toBe('desktop-1');
    expect(network.getNode('nonexistent')).toBeNull();
  });

  it('should pair a node', async () => {
    const node = network.addNode({ name: 'phone', type: 'phone', status: 'pairing' });
    const result = await network.pair(node.id, 'ABC123');
    expect(result).toBe(true);
    expect(network.getNode(node.id)?.status).toBe('online');
  });

  it('should fail pairing with short code', async () => {
    const node = network.addNode({ name: 'phone', status: 'pairing' });
    const result = await network.pair(node.id, 'ab');
    expect(result).toBe(false);
  });

  it('should send command to online node', async () => {
    const node = network.addNode({ name: 'vps', status: 'online' });
    const result = await network.sendCommand(node.id, 'uptime');
    expect(result.command).toBe('uptime');
    expect(result.status).toBe('sent');
  });

  it('should throw sending to offline node', async () => {
    const node = network.addNode({ name: 'offline', status: 'offline' });
    await expect(network.sendCommand(node.id, 'test')).rejects.toThrow('offline');
  });

  it('should broadcast to online nodes', async () => {
    network.addNode({ name: 'n1', status: 'online' });
    network.addNode({ name: 'n2', status: 'online' });
    network.addNode({ name: 'n3', status: 'offline' });
    const results = await network.broadcast('ping');
    expect(results.size).toBe(2);
  });

  it('should health check all nodes', async () => {
    network.addNode({ name: 'up', status: 'online' });
    network.addNode({ name: 'down', status: 'offline' });
    const health = await network.healthCheck();
    expect(health.size).toBe(2);
    const vals = Array.from(health.values());
    expect(vals).toContain(true);
    expect(vals).toContain(false);
  });
});
