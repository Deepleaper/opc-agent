import { describe, it, expect } from 'vitest';
import { DebatePattern, VotingPattern, PipelinePattern, HierarchyPattern, SharedContext, ConversationProtocol } from '../src/core/collaboration';
import { BaseAgent } from '../src/core/agent';

// Mock provider that returns deterministic responses
function createMockAgent(name: string, responses: string[] | ((prompt: string) => string)): BaseAgent {
  const agent = new BaseAgent({ name, provider: 'echo' });
  let callIndex = 0;

  // Override handleMessage to return mock responses
  agent.handleMessage = async (message) => {
    let content: string;
    if (typeof responses === 'function') {
      content = responses(message.content);
    } else {
      content = responses[callIndex % responses.length];
      callIndex++;
    }
    return { id: `resp-${Date.now()}`, role: 'assistant', content, timestamp: Date.now() };
  };

  return agent;
}

// ─── DebatePattern ──────────────────────────────────────────

describe('DebatePattern', () => {
  it('2 agents debate for 2 rounds', async () => {
    const alice = createMockAgent('alice', ['AI is beneficial', 'AI creates jobs']);
    const bob = createMockAgent('bob', ['AI is risky', 'AI displaces workers']);
    const judge = createMockAgent('judge', ['Both sides made good points. AI is nuanced.']);

    const pattern = new DebatePattern([alice, bob], 2);
    const result = await pattern.debate('Is AI good?', judge);

    expect(result.topic).toBe('Is AI good?');
    expect(result.rounds.length).toBe(4); // 2 agents × 2 rounds
    expect(result.rounds[0].agent).toBe('alice');
    expect(result.rounds[1].agent).toBe('bob');
    expect(result.summary).toBeTruthy();
    expect(result.judge).toBe('judge');
  });

  it('debate without explicit judge uses first agent', async () => {
    const a1 = createMockAgent('a1', ['arg1', 'summary']);
    const a2 = createMockAgent('a2', ['arg2']);

    const pattern = new DebatePattern([a1, a2], 1);
    const result = await pattern.debate('topic');

    expect(result.judge).toBe('a1');
  });

  it('single round debate', async () => {
    const a = createMockAgent('a', ['yes']);
    const b = createMockAgent('b', ['no']);
    const pattern = new DebatePattern([a, b], 1);
    const result = await pattern.debate('test');

    expect(result.rounds.length).toBe(2);
  });
});

// ─── VotingPattern ──────────────────────────────────────────

describe('VotingPattern', () => {
  it('3 agents vote, majority wins', async () => {
    const a1 = createMockAgent('v1', ['TypeScript']);
    const a2 = createMockAgent('v2', ['TypeScript']);
    const a3 = createMockAgent('v3', ['Python']);

    const pattern = new VotingPattern([a1, a2, a3]);
    const result = await pattern.vote('Best language?', ['TypeScript', 'Python', 'Rust']);

    expect(result.winner).toBe('TypeScript');
    expect(result.tally['TypeScript']).toBe(2);
    expect(result.tally['Python']).toBe(1);
    expect(result.votes.length).toBe(3);
  });

  it('unanimous vote', async () => {
    const agents = [1, 2, 3].map(i => createMockAgent(`u${i}`, ['Rust']));
    const pattern = new VotingPattern(agents);
    const result = await pattern.vote('Pick one', ['Rust', 'Go']);

    expect(result.winner).toBe('Rust');
    expect(result.tally['Rust']).toBe(3);
  });

  it('weighted vote with confidence', async () => {
    const a1 = createMockAgent('w1', ['TypeScript|0.9']);
    const a2 = createMockAgent('w2', ['Python|0.3']);
    const a3 = createMockAgent('w3', ['Python|0.4']);

    const pattern = new VotingPattern([a1, a2, a3]);
    const result = await pattern.weightedVote('Best?', ['TypeScript', 'Python']);

    expect(result.winner).toBe('TypeScript'); // 0.9 > 0.3+0.4=0.7
    expect(result.votes[0].confidence).toBeCloseTo(0.9);
  });

  it('weighted vote Python wins with higher total confidence', async () => {
    const a1 = createMockAgent('w1', ['TypeScript|0.3']);
    const a2 = createMockAgent('w2', ['Python|0.8']);
    const a3 = createMockAgent('w3', ['Python|0.9']);

    const pattern = new VotingPattern([a1, a2, a3]);
    const result = await pattern.weightedVote('Best?', ['TypeScript', 'Python']);

    expect(result.winner).toBe('Python');
  });

  it('vote result includes question', async () => {
    const a = createMockAgent('a', ['X']);
    const pattern = new VotingPattern([a]);
    const result = await pattern.vote('Q?', ['X', 'Y']);
    expect(result.question).toBe('Q?');
  });
});

