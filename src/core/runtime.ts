import { BaseAgent } from './agent';
import { loadOAD } from './config';
import { WebChannel } from '../channels/web';
import { TelegramChannel } from '../channels/telegram';
import { WebSocketChannel } from '../channels/websocket';
import { DeepBrainMemoryStore } from '../memory/deepbrain';
import type { OADDocument } from '../schema/oad';
import type { ISkill, MemoryStore } from './types';

export class AgentRuntime {
  private agent: BaseAgent | null = null;
  private config: OADDocument | null = null;

  async loadConfig(filePath: string): Promise<OADDocument> {
    this.config = loadOAD(filePath);
    return this.config;
  }

  async initialize(config?: OADDocument): Promise<BaseAgent> {
    const cfg = config ?? this.config;
    if (!cfg) throw new Error('No config loaded. Call loadConfig() first.');

    // Setup memory provider
    let memory: MemoryStore | undefined;
    const memCfg = cfg.spec.memory;
    if (memCfg && typeof memCfg.longTerm === 'object' && memCfg.longTerm.provider === 'deepbrain') {
      memory = new DeepBrainMemoryStore({
        collection: memCfg.longTerm.collection,
        config: memCfg.longTerm.config,
      });
    }

    this.agent = new BaseAgent({
      name: cfg.metadata.name,
      systemPrompt: cfg.spec.systemPrompt,
      provider: cfg.spec.provider?.default,
      model: cfg.spec.model,
      memory,
    });

    // Bind channels
    for (const ch of cfg.spec.channels) {
      if (ch.type === 'web') {
        const port = ch.port ?? 3000;
        this.agent.bindChannel(new WebChannel(port));
      } else if (ch.type === 'telegram') {
        this.agent.bindChannel(new TelegramChannel({
          token: ch.config?.token as string,
          port: ch.port,
        }));
      } else if (ch.type === 'websocket') {
        this.agent.bindChannel(new WebSocketChannel(ch.port ?? 3002));
      }
    }

    await this.agent.init();
    return this.agent;
  }

  async start(): Promise<void> {
    if (!this.agent) throw new Error('Agent not initialized.');
    await this.agent.start();
  }

  async stop(): Promise<void> {
    if (!this.agent) return;
    await this.agent.stop();
  }

  registerSkill(skill: ISkill): void {
    if (!this.agent) throw new Error('Agent not initialized.');
    this.agent.registerSkill(skill);
  }

  getAgent(): BaseAgent | null {
    return this.agent;
  }
}
