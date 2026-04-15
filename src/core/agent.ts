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
  private _provider: LLMProvider;
  private systemPrompt: string;
  private historyLimit: number;

  constructor(options: {
    name: string;
    systemPrompt?: string;
    provider?: string;
    model?: string;
    memory?: MemoryStore;
    historyLimit?: number;
  }) {
    super();
    this.name = options.name;
    this.systemPrompt = options.systemPrompt ?? 'You are a helpful AI agent.';
    this.memory = options.memory ?? new InMemoryStore();
    this._provider = createProvider(options.provider ?? 'openai', options.model);
    this.historyLimit = options.historyLimit ?? 50;
  }

  get state(): AgentState {
    return this._state;
  }

  get provider(): LLMProvider {
    return this._provider;
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  getMemory(): MemoryStore {
    return this.memory;
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

  getChannels(): IChannel[] {
    return this.channels;
  }

  async handleMessage(message: Message): Promise<Message> {
    this.emit('message:in', message);

    const sessionId = (message.metadata?.sessionId as string) ?? 'default';
    await this.memory.addMessage(sessionId, message);

    const context: AgentContext = {
      agentName: this.name,
      sessionId,
      messages: (await this.memory.getConversation(sessionId)).slice(-this.historyLimit),
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
    const llmResponse = await this._provider.chat(context.messages, this.systemPrompt);
    const response = this.createResponse(llmResponse, message);
    await this.memory.addMessage(sessionId, response);
    this.emit('message:out', response);
    return response;
  }

  async *handleMessageStream(message: Message): AsyncIterable<string> {
    const sessionId = (message.metadata?.sessionId as string) ?? 'default';
    await this.memory.addMessage(sessionId, message);

    const history = (await this.memory.getConversation(sessionId)).slice(-this.historyLimit);

    let fullResponse = '';
    for await (const chunk of this._provider.chatStream(history, this.systemPrompt)) {
      fullResponse += chunk;
      yield chunk;
    }

    const response = this.createResponse(fullResponse, message);
    await this.memory.addMessage(sessionId, response);
    this.emit('message:out', response);
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
