import { BaseAgent } from './agent';
import { InMemoryStore } from '../memory';
import type { Message } from './types';

export interface SubAgentConfig {
  name: string;
  task: string;
  systemPrompt?: string;
  provider?: string;
  model?: string;
  timeout?: number;
  isolated?: boolean;
}

export interface SubAgentResult {
  id: string;
  name: string;
  status: 'completed' | 'failed' | 'timeout';
  result: string;
  duration: number;
}

interface SubAgentEntry {
  agent: BaseAgent;
  status: string;
  name: string;
}

export class SubAgentManager {
  private agents: Map<string, SubAgentEntry> = new Map();

  async spawn(config: SubAgentConfig, parentProvider?: any): Promise<SubAgentResult> {
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timeout = config.timeout ?? 300000;
    const isolated = config.isolated !== false;

    const agent = new BaseAgent({
      name: config.name,
      systemPrompt: config.systemPrompt ?? 'You are a helpful sub-agent.',
      provider: config.provider ?? 'openai',
      model: config.model,
      memory: isolated ? new InMemoryStore() : undefined,
    });

    this.agents.set(id, { agent, status: 'running', name: config.name });

    const message: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: config.task,
      timestamp: Date.now(),
      metadata: { subAgentId: id },
    };

    const start = Date.now();

    try {
      const result = await Promise.race([
        agent.handleMessage(message),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('SubAgent timeout')), timeout),
        ),
      ]);

      const duration = Date.now() - start;
      this.agents.set(id, { agent, status: 'completed', name: config.name });

      return { id, name: config.name, status: 'completed', result: result.content, duration };
    } catch (err) {
      const duration = Date.now() - start;
      const isTimeout = (err as Error).message.includes('timeout');
      const status = isTimeout ? 'timeout' : 'failed';
      this.agents.set(id, { agent, status, name: config.name });

      return { id, name: config.name, status, result: (err as Error).message, duration };
    }
  }

  async spawnParallel(configs: SubAgentConfig[], parentProvider?: any): Promise<SubAgentResult[]> {
    return Promise.all(configs.map((c) => this.spawn(c, parentProvider)));
  }

  list(): Array<{ id: string; name: string; status: string }> {
    return Array.from(this.agents.entries()).map(([id, entry]) => ({
      id,
      name: entry.name,
      status: entry.status,
    }));
  }

  kill(id: string): boolean {
    const entry = this.agents.get(id);
    if (!entry) return false;
    entry.status = 'killed';
    this.agents.set(id, entry);
    return true;
  }
}
