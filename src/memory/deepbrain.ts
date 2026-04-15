import type { Message, MemoryStore } from '../core/types';
import { InMemoryStore } from './index';

/**
 * DeepBrain-backed memory store for long-term semantic memory.
 * Falls back to InMemoryStore if deepbrain package is not installed.
 */
export interface DeepBrainClient {
  store(collection: string, id: string, content: string, metadata?: Record<string, unknown>): Promise<void>;
  search(collection: string, query: string, limit?: number): Promise<Array<{ id: string; content: string; score: number }>>;
  delete(collection: string, id?: string): Promise<void>;
}

export class DeepBrainMemoryStore implements MemoryStore {
  private fallback: InMemoryStore;
  private client: DeepBrainClient | null = null;
  private collection: string;
  private ready: Promise<boolean>;

  constructor(options: { collection?: string; config?: Record<string, unknown> } = {}) {
    this.fallback = new InMemoryStore();
    this.collection = options.collection ?? 'agent-memory';
    this.ready = this.initClient(options.config);
  }

  private async initClient(config?: Record<string, unknown>): Promise<boolean> {
    try {
      // @ts-ignore - dynamic optional dependency
      const deepbrain = await import(/* webpackIgnore: true */ 'deepbrain');
      this.client = (deepbrain as any).createClient?.(config) ?? (deepbrain as any).default?.createClient?.(config);
      if (!this.client) {
        console.warn('[DeepBrainMemory] Could not create client, using in-memory fallback');
        return false;
      }
      return true;
    } catch {
      console.warn('[DeepBrainMemory] deepbrain package not found, using in-memory fallback');
      return false;
    }
  }

  async get(key: string): Promise<unknown> {
    await this.ready;
    if (this.client) {
      try {
        const results = await this.client.search(this.collection, key, 1);
        return results[0]?.content;
      } catch {
        return this.fallback.get(key);
      }
    }
    return this.fallback.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.ready;
    if (this.client) {
      try {
        await this.client.store(this.collection, key, JSON.stringify(value));
        return;
      } catch { /* fallback */ }
    }
    return this.fallback.set(key, value);
  }

  async getConversation(sessionId: string): Promise<Message[]> {
    return this.fallback.getConversation(sessionId);
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    await this.fallback.addMessage(sessionId, message);
    // Also store in DeepBrain for semantic search
    await this.ready;
    if (this.client && message.role === 'user') {
      try {
        await this.client.store(this.collection, message.id, message.content, {
          sessionId,
          role: message.role,
          timestamp: message.timestamp,
        });
      } catch { /* non-critical */ }
    }
  }

  async clear(sessionId?: string): Promise<void> {
    await this.fallback.clear(sessionId);
    if (this.client && !sessionId) {
      try { await this.client.delete(this.collection); } catch { /* ignore */ }
    }
  }

  /**
   * Semantic search over stored memories.
   */
  async semanticSearch(query: string, limit: number = 5): Promise<Array<{ id: string; content: string; score: number }>> {
    await this.ready;
    if (this.client) {
      try {
        return await this.client.search(this.collection, query, limit);
      } catch { return []; }
    }
    return [];
  }

  isDeepBrainAvailable(): Promise<boolean> {
    return this.ready;
  }
}
