/**
 * Rate Limiter - Per-user and per-provider rate limiting with queuing.
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  timestamps: number[];
  queue: Array<{ resolve: () => void; reject: (err: Error) => void }>;
}

export class RateLimiter {
  private userLimits: Map<string, RateLimitEntry> = new Map();
  private providerLimits: Map<string, RateLimitEntry> = new Map();
  private userConfig: RateLimitConfig;
  private providerConfig: RateLimitConfig;
  private maxQueueSize: number;

  constructor(opts?: {
    userLimit?: RateLimitConfig;
    providerLimit?: RateLimitConfig;
    maxQueueSize?: number;
  }) {
    this.userConfig = opts?.userLimit ?? { maxRequests: 60, windowMs: 60_000 };
    this.providerConfig = opts?.providerLimit ?? { maxRequests: 100, windowMs: 60_000 };
    this.maxQueueSize = opts?.maxQueueSize ?? 50;
  }

  /**
   * Check if a request is allowed. If not, queues it with backpressure.
   * Returns a promise that resolves when the request can proceed.
   */
  async acquire(userId: string, provider: string): Promise<void> {
    await this.checkLimit(userId, this.userLimits, this.userConfig, 'user');
    await this.checkLimit(provider, this.providerLimits, this.providerConfig, 'provider');
  }

  private async checkLimit(
    key: string,
    limits: Map<string, RateLimitEntry>,
    config: RateLimitConfig,
    type: string,
  ): Promise<void> {
    let entry = limits.get(key);
    if (!entry) {
      entry = { timestamps: [], queue: [] };
      limits.set(key, entry);
    }

    const now = Date.now();
    // Prune old timestamps
    entry.timestamps = entry.timestamps.filter(t => t > now - config.windowMs);

    if (entry.timestamps.length < config.maxRequests) {
      entry.timestamps.push(now);
      return;
    }

    // Rate limited - queue with backpressure
    if (entry.queue.length >= this.maxQueueSize) {
      throw new Error(`Rate limit exceeded for ${type} "${key}" and queue is full (${this.maxQueueSize})`);
    }

    return new Promise<void>((resolve, reject) => {
      entry!.queue.push({ resolve, reject });
      // Set timeout to process queue when window expires
      const oldestTs = entry!.timestamps[0];
      const waitMs = oldestTs + config.windowMs - now + 10;
      setTimeout(() => {
        this.processQueue(key, limits, config);
      }, Math.max(waitMs, 100));
    });
  }

  private processQueue(
    key: string,
    limits: Map<string, RateLimitEntry>,
    config: RateLimitConfig,
  ): void {
    const entry = limits.get(key);
    if (!entry || entry.queue.length === 0) return;

    const now = Date.now();
    entry.timestamps = entry.timestamps.filter(t => t > now - config.windowMs);

    while (entry.queue.length > 0 && entry.timestamps.length < config.maxRequests) {
      entry.timestamps.push(now);
      const item = entry.queue.shift()!;
      item.resolve();
    }
  }

  /**
   * Get current usage stats.
   */
  getUsage(userId?: string, provider?: string): {
    user?: { used: number; limit: number; windowMs: number };
    provider?: { used: number; limit: number; windowMs: number };
  } {
    const now = Date.now();
    const result: any = {};

    if (userId) {
      const entry = this.userLimits.get(userId);
      const used = entry ? entry.timestamps.filter(t => t > now - this.userConfig.windowMs).length : 0;
      result.user = { used, limit: this.userConfig.maxRequests, windowMs: this.userConfig.windowMs };
    }

    if (provider) {
      const entry = this.providerLimits.get(provider);
      const used = entry ? entry.timestamps.filter(t => t > now - this.providerConfig.windowMs).length : 0;
      result.provider = { used, limit: this.providerConfig.maxRequests, windowMs: this.providerConfig.windowMs };
    }

    return result;
  }

  /**
   * Reset all limits.
   */
  reset(): void {
    this.userLimits.clear();
    this.providerLimits.clear();
  }
}
