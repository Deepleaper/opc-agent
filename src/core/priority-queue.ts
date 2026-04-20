/**
 * Priority Queue / Fast Mode — Route requests through priority tiers
 * for lower latency on supported providers.
 *
 * Inspired by Hermes Agent's /fast mode. Provides a priority-aware request
 * queue that separates normal and fast-mode requests, ensuring fast-mode
 * requests are processed first and routed to provider priority endpoints.
 *
 * Usage:
 *   const pq = new PriorityQueue();
 *   pq.enqueue({ id: 'req1', priority: 'fast', provider: 'openai', ... });
 *   const next = pq.dequeue(); // Always returns highest priority first
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────────

export type PriorityLevel = 'fast' | 'normal' | 'batch';

export interface PriorityRequest {
  id: string;
  priority: PriorityLevel;
  provider: string;
  model: string;
  payload: unknown;
  enqueuedAt: number;
  metadata?: Record<string, unknown>;
}

export interface PriorityConfig {
  /** Maximum concurrent fast-mode requests per provider */
  maxConcurrentFast?: number;
  /** Maximum concurrent normal requests per provider */
  maxConcurrentNormal?: number;
  /** Timeout for fast-mode requests before fallback (ms, default 30s) */
  fastTimeout?: number;
  /** Providers that support priority routing */
  supportedProviders?: string[];
}

export interface ProviderPriorityEndpoint {
  provider: string;
  priorityUrl?: string;
  priorityHeader?: { key: string; value: string };
  priorityParam?: { key: string; value: string };
}

// ─── Priority weights ────────────────────────────────────────

const PRIORITY_WEIGHTS: Record<PriorityLevel, number> = {
  fast: 3,
  normal: 2,
  batch: 1,
};

// ─── Default supported providers ─────────────────────────────

const DEFAULT_PRIORITY_ENDPOINTS: ProviderPriorityEndpoint[] = [
  {
    provider: 'openai',
    priorityHeader: { key: 'X-Priority', value: 'high' },
  },
  {
    provider: 'anthropic',
    priorityHeader: { key: 'anthropic-priority', value: 'fast' },
  },
  {
    provider: 'google',
    priorityParam: { key: 'priority', value: 'high' },
  },
];

// ─── PriorityQueue ───────────────────────────────────────────

export class PriorityQueue extends EventEmitter {
  private queues: Map<PriorityLevel, PriorityRequest[]> = new Map([
    ['fast', []],
    ['normal', []],
    ['batch', []],
  ]);

  private activeCounts: Map<string, { fast: number; normal: number; batch: number }> = new Map();
  private config: Required<PriorityConfig>;
  private endpoints: Map<string, ProviderPriorityEndpoint> = new Map();

  constructor(config?: PriorityConfig) {
    super();
    this.config = {
      maxConcurrentFast: config?.maxConcurrentFast ?? 5,
      maxConcurrentNormal: config?.maxConcurrentNormal ?? 10,
      fastTimeout: config?.fastTimeout ?? 30_000,
      supportedProviders: config?.supportedProviders ?? ['openai', 'anthropic', 'google'],
    };

    for (const ep of DEFAULT_PRIORITY_ENDPOINTS) {
      this.endpoints.set(ep.provider, ep);
    }
  }

  /** Register a custom priority endpoint for a provider */
  registerEndpoint(endpoint: ProviderPriorityEndpoint): void {
    this.endpoints.set(endpoint.provider, endpoint);
    if (!this.config.supportedProviders.includes(endpoint.provider)) {
      this.config.supportedProviders.push(endpoint.provider);
    }
  }

  /** Check if a provider supports priority routing */
  supportsPriority(provider: string): boolean {
    return this.config.supportedProviders.includes(provider);
  }

  /** Get priority endpoint configuration for a provider */
  getEndpoint(provider: string): ProviderPriorityEndpoint | undefined {
    return this.endpoints.get(provider);
  }

