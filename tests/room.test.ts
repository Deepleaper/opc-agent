import { describe, it, expect } from 'vitest';
import { Room } from '../src/core/room';
import { BaseAgent } from '../src/core/agent';

function makeAgent(name: string): BaseAgent {
  const agent = new BaseAgent({ name });
  // Synchronously set to ready by calling init
  return agent;
}

describe('Room System', () => {
  it('should create a room with a name', () => {
    const room = new Room('test-room');
    expect(room.name).toBe('test-room');
    expect(room.getAgents()).toEqual([]);
  });

  it('should add and remove agents', () => {
    const room = new Room('office');
    const agent = makeAgent('agent-1');
    room.addAgent(agent);
    expect(room.getAgents()).toEqual(['agent-1']);
    room.removeAgent('agent-1');
    expect(room.getAgents()).toEqual([]);
  });

  it('should emit events on join/leave', () => {
    const room = new Room('office');
    const events: string[] = [];
    room.on('agent:join', (name) => events.push(`join:${name}`));
    room.on('agent:leave', (name) => events.push(`leave:${name}`));

    const agent = makeAgent('a1');
    room.addAgent(agent);
    room.removeAgent('a1');
    expect(events).toEqual(['join:a1', 'leave:a1']);
  });

  it('should support topic subscriptions', () => {
    const room = new Room('office');
    room.subscribe('agent-1', 'alerts');
    room.subscribe('agent-2', 'alerts');
    expect(room.getSubscribers('alerts')).toEqual(['agent-1', 'agent-2']);
    room.unsubscribe('agent-1', 'alerts');
    expect(room.getSubscribers('alerts')).toEqual(['agent-2']);
  });

  it('should broadcast to all agents except sender', async () => {
    const room = new Room('office');
    const a1 = makeAgent('a1');
    const a2 = makeAgent('a2');
    await a1.init();
    await a2.init();
    room.addAgent(a1);
    room.addAgent(a2);

    const responses = await room.broadcast('a1', 'Hello everyone');
    expect(responses.length).toBe(1); // only a2 responds
    expect(responses[0].role).toBe('assistant');
  });

  it('should send direct messages', async () => {
    const room = new Room('office');
    const a1 = makeAgent('a1');
    const a2 = makeAgent('a2');
    await a1.init();
    await a2.init();
    room.addAgent(a1);
    room.addAgent(a2);

    const responses = await room.send({
      from: 'a1',
      to: 'a2',
      message: { id: 'm1', role: 'user', content: 'Hi a2', timestamp: Date.now() },
    });
    expect(responses.length).toBe(1);
  });

  it('should publish to topic subscribers only', async () => {
    const room = new Room('office');
    const a1 = makeAgent('a1');
    const a2 = makeAgent('a2');
    const a3 = makeAgent('a3');
    await a1.init();
    await a2.init();
    await a3.init();
    room.addAgent(a1);
    room.addAgent(a2);
    room.addAgent(a3);

    room.subscribe('a2', 'alerts');
    // a3 not subscribed
    const responses = await room.publishToTopic('a1', 'alerts', 'Alert!');
    expect(responses.length).toBe(1);
  });

  it('should remove agent from subscriptions on leave', () => {
    const room = new Room('office');
    room.subscribe('a1', 'topic1');
    room.subscribe('a1', 'topic2');
    expect(room.getSubscribers('topic1')).toContain('a1');
    room.removeAgent('a1');
    expect(room.getSubscribers('topic1')).not.toContain('a1');
    expect(room.getSubscribers('topic2')).not.toContain('a1');
  });
});