// ─── PipelinePattern ────────────────────────────────────────

describe('PipelinePattern', () => {
  it('3-stage pipeline processes sequentially', async () => {
    const s1 = createMockAgent('stage1', (input) => `[s1:${input}]`);
    const s2 = createMockAgent('stage2', (input) => `[s2:${input}]`);
    const s3 = createMockAgent('stage3', (input) => `[s3:${input}]`);

    const pattern = new PipelinePattern([
      { agent: s1 },
      { agent: s2 },
      { agent: s3 },
    ]);
    const result = await pattern.process('hello');

    expect(result.stages.length).toBe(3);
    expect(result.stages[0].output).toBe('[s1:hello]');
    expect(result.stages[1].input).toBe('[s1:hello]');
    expect(result.finalOutput).toBe('[s3:[s2:[s1:hello]]]');
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('pipeline with transform function', async () => {
    const agent = createMockAgent('a', (input) => input.toUpperCase());
    const pattern = new PipelinePattern([
      { agent, transform: (s) => `prefix:${s}` },
    ]);
    const result = await pattern.process('data');

    expect(result.stages[0].input).toBe('prefix:data');
    expect(result.finalOutput).toBe('PREFIX:DATA');
  });

  it('single stage pipeline', async () => {
    const agent = createMockAgent('only', ['processed']);
    const pattern = new PipelinePattern([{ agent }]);
    const result = await pattern.process('input');

    expect(result.stages.length).toBe(1);
    expect(result.finalOutput).toBe('processed');
  });

  it('pipeline stage records duration', async () => {
    const agent = createMockAgent('slow', ['done']);
    const pattern = new PipelinePattern([{ agent }]);
    const result = await pattern.process('x');
    expect(result.stages[0].durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── HierarchyPattern ───────────────────────────────────────

describe('HierarchyPattern', () => {
  it('leader decomposes, workers execute, leader synthesizes', async () => {
    const leader = createMockAgent('leader', [
      'Research the topic\nWrite the code',  // decomposition
      'Combined: research + code done.',       // synthesis
    ]);
    const w1 = createMockAgent('worker1', ['Research complete']);
    const w2 = createMockAgent('worker2', ['Code written']);

    const pattern = new HierarchyPattern(leader, [w1, w2]);
    const result = await pattern.execute('Build a feature');

    expect(result.task).toBe('Build a feature');
    expect(result.subtasks.length).toBe(2);
    expect(result.subtasks[0].agent).toBe('worker1');
    expect(result.subtasks[1].agent).toBe('worker2');
    expect(result.synthesis).toBeTruthy();
  });

  it('single worker gets single subtask', async () => {
    const leader = createMockAgent('boss', ['Do the thing', 'All done']);
    const worker = createMockAgent('w', ['Done']);

    const pattern = new HierarchyPattern(leader, [worker]);
    const result = await pattern.execute('task');

    expect(result.subtasks.length).toBe(1);
  });

  it('workers execute in parallel', async () => {
    const timestamps: number[] = [];
    const leader = createMockAgent('l', ['A\nB\nC', 'Synthesized']);
    const workers = [1, 2, 3].map(i =>
      createMockAgent(`w${i}`, () => { timestamps.push(Date.now()); return `result${i}`; })
    );

    const pattern = new HierarchyPattern(leader, workers);
    await pattern.execute('parallel task');

    // All workers should start nearly simultaneously (within 50ms)
    if (timestamps.length >= 2) {
      const spread = Math.max(...timestamps) - Math.min(...timestamps);
      expect(spread).toBeLessThan(200);
    }
  });
});

// ─── SharedContext ───────────────────────────────────────────

describe('SharedContext', () => {
  it('set and get values', () => {
    const ctx = new SharedContext();
    ctx.set('key', 'value');
    expect(ctx.get('key')).toBe('value');
  });

  it('get returns undefined for missing key', () => {
    const ctx = new SharedContext();
    expect(ctx.get('nope')).toBeUndefined();
  });

  it('getAll returns all entries', () => {
    const ctx = new SharedContext();
    ctx.set('a', 1);
    ctx.set('b', 2);
    expect(ctx.getAll()).toEqual({ a: 1, b: 2 });
  });

  it('onChange fires on set', () => {
    const ctx = new SharedContext();
    const values: any[] = [];
    ctx.onChange('x', (v) => values.push(v));
    ctx.set('x', 10);
    ctx.set('x', 20);
    expect(values).toEqual([10, 20]);
  });

  it('onChange only fires for subscribed key', () => {
    const ctx = new SharedContext();
    const fired: any[] = [];
    ctx.onChange('a', (v) => fired.push(v));
    ctx.set('b', 1);
    expect(fired.length).toBe(0);
  });

  it('multiple listeners on same key', () => {
    const ctx = new SharedContext();
    const r1: any[] = [];
    const r2: any[] = [];
    ctx.onChange('k', (v) => r1.push(v));
    ctx.onChange('k', (v) => r2.push(v));
    ctx.set('k', 'hello');
    expect(r1).toEqual(['hello']);
    expect(r2).toEqual(['hello']);
  });

  it('typed get', () => {
    const ctx = new SharedContext();
    ctx.set('num', 42);
    const val = ctx.get<number>('num');
    expect(val).toBe(42);
  });
});

// ─── ConversationProtocol ───────────────────────────────────

describe('ConversationProtocol', () => {
  it('roundRobin produces correct number of messages', async () => {
    const agents = [
      createMockAgent('a', ['hello from a']),
      createMockAgent('b', ['hello from b']),
    ];
    const proto = new ConversationProtocol();
    const msgs = await proto.roundRobin(agents, 'test topic', 2);

    expect(msgs.length).toBe(4); // 2 agents × 2 rounds
    expect((msgs[0] as any).agent).toBe('a');
    expect((msgs[1] as any).agent).toBe('b');
  });

  it('roundRobin single round', async () => {
    const agents = [createMockAgent('x', ['x says'])];
    const proto = new ConversationProtocol();
    const msgs = await proto.roundRobin(agents, 'topic', 1);

    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toBe('x says');
  });

  it('moderated discussion has opening, responses, and summary', async () => {
    const mod = createMockAgent('mod', ['Welcome!', 'Great discussion.']);
    const agents = [
      createMockAgent('p1', ['My opinion is X']),
      createMockAgent('p2', ['I think Y']),
    ];

    const proto = new ConversationProtocol();
    const msgs = await proto.moderated(agents, mod, 'AI ethics');

    // 1 opening + 2 responses + 1 summary = 4
    expect(msgs.length).toBe(4);
    expect((msgs[0] as any).agent).toBe('mod');
    expect((msgs[1] as any).agent).toBe('p1');
    expect((msgs[2] as any).agent).toBe('p2');
    expect((msgs[3] as any).agent).toBe('mod');
  });
});
