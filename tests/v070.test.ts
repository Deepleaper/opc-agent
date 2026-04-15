import { describe, it, expect } from 'vitest';
import { createAuthMiddleware, getActiveSessions } from '../src/core/auth';
import { HttpSkill } from '../src/skills/http';
import { WebhookTriggerSkill } from '../src/skills/webhook-trigger';
import { SchedulerSkill } from '../src/skills/scheduler';
import type { AgentContext, Message } from '../src/core/types';

const mockContext: AgentContext = {
  agentName: 'test',
  sessionId: 'test-session',
  messages: [],
  memory: { get: async () => null, set: async () => {}, getConversation: async () => [], addMessage: async () => {}, clear: async () => {} },
  metadata: {},
};

function msg(content: string): Message {
  return { id: '1', role: 'user', content, timestamp: Date.now() };
}

describe('Auth', () => {
  it('should create middleware', () => {
    const mw = createAuthMiddleware({ apiKeys: ['test-key'] });
    expect(typeof mw).toBe('function');
  });

  it('should track sessions', () => {
    const sessions = getActiveSessions();
    expect(Array.isArray(sessions)).toBe(true);
  });
});

describe('HttpSkill', () => {
  it('should not match non-http messages', async () => {
    const skill = new HttpSkill();
    const result = await skill.execute(mockContext, msg('hello'));
    expect(result.handled).toBe(false);
  });
});

describe('WebhookTriggerSkill', () => {
  it('should report unknown webhook', async () => {
    const skill = new WebhookTriggerSkill();
    const result = await skill.execute(mockContext, msg('webhook test'));
    expect(result.handled).toBe(true);
    expect(result.response).toContain('Unknown webhook');
  });

  it('should register targets', () => {
    const skill = new WebhookTriggerSkill();
    skill.registerTarget({ name: 'slack', url: 'https://hooks.slack.com/test' });
    expect(skill).toBeDefined();
  });
});

describe('SchedulerSkill', () => {
  it('should list empty tasks', async () => {
    const skill = new SchedulerSkill();
    const result = await skill.execute(mockContext, msg('schedule list'));
    expect(result.handled).toBe(true);
    expect(result.response).toContain('No scheduled tasks');
  });

  it('should add a task', async () => {
    const skill = new SchedulerSkill();
    const result = await skill.execute(mockContext, msg('schedule add backup "every 5m" run backup'));
    expect(result.handled).toBe(true);
    expect(result.response).toContain('Task scheduled');
    skill.destroy();
  });

  it('should not match unrelated messages', async () => {
    const skill = new SchedulerSkill();
    const result = await skill.execute(mockContext, msg('hello'));
    expect(result.handled).toBe(false);
  });
});
