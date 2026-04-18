import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export interface AgentConfig {
  id: string;
  name: string;
  model?: string;
  skills?: string[];
}

export interface ChannelConfig {
  id: string;
  type: string;
  config?: Record<string, unknown>;
}

export interface GatewayConfig {
  port: number;
  agents: AgentConfig[];
  channels: ChannelConfig[];
}

interface GatewayMessage {
  id: string;
  content: string;
  channel: string;
  timestamp: number;
}

export class Gateway extends EventEmitter {
  private config: GatewayConfig;
  private agents = new Map<string, AgentConfig>();
  private channels = new Map<string, ChannelConfig>();
  private running = false;
  private startTime = 0;
  private messagesProcessed = 0;
  private latencies: number[] = [];
  private errors = 0;

  constructor(config: GatewayConfig) {
    super();
    this.config = config;
    for (const a of config.agents) this.agents.set(a.id, a);
    for (const c of config.channels) this.channels.set(c.id, c);
  }

  async start(): Promise<void> {
    if (this.running) throw new Error('Gateway already running');
    this.running = true;
    this.startTime = Date.now();
    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.running) throw new Error('Gateway not running');
    this.running = false;
    this.emit('stopped');
  }

  async routeMessage(message: GatewayMessage, channel: string): Promise<string> {
    if (!this.running) throw new Error('Gateway not running');
    const start = Date.now();
    this.messagesProcessed++;
    // Simple round-robin routing
    const agentIds = Array.from(this.agents.keys());
    if (agentIds.length === 0) {
      this.errors++;
      throw new Error('No agents available');
    }
    const agentId = agentIds[this.messagesProcessed % agentIds.length];
    this.latencies.push(Date.now() - start);
    return agentId;
  }

  addAgent(config: AgentConfig): void {
    this.agents.set(config.id, config);
  }

  removeAgent(id: string): void {
    if (!this.agents.has(id)) throw new Error(`Agent ${id} not found`);
    this.agents.delete(id);
  }

  addChannel(config: ChannelConfig): void {
    this.channels.set(config.id, config);
  }

  getStatus(): { uptime: number; agents: number; channels: number; messagesProcessed: number } {
    return {
      uptime: this.running ? Date.now() - this.startTime : 0,
      agents: this.agents.size,
      channels: this.channels.size,
      messagesProcessed: this.messagesProcessed,
    };
  }

  getMetrics(): { messagesPerMinute: number; avgLatency: number; errorRate: number } {
    const upMinutes = this.running ? (Date.now() - this.startTime) / 60000 : 1;
    const avgLatency = this.latencies.length ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length : 0;
    return {
      messagesPerMinute: this.messagesProcessed / Math.max(upMinutes, 0.001),
      avgLatency,
      errorRate: this.messagesProcessed ? this.errors / this.messagesProcessed : 0,
    };
  }
}
