// v2 model-provider — base adapter class all providers extend
import type {
  ModelProvider,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  EmbedRequest,
  EmbedResponse,
  ModelInfo,
} from '../core/types';

export type { ModelProvider };

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
}

export abstract class BaseModelProvider implements ModelProvider {
  abstract chat(req: ChatRequest): Promise<ChatResponse>;
  abstract chatStream(req: ChatRequest): AsyncIterable<StreamChunk>;
  abstract embed(req: EmbedRequest): Promise<EmbedResponse>;
  abstract info(): Promise<ModelInfo[]>;
}

export function buildSystemPrompt(systemPrompt: string, ego?: string): string {
  if (!ego) return systemPrompt;
  return `${ego}\n\n${systemPrompt}`;
}