  /** Enqueue a request */
  enqueue(request: PriorityRequest): void {
    const queue = this.queues.get(request.priority);
    if (!queue) throw new Error(`Invalid priority: ${request.priority}`);
    queue.push(request);
    this.emit('enqueue', request);
  }

  /** Dequeue the next highest-priority request that can run */
  dequeue(): PriorityRequest | undefined {
    for (const level of ['fast', 'normal', 'batch'] as PriorityLevel[]) {
      const queue = this.queues.get(level)!;
      if (queue.length === 0) continue;

      const request = queue[0];
      if (this.canRun(request)) {
        queue.shift();
        this.incrementActive(request.provider, level);
        this.emit('dequeue', request);
        return request;
      }
    }
    return undefined;
  }

  /** Mark a request as completed, freeing a concurrency slot */
  complete(provider: string, priority: PriorityLevel): void {
    const counts = this.activeCounts.get(provider);
    if (counts && counts[priority] > 0) {
      counts[priority]--;
    }
    this.emit('complete', { provider, priority });
  }

  /** Get queue lengths */
  getStats(): {
    fast: number;
    normal: number;
    batch: number;
    total: number;
    active: Record<string, { fast: number; normal: number; batch: number }>;
  } {
    const fast = this.queues.get('fast')!.length;
    const normal = this.queues.get('normal')!.length;
    const batch = this.queues.get('batch')!.length;
    const active: Record<string, { fast: number; normal: number; batch: number }> = {};
    for (const [k, v] of this.activeCounts) {
      active[k] = { ...v };
    }
    return { fast, normal, batch, total: fast + normal + batch, active };
  }

  /** Drain all requests (for shutdown) */
  drain(): PriorityRequest[] {
    const all: PriorityRequest[] = [];
    for (const [, queue] of this.queues) {
      all.push(...queue.splice(0));
    }
    return all;
  }

  /** Determine effective priority for a request (auto-upgrade/downgrade) */
  static resolvePriority(
    requested: PriorityLevel,
    provider: string,
    supportedProviders: string[],
  ): PriorityLevel {
    // If provider doesn't support fast mode, downgrade to normal
    if (requested === 'fast' && !supportedProviders.includes(provider)) {
      return 'normal';
    }
    return requested;
  }

  private canRun(request: PriorityRequest): boolean {
    const counts = this.activeCounts.get(request.provider) ?? { fast: 0, normal: 0, batch: 0 };
    const max =
      request.priority === 'fast'
        ? this.config.maxConcurrentFast
        : this.config.maxConcurrentNormal;
    return counts[request.priority] < max;
  }

  private incrementActive(provider: string, priority: PriorityLevel): void {
    if (!this.activeCounts.has(provider)) {
      this.activeCounts.set(provider, { fast: 0, normal: 0, batch: 0 });
    }
    this.activeCounts.get(provider)![priority]++;
  }
}

// ─── Fast Mode Session State ─────────────────────────────────

/**
 * Tracks per-session fast mode toggle (like /fast command).
 */
export class FastModeManager {
  private sessions: Map<string, boolean> = new Map();

  /** Toggle fast mode for a session, returns new state */
  toggle(sessionId: string): boolean {
    const current = this.sessions.get(sessionId) ?? false;
    const next = !current;
    this.sessions.set(sessionId, next);
    return next;
  }

  /** Set fast mode explicitly */
  set(sessionId: string, enabled: boolean): void {
    this.sessions.set(sessionId, enabled);
  }

  /** Check if session has fast mode enabled */
  isEnabled(sessionId: string): boolean {
    return this.sessions.get(sessionId) ?? false;
  }

  /** Get priority level for a session */
  getPriority(sessionId: string): PriorityLevel {
    return this.isEnabled(sessionId) ? 'fast' : 'normal';
  }

  /** Clear all state */
  reset(): void {
    this.sessions.clear();
  }
}
