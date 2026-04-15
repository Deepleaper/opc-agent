import { Logger } from '../core/logger';

// ── Connection Pool ─────────────────────────────────────────

export interface PooledConnection {
  id: string;
  provider: string;
  createdAt: number;
  lastUsedAt: number;
  inUse: boolean;
}

export class ConnectionPool {
  private pool: Map<string, PooledConnection[]> = new Map();
  private maxPerProvider: number;
  private ttlMs: number;
  private logger = new Logger('connection-pool');

  constructor(maxPerProvider = 5, ttlMs = 300000) {
    this.maxPerProvider = maxPerProvider;
    this.ttlMs = ttlMs;
  }

  acquire(provider: string): PooledConnection {
    const connections = this.pool.get(provider) ?? [];
    
    // Cleanup expired
    const now = Date.now();
    const active = connections.filter(c => now - c.createdAt < this.ttlMs);
    
    // Find available
    const available = active.find(c => !c.inUse);
    if (available) {
      available.inUse = true;
      available.lastUsedAt = now;
      return available;
    }

    // Create new if under limit
    if (active.length < this.maxPerProvider) {
      const conn: PooledConnection = {
        id: `conn_${now}_${Math.random().toString(36).slice(2, 8)}`,
        provider,
        createdAt: now,
        lastUsedAt: now,
        inUse: true,
      };
      active.push(conn);
      this.pool.set(provider, active);
      return conn;
    }

    // Wait for one (return oldest used for now)
    const oldest = active.sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0];
    oldest.inUse = true;
    oldest.lastUsedAt = now;
    return oldest;
  }

  release(id: string): void {
    for (const connections of this.pool.values()) {
      const conn = connections.find(c => c.id === id);
      if (conn) {
        conn.inUse = false;
        return;
      }
    }
  }

  getStats(): Record<string, { total: number; inUse: number }> {
    const stats: Record<string, { total: number; inUse: number }> = {};
    for (const [provider, connections] of this.pool) {
      stats[provider] = {
        total: connections.length,
        inUse: connections.filter(c => c.inUse).length,
      };
    }
    return stats;
  }

  drain(): void {
    this.pool.clear();
  }
}

// ── Request Batcher ─────────────────────────────────────────

export interface BatchRequest<T> {
  payload: T;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

export class RequestBatcher<T> {
  private queue: BatchRequest<T>[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private maxBatchSize: number;
  private delayMs: number;
  private processor: (batch: T[]) => Promise<unknown[]>;
  private logger = new Logger('batcher');

  constructor(
    processor: (batch: T[]) => Promise<unknown[]>,
    maxBatchSize = 10,
    delayMs = 50,
  ) {
    this.processor = processor;
    this.maxBatchSize = maxBatchSize;
    this.delayMs = delayMs;
  }

  add(payload: T): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.queue.push({ payload, resolve, reject });

      if (this.queue.length >= this.maxBatchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.delayMs);
      }
    });
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.maxBatchSize);
    try {
      const results = await this.processor(batch.map(b => b.payload));
      batch.forEach((req, i) => req.resolve(results[i]));
    } catch (err) {
      batch.forEach(req => req.reject(err as Error));
    }
  }

  get pending(): number {
    return this.queue.length;
  }
}

// ── Lazy Loader ─────────────────────────────────────────────

export class LazyLoader<T> {
  private cache: Map<string, T> = new Map();
  private loaders: Map<string, () => Promise<T>> = new Map();

  register(name: string, loader: () => Promise<T>): void {
    this.loaders.set(name, loader);
  }

  async get(name: string): Promise<T> {
    const cached = this.cache.get(name);
    if (cached) return cached;

    const loader = this.loaders.get(name);
    if (!loader) throw new Error(`No loader registered for "${name}"`);

    const instance = await loader();
    this.cache.set(name, instance);
    return instance;
  }

  isLoaded(name: string): boolean {
    return this.cache.has(name);
  }

  evict(name: string): void {
    this.cache.delete(name);
  }

  clear(): void {
    this.cache.clear();
  }

  get loadedCount(): number {
    return this.cache.size;
  }

  get registeredCount(): number {
    return this.loaders.size;
  }
}
