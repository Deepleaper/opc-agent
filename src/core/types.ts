import { EventEmitter } from 'events';

// ─── Foundation / Primitive Types ────────────────────────────────────────────

export type AgentState = 'init' | 'ready' | 'running' | 'stopped' | 'error';
export type SkillLevel = 'builtin' | 'auto' | 'user';
export type PermissionLevel = 'allow' | 'ask' | 'deny';
export type DeepBrainLayer = 'l1' | 'l2' | 'l3' | 'l4';
export type WorkstationLayer = 'workstation' | 'job' | 'industry';
export type KnowledgeSource = 'l1' | 'l2' | 'l3' | 'l4' | 'user' | 'seed';
export type EmbeddingProvider = 'ollama' | 'openai' | 'local' | 'none';
export type BudgetState = 'ok' | 'warn' | 'critical' | 'stop';
export type ContextLevel = 'simple' | 'recall' | 'complex';

// ─── V1 Legacy Types ──────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface AgentContext {
  agentName: string;
  sessionId: string;
  messages: Message[];
  memory: MemoryStore;
  metadata: Record<string, unknown>;
}

export interface SkillResult {
  handled: boolean;
  response?: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface ISkill {
  name: string;
  description: string;
  execute(context: AgentContext, message: Message): Promise<SkillResult>;
}

export interface IChannel {
  type: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  onMessage(handler: (message: Message) => Promise<Message>): void;
}

export interface MemoryStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  getConversation(sessionId: string): Promise<Message[]>;
  addMessage(sessionId: string, message: Message): Promise<void>;
  clear(sessionId?: string): Promise<void>;
}

export interface AgentEvents {
  'state:change': (from: AgentState, to: AgentState) => void;
  'message:in': (message: Message) => void;
  'message:out': (message: Message) => void;
  'skill:execute': (skill: string, result: SkillResult) => void;
  'error': (error: Error) => void;
}

