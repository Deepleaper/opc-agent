/**
 * Caching Layer - Cache LLM responses with configurable TTL.
 * Hash-based key from input messages + system prompt.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface CacheEntry {
  key: string;
  value: string;
  createdAt: number;
  ttlMs: number;
  hits: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttlMs: number; // default TTL
  maxEntries: number;
  dataDir: string;
}

export class LLMCache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private filePath: string;
  private stats = { hits: 0, misses: 0, evictions: 0 };

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      ttlMs: config?.ttlMs ?? 3600_000, // 1 hour default
      maxEntries: config?.maxEntries ?? 1000,
      dataDir: config?.dataDir ?? '.',
    };
    this.filePath = path.join(this.config.dataDir, 'data', 'cache.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const entries: CacheEntry[] = JSON.parse(raw);
        for (const entry of entries) {
          if (!this.isExpired(entry)) {
            this.cache.set(entry.key, entry);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  private save(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const entries = Array.from(this.cache.values());
    fs.writeFileSync(this.filePath, JSON.stringify(entries));
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.createdAt > entry.ttlMs;
  }

  /**
   * Generate a cache key from messages and system prompt.
   */
  static makeKey(messages: Array<{ role: string; content: string }>, systemPrompt?: string): string {
    const payload = JSON.stringify({ systemPrompt, messages: messages.map(m => ({ role: m.role, content: m.content })) });
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
  }

  /**
   * Get a cached response. Returns null if not found or expired.
   */
  get(key: string): string | null {
    if (!this.config.enabled) return null;
    const entry = this.cache.get(key);
    if (!entry || this.isExpired(entry)) {
      if (entry) {
        this.cache.delete(key);
        this.stats.evictions++;
      }
      this.stats.misses++;
      return null;
    }
    entry.hits++;
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a cached response.
   */
  set(key: string, value: string, ttlMs?: number): void {
    if (!this.config.enabled) return;

    // Evict oldest if at capacity
    if (this.cache.size >= this.config.maxEntries) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [k, v] of this.cache) {
        if (v.createdAt < oldestTime) {
          oldestTime = v.createdAt;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      }
    }

    this.cache.set(key, {
      key,
      value,
      createdAt: Date.now(),
      ttlMs: ttlMs ?? this.config.ttlMs,
      hits: 0,
    });
    this.save();
  }

  getStats(): { hits: number; misses: number; evictions: number; size: number; hitRate: string } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? `${((this.stats.hits / total) * 100).toFixed(1)}%` : '0%',
    };
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    this.save();
  }
}
