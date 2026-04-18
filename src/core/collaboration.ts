/**
 * Multi-agent collaboration patterns
 * @module core/collaboration
 */

import type { BaseAgent } from './agent';
import type { Message } from './types';

// ─── Result Types ───────────────────────────────────────────

export interface DebateArgument {
  agent: string;
  round: number;
  argument: string;
}

export interface DebateResult {
  topic: string;
  rounds: DebateArgument[];
  summary: string;
  judge?: string;
}

export interface VoteEntry {
  agent: string;
  choice: string;
  confidence: number;
}

export interface VoteResult {
  question: string;
  votes: VoteEntry[];
  winner: string;
  tally: Record<string, number>;
}

export interface PipelineStageResult {
  agent: string;
  input: string;
  output: string;
  durationMs: number;
}

export interface PipelineResult {
  stages: PipelineStageResult[];
  finalOutput: string;
  totalDurationMs: number;
}

export interface WorkerResult {
  agent: string;
  subtask: string;
  result: string;
}

export interface HierarchyResult {
  task: string;
  subtasks: WorkerResult[];
  synthesis: string;
}

// ─── Helper ─────────────────────────────────────────────────

function makeMsg(role: 'user' | 'assistant' | 'system', content: string): Message {
  return { id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, content, timestamp: Date.now() };
}

async function agentChat(agent: BaseAgent, prompt: string): Promise<string> {
  const response = await agent.handleMessage(makeMsg('user', prompt));
  return response.content;
}

// ─── DebatePattern ──────────────────────────────────────────

export class DebatePattern {
  constructor(private agents: BaseAgent[], private rounds: number = 3) {}

  async debate(topic: string, judgeAgent?: BaseAgent): Promise<DebateResult> {
    const allArgs: DebateArgument[] = [];
    let context = '';

    for (let round = 1; round <= this.rounds; round++) {
      for (const agent of this.agents) {
        const prompt = round === 1
          ? `Debate topic: "${topic}". Present your argument.`
          : `Debate topic: "${topic}". Previous arguments:\n${context}\nPresent your counter-argument for round ${round}.`;
        const argument = await agentChat(agent, prompt);
        allArgs.push({ agent: agent.name, round, argument });
        context += `\n[${agent.name} round ${round}]: ${argument}`;
      }
    }

    const judge = judgeAgent ?? this.agents[0];
    const summaryPrompt = `You are the judge. Summarize and decide the winner of this debate on "${topic}":\n${context}`;
    const summary = await agentChat(judge, summaryPrompt);

    return { topic, rounds: allArgs, summary, judge: judge.name };
  }
}

// ─── VotingPattern ──────────────────────────────────────────

export class VotingPattern {
  constructor(private agents: BaseAgent[]) {}

  async vote(question: string, options: string[]): Promise<VoteResult> {
    const votes: VoteEntry[] = [];
    const optionList = options.map((o, i) => `${i + 1}. ${o}`).join('\n');

    for (const agent of this.agents) {
      const prompt = `Question: "${question}"\nOptions:\n${optionList}\nRespond with ONLY the exact text of your chosen option.`;
      const raw = await agentChat(agent, prompt);
      const choice = options.find(o => raw.includes(o)) ?? raw.trim();
      votes.push({ agent: agent.name, choice, confidence: 1 });
    }

    return this.tallyVotes(question, votes);
  }

  async weightedVote(question: string, options: string[]): Promise<VoteResult> {
    const votes: VoteEntry[] = [];
    const optionList = options.map((o, i) => `${i + 1}. ${o}`).join('\n');

    for (const agent of this.agents) {
      const prompt = `Question: "${question}"\nOptions:\n${optionList}\nRespond in format: CHOICE|CONFIDENCE(0-1)`;
      const raw = await agentChat(agent, prompt);
      const parts = raw.split('|');
      const choiceRaw = parts[0]?.trim() ?? '';
      const choice = options.find(o => choiceRaw.includes(o)) ?? choiceRaw;
      const confidence = Math.min(1, Math.max(0, parseFloat(parts[1] ?? '0.5') || 0.5));
      votes.push({ agent: agent.name, choice, confidence });
    }

    return this.tallyVotes(question, votes);
  }

  private tallyVotes(question: string, votes: VoteEntry[]): VoteResult {
    const tally: Record<string, number> = {};
    for (const v of votes) {
      tally[v.choice] = (tally[v.choice] ?? 0) + v.confidence;
    }
    const winner = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    return { question, votes, winner, tally };
  }
}

