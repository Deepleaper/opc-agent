import type { Message, MemoryStore } from '../core/types';

export { BrainSeedLoader, KnowledgeEvolver } from './seed-loader';
export type { BrainSeedConfig, SeedPage, SeedResult, PromotionResult, PromotionCandidate } from './seed-loader';
export { ContextCompressor } from './context-compressor';
export type { CompressorConfig, CompressResult } from './context-compressor';
export { UserProfiler } from './user-profiler';
export type { UserProfile } from './user-profiler';

export class InMemoryStore implements MemoryStore {
  private store: Map<string, unknown> = new Map();
  private conversations: Map<string, Message[]> = new Map();

  async get(key: string): Promise<unknown> {
    return this.store.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async getConversation(sessionId: string): Promise<Message[]> {
    return this.conversations.get(sessionId) ?? [];
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, []);
    }
    this.conversations.get(sessionId)!.push(message);
  }

  async clear(sessionId?: string): Promise<void> {
    if (sessionId) {
      this.conversations.delete(sessionId);
    } else {
      this.store.clear();
      this.conversations.clear();
    }
  }
}
