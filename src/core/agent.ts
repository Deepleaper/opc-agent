import { EventEmitter } from 'events';
import type { AgentState, IAgent, IChannel, ISkill, Message, MemoryStore, AgentContext } from './types';
import { InMemoryStore } from '../memory';
import { createProvider, type LLMProvider } from '../providers';
import { SkillLearner } from '../skills/auto-learn';

export class BaseAgent extends EventEmitter implements IAgent {
  readonly name: string;
  private _state: AgentState = 'init';
  private skills: Map<string, ISkill> = new Map();
  private channels: IChannel[] = [];
  private memory: MemoryStore;
  private _provider: LLMProvider;
  private systemPrompt: string;
  private historyLimit: number;
  private skillLearner?: SkillLearner;
  private autoLearnConfig: { enabled: boolean; minConversationLength: number; improveOnUse: boolean };

  constructor(options: {
    name: string;
    systemPrompt?: string;
    provider?: string;
    model?: string;
    memory?: MemoryStore;
    historyLimit?: number;
    skillsDir?: string;
    learning?: {
      autoSkillCreation?: boolean;
      minConversationLength?: number;
      improveOnUse?: boolean;
    };
  }) {
    super();
    this.name = options.name;
    this.systemPrompt = options.systemPrompt ?? 'You are a helpful AI agent.';
    this.memory = options.memory ?? new InMemoryStore();
    this._provider = createProvider(options.provider ?? 'openai', options.model);
    this.historyLimit = options.historyLimit ?? 50;
    this.autoLearnConfig = {
      enabled: options.learning?.autoSkillCreation !== false,
      minConversationLength: options.learning?.minConversationLength ?? 3,
      improveOnUse: options.learning?.improveOnUse !== false,
    };
    if (options.skillsDir) {
      this.skillLearner = new SkillLearner(options.skillsDir);
    }
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

  getSkillLearner(): SkillLearner | undefined {
    return this.skillLearner;
  }

  private transition(to: AgentState): void {
    const from = this._state;
    this._state = to;
    this.emit('state:change', from, to);
  }

  async init(): Promise<void> {
    if (this.skillLearner) {
      await this.skillLearner.loadLearnedSkills();
    }
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

    // Check if a learned skill matches — prepend instructions to system prompt
    let effectiveSystemPrompt = this.systemPrompt;
    const matchedSkill = this.skillLearner?.matchSkill(message.content);
    if (matchedSkill) {
      matchedSkill.usageCount++;
      matchedSkill.lastUsed = new Date();
      effectiveSystemPrompt = `[Learned Skill: ${matchedSkill.name}]\n${matchedSkill.instructions}\n\n${this.systemPrompt}`;
      this.emit('skill:matched', matchedSkill);
    }

    // Fall back to LLM
    const llmResponse = await this._provider.chat(context.messages, effectiveSystemPrompt);
    const response = this.createResponse(llmResponse, message);
    await this.memory.addMessage(sessionId, response);
    this.emit('message:out', response);

    // After response, check if we should learn a skill
    if (
      this.skillLearner &&
      this.autoLearnConfig.enabled &&
      context.messages.length >= this.autoLearnConfig.minConversationLength
    ) {
      this.skillLearner
        .analyzeForSkillCreation(context.messages, this._provider)
        .then(async (learnedSkill) => {
          if (learnedSkill) {
            await this.skillLearner!.saveSkill(learnedSkill);
            this.emit('skill:learned', learnedSkill);
          }
        })
        .catch(() => {});
    }

    // Improve matched skill after use
    if (matchedSkill && this.skillLearner && this.autoLearnConfig.improveOnUse) {
      this.skillLearner
        .improveSkill(matchedSkill, context.messages, this._provider)
        .then(() => this.skillLearner!.saveSkill(matchedSkill))
        .catch(() => {});
    }

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
