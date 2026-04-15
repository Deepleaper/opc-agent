import { EventEmitter } from 'events';
import { Room } from './room';
import type { Message, IAgent } from './types';
import { Logger } from './logger';

// ── A2A Types ───────────────────────────────────────────────

export interface AgentCapability {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface AgentRegistration {
  agentName: string;
  capabilities: AgentCapability[];
  endpoint?: string;
  metadata?: Record<string, unknown>;
}

export interface A2ARequest {
  id: string;
  from: string;
  to: string;
  capability: string;
  payload: string;
  timestamp: number;
  timeout?: number;
}

export interface A2AResponse {
  requestId: string;
  from: string;
  status: 'success' | 'error' | 'timeout';
  payload?: string;
  error?: string;
  timestamp: number;
}

// ── Agent Registry ──────────────────────────────────────────

export class AgentRegistry extends EventEmitter {
  private registrations: Map<string, AgentRegistration> = new Map();
  private agents: Map<string, IAgent> = new Map();
  private room: Room;
  private logger = new Logger('a2a');

  constructor(room?: Room) {
    super();
    this.room = room ?? new Room('a2a-default');
  }

  register(agent: IAgent, capabilities: AgentCapability[]): void {
    const reg: AgentRegistration = { agentName: agent.name, capabilities };
    this.registrations.set(agent.name, reg);
    this.agents.set(agent.name, agent);
    this.room.addAgent(agent);
    this.logger.info('Agent registered', { name: agent.name, capabilities: capabilities.map(c => c.name) });
    this.emit('agent:registered', reg);
  }

  unregister(name: string): void {
    this.registrations.delete(name);
    this.agents.delete(name);
    this.room.removeAgent(name);
    this.emit('agent:unregistered', name);
  }

  discover(capability?: string): AgentRegistration[] {
    const all = Array.from(this.registrations.values());
    if (!capability) return all;
    return all.filter(r => r.capabilities.some(c => c.name === capability));
  }

  getAgent(name: string): IAgent | undefined {
    return this.agents.get(name);
  }

  async request(req: A2ARequest): Promise<A2AResponse> {
    const agent = this.agents.get(req.to);
    if (!agent) {
      return {
        requestId: req.id,
        from: req.to,
        status: 'error',
        error: `Agent "${req.to}" not found`,
        timestamp: Date.now(),
      };
    }

    const message: Message = {
      id: req.id,
      role: 'user',
      content: req.payload,
      timestamp: req.timestamp,
      metadata: { a2a: true, from: req.from, capability: req.capability },
    };

    this.emit('request', req);

    try {
      const timeoutMs = req.timeout ?? 30000;
      const response = await Promise.race([
        agent.handleMessage(message),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('A2A request timeout')), timeoutMs),
        ),
      ]);

      const res: A2AResponse = {
        requestId: req.id,
        from: req.to,
        status: 'success',
        payload: response.content,
        timestamp: Date.now(),
      };
      this.emit('response', res);
      return res;
    } catch (err) {
      const res: A2AResponse = {
        requestId: req.id,
        from: req.to,
        status: (err as Error).message.includes('timeout') ? 'timeout' : 'error',
        error: (err as Error).message,
        timestamp: Date.now(),
      };
      this.emit('response', res);
      return res;
    }
  }

  async call(from: string, to: string, capability: string, payload: string): Promise<A2AResponse> {
    return this.request({
      id: `a2a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      from,
      to,
      capability,
      payload,
      timestamp: Date.now(),
    });
  }
}
