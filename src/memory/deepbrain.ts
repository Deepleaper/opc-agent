import type { Message, MemoryStore } from '../core/types';
import { InMemoryStore } from './index';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

/**
 * 本地 JSON 文件持久化存储，作为 DeepBrain 不可用时的 fallback。
 * 数据保存在 .opc/memory.json，进程重启后记忆不会丢失。
 */
class FileBackedStore implements MemoryStore {
  private store: Map<string, unknown> = new Map();
  private conversations: Map<string, Message[]> = new Map();
  private filePath: string;
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(baseDir: string = '.') {
    const opcDir = join(resolve(baseDir), '.opc');
    if (!existsSync(opcDir)) mkdirSync(opcDir, { recursive: true });
    this.filePath = join(opcDir, 'memory.json');
    this.loadFromFile();
  }

  private loadFromFile(): void {
    if (!existsSync(this.filePath)) return;
    try {
      const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));
      if (data.store) {
        for (const [k, v] of Object.entries(data.store)) {
          this.store.set(k, v);
        }
      }
      if (data.conversations) {
        for (const [k, v] of Object.entries(data.conversations)) {
          this.conversations.set(k, v as Message[]);
        }
      }
    } catch { /* 文件损坏则忽略，从空开始 */ }
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer) return; // 已经有定时器在等了
    // 延迟 1 秒批量写入，避免高频写磁盘
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      if (this.dirty) this.saveToFile();
    }, 1000);
  }

  private saveToFile(): void {
    try {
      const data = {
        store: Object.fromEntries(this.store),
        conversations: Object.fromEntries(this.conversations),
        updatedAt: new Date().toISOString(),
      };
      writeFileSync(this.filePath, JSON.stringify(data, null, 2));
      this.dirty = false;
    } catch { /* 写入失败不影响运行 */ }
  }

  async get(key: string): Promise<unknown> {
    return this.store.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
    this.scheduleSave();
  }

  async getConversation(sessionId: string): Promise<Message[]> {
    return this.conversations.get(sessionId) ?? [];
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, []);
    }
    const conv = this.conversations.get(sessionId)!;
    conv.push(message);
    // 每个 session 最多保留 200 条消息，避免文件无限增长
    if (conv.length > 200) conv.splice(0, conv.length - 200);
    this.scheduleSave();
  }

  async clear(sessionId?: string): Promise<void> {
    if (sessionId) {
      this.conversations.delete(sessionId);
    } else {
      this.store.clear();
      this.conversations.clear();
    }
    this.scheduleSave();
  }
}

/**
 * DeepBrain-backed memory store for long-term semantic memory.
 * Falls back to local JSON file storage (.opc/memory.json) if deepbrain package is not installed.
 */
export interface DeepBrainClient {
  store(collection: string, id: string, content: string, metadata?: Record<string, unknown>): Promise<void>;
  search(collection: string, query: string, limit?: number): Promise<Array<{ id: string; content: string; score: number }>>;
  delete(collection: string, id?: string): Promise<void>;
}

export class DeepBrainMemoryStore implements MemoryStore {
  private fallback: FileBackedStore;
  private client: DeepBrainClient | null = null;
  private collection: string;
  private ready: Promise<boolean>;

  constructor(options: { collection?: string; config?: Record<string, unknown> } = {}) {
    this.fallback = new FileBackedStore();
    this.collection = options.collection ?? 'agent-memory';
    this.ready = this.initClient(options.config);
  }

  private async initClient(config?: Record<string, unknown>): Promise<boolean> {
    try {
      // @ts-ignore - dynamic optional dependency
      const deepbrain = await import(/* webpackIgnore: true */ 'deepbrain');
      this.client = (deepbrain as any).createClient?.(config) ?? (deepbrain as any).default?.createClient?.(config);
      if (!this.client) {
        console.warn('[DeepBrainMemory] Could not create client, using file-backed fallback (.opc/memory.json)');
        return false;
      }
      return true;
    } catch {
      console.warn('[DeepBrainMemory] deepbrain package not found, using file-backed fallback (.opc/memory.json)');
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
