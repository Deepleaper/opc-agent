import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '../src/core/agent';
import type { Message } from '../src/core/types';

// Mock LLM provider
const mockProvider = {
  chat: vi.fn().mockResolvedValue('Hello from LLM'),
  chatStream: vi.fn(),
  listModels: vi.fn(),
};

vi.mock('../src/providers', () => ({
  createProvider: () => mockProvider,
}));

function createAgent(opts?: any) {
  return new BaseAgent({
    name: 'test-agent',
    systemPrompt: 'You are a test agent.',
    ...opts,
  });
}

function createMessage(content: string): Message {
  return {
    id: `msg_${Date.now()}`,
    role: 'user',
    content,
    timestamp: Date.now(),
  };
}

describe('BaseAgent long-term memory', () => {
  let agent: BaseAgent;
  let mockBrain: any;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = createAgent();
    mockBrain = {
      recall: vi.fn().mockResolvedValue([{ content: 'remembered fact' }]),
      learn: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('setLongTermMemory sets the brain', () => {
    agent.setLongTermMemory(mockBrain);
    expect(agent.getLongTermMemory()).toBe(mockBrain);
  });

  it('setLongTermMemory with config sets autoLearn/autoRecall', () => {
    agent.setLongTermMemory(mockBrain, { autoLearn: false, autoRecall: true });
    const config = agent.getLongTermMemoryConfig();
    expect(config.autoLearn).toBe(false);
    expect(config.autoRecall).toBe(true);
  });

  it('handleMessage calls recall before LLM when autoRecall is true', async () => {
    agent.setLongTermMemory(mockBrain);
    const callOrder: string[] = [];
    mockBrain.recall.mockImplementation(async () => {
      callOrder.push('recall');
      return [{ content: 'memory' }];
    });
    mockProvider.chat.mockImplementation(async () => {
      callOrder.push('llm');
      return 'response';
    });

    await agent.init();
    await agent.handleMessage(createMessage('hello'));

    expect(callOrder[0]).toBe('recall');
    expect(callOrder[1]).toBe('llm');
    expect(mockBrain.recall).toHaveBeenCalledWith('hello');
  });

  it('handleMessage calls learn after LLM when autoLearn is true', async () => {
    agent.setLongTermMemory(mockBrain);
    const callOrder: string[] = [];
    mockProvider.chat.mockImplementation(async () => {
      callOrder.push('llm');
      return 'response';
    });
    mockBrain.learn.mockImplementation(async () => {
      callOrder.push('learn');
    });

    await agent.init();
    await agent.handleMessage(createMessage('hello'));

    expect(callOrder.indexOf('llm')).toBeLessThan(callOrder.indexOf('learn'));
    expect(mockBrain.learn).toHaveBeenCalled();
  });

  it('recall failure does not crash handleMessage', async () => {
    mockBrain.recall.mockRejectedValue(new Error('DB down'));
    agent.setLongTermMemory(mockBrain);

    await agent.init();
    const response = await agent.handleMessage(createMessage('hello'));
    expect(response.content).toBeDefined();
  });

  it('learn failure does not crash handleMessage', async () => {
    mockBrain.learn.mockRejectedValue(new Error('DB down'));
    agent.setLongTermMemory(mockBrain);

    await agent.init();
    const response = await agent.handleMessage(createMessage('hello'));
    expect(response.content).toBeDefined();
  });

  it('does not recall when autoRecall is false', async () => {
    agent.setLongTermMemory(mockBrain, { autoRecall: false, autoLearn: true });

    await agent.init();
    await agent.handleMessage(createMessage('hello'));

    expect(mockBrain.recall).not.toHaveBeenCalled();
  });

  it('does not learn when autoLearn is false', async () => {
    agent.setLongTermMemory(mockBrain, { autoRecall: true, autoLearn: false });

    await agent.init();
    await agent.handleMessage(createMessage('hello'));

    expect(mockBrain.learn).not.toHaveBeenCalled();
  });

  it('injects memory context into LLM prompt', async () => {
    mockBrain.recall.mockResolvedValue([{ content: 'user likes cats' }]);
    agent.setLongTermMemory(mockBrain);

    await agent.init();
    await agent.handleMessage(createMessage('hello'));

    const systemPromptArg = mockProvider.chat.mock.calls[0][1];
    expect(systemPromptArg).toContain('[Relevant memories]');
    expect(systemPromptArg).toContain('user likes cats');
  });

  it('handles empty recall array gracefully', async () => {
    mockBrain.recall.mockResolvedValue([]);
    agent.setLongTermMemory(mockBrain);

    await agent.init();
    await agent.handleMessage(createMessage('hello'));

    const systemPromptArg = mockProvider.chat.mock.calls[0][1];
    expect(systemPromptArg).not.toContain('[Relevant memories]');
  });

  it('handles string recall results', async () => {
    mockBrain.recall.mockResolvedValue('a single memory string');
    agent.setLongTermMemory(mockBrain);

    await agent.init();
    await agent.handleMessage(createMessage('hello'));

    const systemPromptArg = mockProvider.chat.mock.calls[0][1];
    expect(systemPromptArg).toContain('a single memory string');
  });

  it('learn includes user and assistant content', async () => {
    mockProvider.chat.mockResolvedValue('I am fine');
    agent.setLongTermMemory(mockBrain);

    await agent.init();
    await agent.handleMessage(createMessage('how are you'));

    const learnArg = mockBrain.learn.mock.calls[0][0];
    expect(learnArg).toContain('User: how are you');
    expect(learnArg).toContain('Assistant: I am fine');
  });

  it('no long-term memory means no recall/learn calls', async () => {
    // No setLongTermMemory called
    await agent.init();
    await agent.handleMessage(createMessage('hello'));

    // Should work fine without any brain
    expect(mockBrain.recall).not.toHaveBeenCalled();
    expect(mockBrain.learn).not.toHaveBeenCalled();
  });

  it('getLongTermMemory returns undefined when not set', () => {
    expect(agent.getLongTermMemory()).toBeUndefined();
  });

  it('default config has autoLearn and autoRecall true', () => {
    const config = agent.getLongTermMemoryConfig();
    expect(config.autoLearn).toBe(true);
    expect(config.autoRecall).toBe(true);
  });

  it('recall with compiled_truth format', async () => {
    mockBrain.recall.mockResolvedValue([{ compiled_truth: 'agent is helpful' }]);
    agent.setLongTermMemory(mockBrain);

    await agent.init();
    await agent.handleMessage(createMessage('hello'));

    const systemPromptArg = mockProvider.chat.mock.calls[0][1];
    expect(systemPromptArg).toContain('agent is helpful');
  });
});

describe('OAD LongTerm memory schema', () => {
  it('accepts deepbrain config with new fields', async () => {
    const { LongTermMemorySchema } = await import('../src/schema/oad');
    const result = LongTermMemorySchema.parse({
      provider: 'deepbrain',
      collection: 'test',
      config: {
        database: './data/brain.db',
        embeddingProvider: 'ollama',
        autoLearn: true,
        autoRecall: true,
        evolveInterval: 3600000,
      },
    });
    expect(result.provider).toBe('deepbrain');
    expect(result.config?.database).toBe('./data/brain.db');
    expect(result.config?.evolveInterval).toBe(3600000);
  });

  it('accepts minimal config', async () => {
    const { LongTermMemorySchema } = await import('../src/schema/oad');
    const result = LongTermMemorySchema.parse({ provider: 'deepbrain' });
    expect(result.provider).toBe('deepbrain');
  });
});
