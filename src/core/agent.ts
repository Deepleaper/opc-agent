import { EventEmitter } from 'events';
import type { AgentState, IAgent, IChannel, ISkill, Message, MemoryStore, AgentContext } from './types';
import { InMemoryStore } from '../memory';
import { createProvider, type LLMProvider } from '../providers';

export class BaseAgent extends EventEmitter implements IAgent {
  readonly name: string;
  private _state: AgentState = 'init';
  private skills: Map<string, ISkill> = new Map();
  private channels: IChannel[] = [];
  private memory: MemoryStore;
  private provider: LLMProvider;
  private systemPrompt: string;

  constructor(options: {
    name: string;
    systemPrompt?: string;
    provider?: string;
    model?: string;
    memory?: MemoryStore;
  }) {
    super();
    this.name = options.name;
    this.systemPrompt = options.systemPrompt ?? 'You are a helpful AI agent.';
    this.memory = options.memory ?? new InMemoryStore();
    this.provider = createProvider(options.provider ?? 'deepseek', options.model ?? 'deepseek-chat');
  }

  get state(): AgentState {
    return this._state;
  }

  private transition(to: AgentState): void {
    const from = this._state;
    this._state = to;
    this.emit('state:change', from, to);
  }

  async init(): Promise<void> {
    this.transition('ready');
  }

  async start(): Promise<void> {
    if (this._state !== 'ready') {
      throw new Error(`Cannot start agent in state: ${this._state}`);
    }
    for (const channel of this.channels) {
      channel.onMessage((msg) => this.handleMessage(msg));
      await channel.start();
    }
    this.transition('running');
  }

  async stop(): Promise<void> {
    for (const channel of this.channels) {
      await channel.stop();
    }
    this.transition('stopped');
  }

  registerSkill(skill: ISkill): void {
    this.skills.set(skill.name, skill);
  }

  bindChannel(channel: IChannel): void {
    this.channels.push(channel);
  }

  async handleMessage(message: Message): Promise<Message> {
    this.emit('message:in', message);

    const sessionId = (message.metadata?.sessionId as string) ?? 'default';
    await this.memory.addMessage(sessionId, message);

    const context: AgentContext = {
      agentName: this.name,
      sessionId,
      messages: await this.memory.getConversation(sessionId),
      memory: this.memory,
      metadata: {},
    };

    // Try skills first
    for (const [name, skill] of this.skills) {
      try {
        const result = await skill.execute(context, message);
        this.emit('skill:execute', name, result);
        if (result.handled && result.response) {
          const response = this.createResponse(result.response, message);
          await this.memory.addMessage(sessionId, response);
          this.emit('message:out', response);
          return response;
        }
      } catch (err) {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      }
    }

    // Fall back to LLM
    const llmResponse = await this.provider.chat(context.messages, this.systemPrompt);
    const response = this.createResponse(llmResponse, message);
    await this.memory.addMessage(sessionId, response);
    this.emit('message:out', response);
    return response;
  }

  private createResponse(content: string, inReplyTo: Message): Message {
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata: { inReplyTo: inReplyTo.id },
    };
  }
}