// ─── PipelinePattern ────────────────────────────────────────

export class PipelinePattern {
  constructor(private stages: { agent: BaseAgent; transform?: (input: string) => string }[]) {}

  async process(input: string): Promise<PipelineResult> {
    const stageResults: PipelineStageResult[] = [];
    let current = input;
    const t0 = Date.now();

    for (const stage of this.stages) {
      const stageInput = stage.transform ? stage.transform(current) : current;
      const start = Date.now();
      const output = await agentChat(stage.agent, stageInput);
      stageResults.push({ agent: stage.agent.name, input: stageInput, output, durationMs: Date.now() - start });
      current = output;
    }

    return { stages: stageResults, finalOutput: current, totalDurationMs: Date.now() - t0 };
  }
}

// ─── HierarchyPattern ───────────────────────────────────────

export class HierarchyPattern {
  constructor(private leader: BaseAgent, private workers: BaseAgent[]) {}

  async execute(task: string): Promise<HierarchyResult> {
    // Leader decomposes
    const decomposePrompt = `Decompose this task into ${this.workers.length} subtasks (one per line, no numbering): "${task}"`;
    const decomposition = await agentChat(this.leader, decomposePrompt);
    const subtasks = decomposition.split('\n').map(s => s.trim()).filter(Boolean);

    // Workers execute in parallel
    const workerResults: WorkerResult[] = await Promise.all(
      this.workers.map(async (worker, i) => {
        const subtask = subtasks[i] ?? subtasks[subtasks.length - 1] ?? task;
        const result = await agentChat(worker, `Complete this subtask: "${subtask}"`);
        return { agent: worker.name, subtask, result };
      })
    );

    // Leader synthesizes
    const synthPrompt = `Original task: "${task}"\nSubtask results:\n${workerResults.map(r => `[${r.agent}] ${r.subtask}: ${r.result}`).join('\n')}\nSynthesize a final answer.`;
    const synthesis = await agentChat(this.leader, synthPrompt);

    return { task, subtasks: workerResults, synthesis };
  }
}

// ─── SharedContext ───────────────────────────────────────────

export class SharedContext {
  private store: Map<string, any> = new Map();
  private listeners: Map<string, ((value: any) => void)[]> = new Map();

  set(key: string, value: any): void {
    this.store.set(key, value);
    const cbs = this.listeners.get(key);
    if (cbs) cbs.forEach(cb => cb(value));
  }

  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  getAll(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [k, v] of this.store) result[k] = v;
    return result;
  }

  onChange(key: string, callback: (value: any) => void): void {
    const existing = this.listeners.get(key) ?? [];
    existing.push(callback);
    this.listeners.set(key, existing);
  }
}

// ─── ConversationProtocol ───────────────────────────────────

export class ConversationProtocol {
  async roundRobin(agents: BaseAgent[], topic: string, rounds: number): Promise<Message[]> {
    const messages: Message[] = [];
    let context = `Topic: "${topic}"`;

    for (let round = 0; round < rounds; round++) {
      for (const agent of agents) {
        const prompt = `${context}\n\nIt's your turn to contribute to this discussion. Be concise.`;
        const content = await agentChat(agent, prompt);
        const msg = makeMsg('assistant', content);
        (msg as any).agent = agent.name;
        messages.push(msg);
        context += `\n[${agent.name}]: ${content}`;
      }
    }

    return messages;
  }

  async moderated(agents: BaseAgent[], moderator: BaseAgent, topic: string): Promise<Message[]> {
    const messages: Message[] = [];
    let context = `Topic: "${topic}"`;

    // Moderator opens
    const opening = await agentChat(moderator, `You are moderating a discussion on "${topic}". Introduce the topic and ask the first question.`);
    const openMsg = makeMsg('assistant', opening);
    (openMsg as any).agent = moderator.name;
    messages.push(openMsg);
    context += `\n[Moderator ${moderator.name}]: ${opening}`;

    // Each agent responds
    for (const agent of agents) {
      const content = await agentChat(agent, `${context}\n\nRespond to the moderator's question.`);
      const msg = makeMsg('assistant', content);
      (msg as any).agent = agent.name;
      messages.push(msg);
      context += `\n[${agent.name}]: ${content}`;
    }

    // Moderator summarizes
    const summary = await agentChat(moderator, `${context}\n\nSummarize the discussion and provide closing remarks.`);
    const closeMsg = makeMsg('assistant', summary);
    (closeMsg as any).agent = moderator.name;
    messages.push(closeMsg);

    return messages;
  }
}
