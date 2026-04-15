import { EventEmitter } from 'events';

// ─── Core Types ──────────────────────────────────────────────

export type AgentState = 'init' | 'ready' | 'running' | 'stopped' | 'error';

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
