// v2 agent pool — manages multiple agent instances for Studio multi-agent UI
import type { AgentConfig } from '../core/types';

export interface PooledAgent {
  id: string;
  config: AgentConfig;
  status: 'idle' | 'running' | 'error' | 'stopped';
  createdAt: number;
  lastActiveAt: number;
}

export class AgentPool {
  private agents = new Map<string, PooledAgent>();

  create(id: string, config: AgentConfig): PooledAgent {
    const agent: PooledAgent = {
      id,
      config,
      status: 'idle',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    this.agents.set(id, agent);
    return agent;
  }

  get(id: string): PooledAgent | undefined {
    return this.agents.get(id);
  }

  list(): PooledAgent[] {
    return Array.from(this.agents.values());
  }

  remove(id: string): void {
    this.agents.delete(id);
  }

  setStatus(id: string, status: PooledAgent['status']): void {
    const agent = this.agents.get(id);
    if (agent) {
      agent.status = status;
      agent.lastActiveAt = Date.now();
    }
  }
}
