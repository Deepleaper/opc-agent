import { EventEmitter } from 'events';
import type { AgentState, IAgent, IChannel, ISkill, Message, MemoryStore, AgentContext } from './types';
import { InMemoryStore } from '../memory';
import { createProvider, type LLMProvider } from '../providers';
import { SkillLearner } from '../skills/auto-learn';
import type { MCPTool } from '../tools/mcp';
import { MCPToolRegistry } from '../tools/mcp';
import { SubAgentManager, type SubAgentConfig, type SubAgentResult } from './subagent';
import { Tracer } from '../telemetry';
import type { Span as TelemetrySpan } from '../telemetry';
import { BrainSeedLoader, type BrainSeedConfig } from '../memory/seed-loader';
import { GuardrailManager, type GuardrailConfig } from '../security/guardrails';

export class BaseAgent extends EventEmitter implements IAgent {
  readonly name: string;
  private _state: AgentState = 'init';
  private skills: Map<string, ISkill> = new Map();
  private channels: IChannel[] = [];
  private memory: MemoryStore;
  private _provider: LLMProvider;
  private systemPrompt: string;
  private historyLimit: number;
  private toolRegistry: MCPToolRegistry = new MCPToolRegistry();
  private maxToolRounds: number;
  private skillLearner?: SkillLearner;
  private autoLearnConfig: { enabled: boolean; minConversationLength: number; improveOnUse: boolean };
  private _subAgentManager?: SubAgentManager;
  private longTermMemory?: any;
  private longTermMemoryConfig: { autoLearn: boolean; autoRecall: boolean } = { autoLearn: true, autoRecall: true };
  private tracer?: Tracer;
  private brainSeedConfig?: BrainSeedConfig;
  private agentDir: string;
  private guardrails?: GuardrailManager;

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
    maxToolRounds?: number;
    tracer?: Tracer;
    agentDir?: string;
    brainSeedConfig?: BrainSeedConfig;
  }) {
    super();
    this.name = options.name;
    this.systemPrompt = options.systemPrompt ?? 'You are a helpful AI agent.';
    this.memory = options.memory ?? new InMemoryStore();
    this._provider = createProvider(options.provider ?? 'openai', options.model);
    this.historyLimit = options.historyLimit ?? 50;
    this.maxToolRounds = options.maxToolRounds ?? 10;
    this.autoLearnConfig = {
      enabled: options.learning?.autoSkillCreation !== false,
      minConversationLength: options.learning?.minConversationLength ?? 3,
      improveOnUse: options.learning?.improveOnUse !== false,
    };
    if (options.skillsDir) {
      this.skillLearner = new SkillLearner(options.skillsDir);
    }
    this.tracer = options.tracer;
    this.agentDir = options.agentDir ?? process.cwd();
    this.brainSeedConfig = options.brainSeedConfig;
  }

  setLongTermMemory(brain: any, config?: { autoLearn?: boolean; autoRecall?: boolean }): void {
    this.longTermMemory = brain;
    if (config) {
      this.longTermMemoryConfig = {
        autoLearn: config.autoLearn !== false,
        autoRecall: config.autoRecall !== false,
      };
    }
  }

  setGuardrails(config: GuardrailConfig): void {
    this.guardrails = new GuardrailManager(config);
  }

  getGuardrails(): GuardrailManager | undefined {
    return this.guardrails;
  }

  getLongTermMemory(): any {
    return this.longTermMemory;
  }

  getLongTermMemoryConfig(): { autoLearn: boolean; autoRecall: boolean } {
    return this.longTermMemoryConfig;
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

  getToolRegistry(): MCPToolRegistry {
    return this.toolRegistry;
  }

  getTracer(): Tracer | undefined {
    return this.tracer;
  }

  setTracer(tracer: Tracer): void {
    this.tracer = tracer;
  }

  registerTool(tool: MCPTool): void {
    this.toolRegistry.register(tool);
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

    // Auto-seed brain if configured
    if (this.brainSeedConfig?.autoSeed && this.longTermMemory) {
      const loader = new BrainSeedLoader(this.agentDir, this.brainSeedConfig);
      if (!await loader.isSeeded()) {
        const result = await loader.seedBrain(this.longTermMemory);
        this.emit('brain:seeded', result);
        await loader.markSeeded();
      }
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

  private getSubAgentManager(): SubAgentManager {
    if (!this._subAgentManager) {
      this._subAgentManager = new SubAgentManager();
    }
    return this._subAgentManager;
  }

  async spawnSubAgent(config: SubAgentConfig): Promise<SubAgentResult> {
    return this.getSubAgentManager().spawn(config, this._provider);
  }

  async spawnParallel(configs: SubAgentConfig[]): Promise<SubAgentResult[]> {
    return this.getSubAgentManager().spawnParallel(configs, this._provider);
  }

  async handleMessage(message: Message): Promise<Message> {
    this.emit('message:in', message);

    // Start root span if tracer is configured
    let rootSpan: TelemetrySpan | undefined;
    if (this.tracer) {
      rootSpan = this.tracer.startSpan('handleMessage', {
        kind: 'server',
        attributes: {
          'message.channel': (message.metadata?.channel as string) || 'unknown',
          'message.sender': (message.metadata?.sender as string) || 'unknown',
          'message.length': message.content.length,
        },
      });
      this.tracer.increment('agent.messages.total', 1, { agent: this.name });
    }

    const sessionId = (message.metadata?.sessionId as string) ?? 'default';
    await this.memory.addMessage(sessionId, message);

    // === Guardrails: check input ===
    if (this.guardrails) {
      const inputCheck = await this.guardrails.checkInput(message.content);
      if (inputCheck.blocked) {
        const blockedResponse = this.createResponse(inputCheck.message ?? 'Message blocked by guardrails.', message);
        await this.memory.addMessage(sessionId, blockedResponse);
        this.emit('message:out', blockedResponse);
        if (rootSpan && this.tracer) {
          this.tracer.addEvent(rootSpan, 'guardrail.blocked', { rule: inputCheck.violations[0]?.rule ?? 'unknown' });
          this.tracer.endSpan(rootSpan, 'ok');
        }
        return blockedResponse;
      }
      if (inputCheck.redacted && inputCheck.redactedText) {
        message = { ...message, content: inputCheck.redactedText };
      }
    }

    // === Recall from long-term memory ===
    let memoryContext = '';
    if (this.longTermMemory && this.longTermMemoryConfig.autoRecall) {
      let memorySpan: TelemetrySpan | undefined;
      if (this.tracer && rootSpan) {
        memorySpan = this.tracer.startSpan('memory.recall', { parent: rootSpan, kind: 'client' });
      }
      try {
        const recalled = await this.longTermMemory.recall(message.content);
        if (recalled && (Array.isArray(recalled) ? recalled.length > 0 : true)) {
          memoryContext = '\n\n[Relevant memories]\n' +
            (Array.isArray(recalled)
              ? recalled.map((r: any) => typeof r === 'string' ? r : r.content || r.compiled_truth || '').join('\n')
              : String(recalled));
        }
        if (this.tracer && memorySpan) this.tracer.endSpan(memorySpan, 'ok');
      } catch {
        if (this.tracer && memorySpan) this.tracer.endSpan(memorySpan, 'error');
        // Silent fail — don't break chat if memory fails
      }
    }

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

    // Inject long-term memory context
    if (memoryContext) {
      effectiveSystemPrompt = effectiveSystemPrompt + memoryContext;
    }

    const matchedSkill = this.skillLearner?.matchSkill(message.content);
    if (matchedSkill) {
      matchedSkill.usageCount++;
      matchedSkill.lastUsed = new Date();
      effectiveSystemPrompt = `[Learned Skill: ${matchedSkill.name}]\n${matchedSkill.instructions}\n\n${this.systemPrompt}`;
      this.emit('skill:matched', matchedSkill);
      if (this.tracer && rootSpan) {
        this.tracer.addEvent(rootSpan, 'skill.matched', { 'skill.name': matchedSkill.name });
      }
    }

    // Fall back to LLM with tool use loop
    const tools = this.toolRegistry.list();
    const llmMessages = [...context.messages];
    let finalResponse = '';

    for (let round = 0; round <= this.maxToolRounds; round++) {
      let llmSpan: TelemetrySpan | undefined;
      if (this.tracer && rootSpan) {
        llmSpan = this.tracer.startSpan('llm.chat', {
          parent: rootSpan,
          kind: 'client',
          attributes: { 'llm.round': round },
        });
      }

      const llmResponse = await this._provider.chat(
        llmMessages,
        effectiveSystemPrompt,
        { tools: tools.length > 0 ? tools : undefined },
      );

      if (this.tracer && llmSpan) {
        llmSpan.attributes['llm.response.length'] = llmResponse.length;
        this.tracer.endSpan(llmSpan, 'ok');
      }

      const toolCall = this.parseToolCall(llmResponse);
      if (!toolCall || tools.length === 0 || round === this.maxToolRounds) {
        finalResponse = llmResponse;
        break;
      }

      // Execute tool
      let toolSpan: TelemetrySpan | undefined;
      if (this.tracer && rootSpan) {
        toolSpan = this.tracer.startSpan('tool.execute', {
          parent: rootSpan,
          kind: 'internal',
          attributes: { 'tool.name': toolCall.name },
        });
      }

      const toolResult = await this.toolRegistry.execute(toolCall.name, toolCall.arguments, context);
      this.emit('tool:execute', toolCall.name, toolResult);

      if (this.tracer && toolSpan) {
        toolSpan.attributes['tool.result.length'] = toolResult.content?.length || 0;
        this.tracer.endSpan(toolSpan, 'ok');
      }

      // Add tool call and result to messages for next round
      llmMessages.push({
        id: `tool_call_${Date.now()}`,
        role: 'assistant',
        content: llmResponse,
        timestamp: Date.now(),
      });
      llmMessages.push({
        id: `tool_result_${Date.now()}`,
        role: 'user',
        content: `[Tool Result for ${toolCall.name}]: ${toolResult.content}`,
        timestamp: Date.now(),
      });
    }

    // === Guardrails: check output ===
    if (this.guardrails) {
      const outputCheck = await this.guardrails.checkOutput(finalResponse);
      if (outputCheck.blocked) {
        finalResponse = outputCheck.message ?? 'Response blocked by guardrails.';
      } else if (outputCheck.redacted && outputCheck.redactedText) {
        finalResponse = outputCheck.redactedText;
      }
    }

    const response = this.createResponse(finalResponse, message);
    await this.memory.addMessage(sessionId, response);
    this.emit('message:out', response);

    // End root telemetry span
    if (this.tracer && rootSpan) {
      rootSpan.attributes['response.length'] = finalResponse.length;
      this.tracer.endSpan(rootSpan, 'ok');
      this.tracer.histogram('agent.message.duration', rootSpan.endTime! - rootSpan.startTime, { agent: this.name });
    }

    // === Learn from interaction ===
    if (this.longTermMemory && this.longTermMemoryConfig.autoLearn) {
      try {
        await this.longTermMemory.learn(
          `User: ${message.content}\nAssistant: ${finalResponse}`,
          { tags: ['conversation', (message.metadata?.channel as string) || 'unknown'] },
        );
      } catch {
        // Silent fail
      }
    }

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

  private parseToolCall(response: string): { name: string; arguments: Record<string, unknown> } | null {
    try {
      const parsed = JSON.parse(response);
      if (parsed.tool_call) return parsed.tool_call;
      if (parsed.name && parsed.arguments !== undefined) return parsed;
    } catch { /* not JSON */ }

    const match = response.match(/<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.name) return parsed;
      } catch { /* not valid JSON */ }
    }
    return null;
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