export interface IAgent extends EventEmitter {
  readonly name: string;
  readonly state: AgentState;
  init(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  handleMessage(message: Message): Promise<Message>;
  registerSkill(skill: ISkill): void;
  bindChannel(channel: IChannel): void;
}

// ─── V2 Message Types ─────────────────────────────────────────────────────────

export interface UserMessage {
  role: 'user';
  content: string;
  name?: string;
  sessionId?: string;
  timestamp?: number;
}

export interface AssistantMessage {
  role: 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  timestamp?: number;
}

export interface ToolMessage {
  role: 'tool';
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface SystemMessage {
  role: 'system';
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolResult {
  callId: string;
  content: string;
  isError?: boolean;
}

export type ChatMessage = UserMessage | AssistantMessage | ToolMessage | SystemMessage;

// ─── V2 Config Types ──────────────────────────────────────────────────────────

export interface EgoConfig {
  identity: { name: string; creature: string; emoji: string };
  role: string;
  principles: string[];
  evolutionGoals: string[];
  egoContext: string;
}

export interface DeepBrainConfig {
  dbPath: string;
  layers: WorkstationLayer[];
  embeddingProvider: 'ollama' | 'none';
  embeddingModel: string;
  maxEntries?: number;
  autoMigrate?: boolean;
}

export interface ModelConfig {
  provider: 'agentkits' | 'openai' | 'anthropic' | 'ollama' | string;
  strategy: 'experience' | 'cost' | 'free';
  apiKey?: string;
  override?: { provider: string; apiKey: string; model: string };
  local: { provider: 'ollama'; model: 'auto' | string; embeddingModel: 'auto' | string };
  fallback: 'ollama' | 'none';
}

export interface EvolutionConfig {
  strategy: 'experience' | 'cost' | 'free';
  l1: { enabled: boolean };
  l2: { enabled: boolean; trigger: 'idle_2h' | 'messages_50' | 'manual' };
  l3: { enabled: boolean; autoDiscover: boolean; verifier: boolean };
  l4: { enabled: boolean; upwardFlow: boolean; desensitize: boolean };
}

export interface SkillConfig {
  name: string;
  description: string;
  path: string;
  level: SkillLevel;
  enabled?: boolean;
  parameters?: Record<string, unknown>;
}

export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  transport?: 'stdio' | 'sse';
  url?: string;
}

export interface ToolConfig {
  builtin: string[];
  mcp: McpServerConfig[];
  permissions: Record<string, PermissionLevel>;
  timeout?: number;
  maxConcurrent?: number;
}

export interface WebConfig {
  enabled: boolean;
  port?: number;
  host?: string;
  cors?: boolean | string[];
  auth?: boolean;
  wsPath?: string;
}

/** @deprecated Use WebConfig */
export type WebChannelConfig = WebConfig;

export interface TelegramConfig {
  enabled: boolean;
  token: string;
  webhookUrl?: string;
  allowedUsers?: string[];
}

/** @deprecated Use TelegramConfig */
export type TelegramChannelConfig = TelegramConfig;

export interface ApiConfig {
  enabled: boolean;
  port?: number;
  basePath?: string;
  auth?: 'bearer' | 'apikey' | 'none';
  apiKeys?: string[];
}

/** @deprecated Use ApiConfig */
export type ApiChannelConfig = ApiConfig;

export interface VoiceConfig {
  enabled: boolean;
  provider?: 'whisper' | 'azure' | 'google';
  language?: string;
  wakeWord?: string;
}

/** @deprecated Use VoiceConfig */
export type VoiceChannelConfig = VoiceConfig;

export interface ChannelConfig {
  web?: WebConfig;
  telegram?: TelegramConfig;
  api?: ApiConfig;
  voice?: VoiceConfig;
}

export interface GuardrailRule {
  id: string;
  name: string;
  pattern: string | RegExp;
  action: 'block' | 'warn' | 'redact';
  message?: string;
}

export interface InputFilter {
  id: string;
  fn: (input: string) => string | null;
  description?: string;
}

export interface OutputFilter {
  id: string;
  fn: (output: string) => string | null;
  description?: string;
}

export interface GuardrailConfig {
  inputFilters: InputFilter[];
  outputFilters: OutputFilter[];
  blockedPatterns: GuardrailRule[];
  maxInputLength?: number;
  maxOutputLength?: number;
}

export interface AgentConfig {
  ego: EgoConfig;
  deepbrain: DeepBrainConfig;
  model: ModelConfig;
  evolution: EvolutionConfig;
  skills: SkillConfig[];
  tools: ToolConfig;
  channels: ChannelConfig;
  guardrails: GuardrailConfig;
}

// ─── V2 Knowledge / Evolution Types ──────────────────────────────────────────

export interface KnowledgeEntry {
  id: string;
  content: string;
  source: KnowledgeSource;
  layer: WorkstationLayer;
  tags: string[];
  embedding: number[] | null;
  maturityScore: number;
  useCount: number;
  lastUsed: string;
  createdAt: string;
  updatedAt: string;
}

export interface Experience {
  id: string;
  sessionId: string;
  summary: string;
  lessons: string[];
  errorPatterns: string[];
  createdAt: string;
}

export interface SkillRecord {
  id: string;
  name: string;
  description: string;
  filePath: string;
  status: 'candidate' | 'active' | 'retired';
  useCount: number;
  createdAt: string;
}

export interface EvolutionLog {
  id: string;
  layer: 'l1' | 'l2' | 'l3' | 'l4';
  action: string;
  details: Record<string, any>;
  modelUsed: string;
  createdAt: string;
}

// ─── V2 Provider Request / Response Types ─────────────────────────────────────

export interface ChatRequest {
  model?: string;
  messages: Message[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  model: string;
  message: AssistantMessage;
  usage: TokenUsage;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StreamChunk {
  id: string;
  delta: string;
  toolCallDelta?: Partial<ToolCall>;
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'error';
  done: boolean;
}

export interface EmbedRequest {
  model?: string;
  input: string | string[];
}

export interface EmbedResponse {
  model: string;
  embeddings: number[][];
  usage?: TokenUsage;
}

export interface ModelInfo {
  id: string;
  provider: string;
  contextLength: number;
  supportedFeatures: ('tools' | 'vision' | 'streaming' | 'embedding')[];
  costPerMToken?: { input: number; output: number };
  isLocal: boolean;
}

// ─── V2 Provider Interfaces ───────────────────────────────────────────────────

export interface ModelProvider {
  chat(req: ChatRequest): Promise<ChatResponse>;
  chatStream(req: ChatRequest): AsyncIterable<StreamChunk>;
  embed(req: EmbedRequest): Promise<EmbedResponse>;
  info(): Promise<ModelInfo[]>;
}

export interface RecallQuery {
  query: string;
  layer?: DeepBrainLayer | DeepBrainLayer[] | WorkstationLayer | WorkstationLayer[];
  topK?: number;
  minScore?: number;
  tags?: string[];
  includeEmbedding?: boolean;
}

export interface RecallResult {
  entries: KnowledgeEntry[];
  query: string;
  elapsedMs: number;
}

export interface StoreResult {
  id: string;
  layer: DeepBrainLayer | WorkstationLayer;
  success: boolean;
  deduplicated?: boolean;
}

export interface DeepBrainStats {
  totalEntries: number;
  entriesByLayer: Record<string, number>;
  avgMaturityScore: number;
  lastEvolution?: number;
}

export interface DeepBrainProvider {
  store(entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoreResult>;
  recall(query: RecallQuery): Promise<RecallResult>;
  evolve(layer: DeepBrainLayer, config?: Partial<EvolutionConfig>): Promise<EvolutionLog>;
  getStats(): Promise<DeepBrainStats>;
}

export interface TemplateProvider {
  listIndustries(): Promise<string[]>;
  listRoles(industry: string): Promise<string[]>;
  getTemplate(role: string): Promise<OADSpec | null>;
}

// ─── V2 Tool Types ────────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler?: Function;
}

export interface ToolHook {
  beforeTool?: (name: string, args: Record<string, unknown>) => Promise<void | Record<string, unknown>>;
  afterTool?: (name: string, result: ToolResult) => Promise<void | ToolResult>;
}

// ─── V2 Skill Types ───────────────────────────────────────────────────────────

export interface SkillDefinition {
  name: string;
  description: string;
  triggers: string[];
  content: string;
  references: string[];
}

export interface SkillMatch {
  skill: SkillDefinition;
  score: number;
  level: 'L0' | 'L1' | 'L2';
}

// ─── V2 Agent Loop Types ──────────────────────────────────────────────────────

export interface Chunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'error';
  content: string;
}

export interface IterationBudget {
  maxIterations: number;
  maxTokens: number;
  timeoutMs?: number;
  allowOverrun?: boolean;
}

export interface BudgetSnapshot {
  iterationsUsed: number;
  iterationsMax: number;
  tokensUsed: number;
  tokensMax: number;
  elapsed: number;
  deadline?: number;
}

export interface AgentLoopOptions {
  maxIterations: number;
  config: AgentConfig;
  budgetStatus?: BudgetState;
  stream?: boolean;
  sessionId?: string;
}

export interface ContextAssemblerOptions {
  level: ContextLevel;
  maxMessages?: number;
  includeSummary?: boolean;
  includeMemory?: boolean;
  systemPromptOverride?: string;
}

// ─── V2 Evolution Specialized Types ──────────────────────────────────────────

export interface AutoDreamAction {
  type: 'merge' | 'trim' | 'reorganize';
  ids: string[];
  newContent?: string;
}

export interface MaturityScore {
  frequency: number;
  accuracy: number;
  recency: number;
  coverage: number;
  total: number;
}

export interface DesensitizeResult {
  original: string;
  desensitized: string;
  removedEntities: string[];
}

// ─── OAD (Open Agent Descriptor) Schema ──────────────────────────────────────

export interface OADMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  created: number;
  updated: number;
  tags?: string[];
}

export interface OADSpec {
  metadata: OADMetadata;
  ego: EgoConfig;
  model: ModelConfig;
  skills: SkillConfig[];
  tools: ToolConfig;
  channels: ChannelConfig;
  evolution?: EvolutionConfig;
}
