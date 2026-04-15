import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowEngine, WorkflowDefinition } from '../src/core/workflow';
import { BaseSkill } from '../src/skills/base';
import type { AgentContext, Message, SkillResult, MemoryStore } from '../src/core/types';

class EchoSkill extends BaseSkill {
  name = 'echo';
  description = 'Echo input';
  async execute(_ctx: AgentContext, msg: Message): Promise<SkillResult> {
    return this.match(`echo:${msg.content}`, 1.0);
  }
}

class UpperSkill extends BaseSkill {
  name = 'upper';
  description = 'Uppercase';
  async execute(_ctx: AgentContext, msg: Message): Promise<SkillResult> {
    return this.match(msg.content.toUpperCase(), 1.0);
  }
}

class FailSkill extends BaseSkill {
  name = 'fail';
  description = 'Always fails';
  async execute(): Promise<SkillResult> {
    throw new Error('intentional failure');
  }
}

const mockMemory: MemoryStore = {
  get: async () => null,
  set: async () => {},
  getConversation: async () => [],
  addMessage: async () => {},
  clear: async () => {},
};

const mockContext: AgentContext = {
  agentName: 'test',
  sessionId: 'test-session',
  messages: [],
  memory: mockMemory,
  metadata: {},
};

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
    engine.registerSkill(new EchoSkill());
    engine.registerSkill(new UpperSkill());
    engine.registerSkill(new FailSkill());
  });

  it('should register and list workflows', () => {
    const wf: WorkflowDefinition = { name: 'test', steps: [] };
    engine.registerWorkflow(wf);
    expect(engine.listWorkflows()).toHaveLength(1);
    expect(engine.getWorkflow('test')).toBeDefined();
  });

  it('should run sequential steps', async () => {
    const wf: WorkflowDefinition = {
      name: 'seq',
      steps: [
        { id: 's1', type: 'skill', name: 'echo' },
        { id: 's2', type: 'skill', name: 'upper' },
      ],
    };
    engine.registerWorkflow(wf);
    const result = await engine.run('seq', mockContext, 'hello');
    expect(result.status).toBe('completed');
    expect(result.steps).toHaveLength(2);
  });

  it('should handle parallel steps', async () => {
    const wf: WorkflowDefinition = {
      name: 'par',
      steps: [{
        id: 'p1', type: 'parallel', name: 'parallel',
        parallel: [
          { id: 's1', type: 'skill', name: 'echo' },
          { id: 's2', type: 'skill', name: 'upper' },
        ],
      }],
    };
    engine.registerWorkflow(wf);
    const result = await engine.run('par', mockContext, 'test');
    expect(result.status).toBe('completed');
  });

  it('should handle conditional branching', async () => {
    const wf: WorkflowDefinition = {
      name: 'cond',
      steps: [{
        id: 'c1', type: 'condition', name: 'check',
        condition: 'contains:hello',
        branches: {
          if: [{ id: 's1', type: 'skill', name: 'echo' }],
          else: [{ id: 's2', type: 'skill', name: 'upper' }],
        },
      }],
    };
    engine.registerWorkflow(wf);
    const r1 = await engine.run('cond', mockContext, 'hello world');
    expect(r1.steps.find(s => s.stepId === 's1')).toBeDefined();
  });

  it('should handle step failures with stop policy', async () => {
    const wf: WorkflowDefinition = {
      name: 'fail-wf',
      onError: 'stop',
      steps: [
        { id: 's1', type: 'skill', name: 'fail' },
        { id: 's2', type: 'skill', name: 'echo' },
      ],
    };
    engine.registerWorkflow(wf);
    const result = await engine.run('fail-wf', mockContext, 'test');
    expect(result.status).toBe('failed');
  });

  it('should retry failed steps', async () => {
    const wf: WorkflowDefinition = {
      name: 'retry-wf',
      steps: [{ id: 's1', type: 'skill', name: 'fail', retries: 2 }],
    };
    engine.registerWorkflow(wf);
    const result = await engine.run('retry-wf', mockContext, 'test');
    expect(result.steps[0].status).toBe('error');
  });

  it('should throw on unknown workflow', async () => {
    await expect(engine.run('nonexistent', mockContext)).rejects.toThrow();
  });

  it('should unregister workflows', () => {
    engine.registerWorkflow({ name: 'temp', steps: [] });
    engine.unregisterWorkflow('temp');
    expect(engine.getWorkflow('temp')).toBeUndefined();
  });
});
