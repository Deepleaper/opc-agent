// ─── Fast Mode Router ────────────────────────────────────────
// Higher-level fast mode abstraction on top of PriorityRouter.
// Routes requests through priority queues for lower latency on supported models.

export interface FastModeConfig {
  enabled: boolean;
  supportedModels: string[];
  priorityTier: 'standard' | 'fast' | 'turbo';
}

export interface FastModeStats {
  requestsRouted: number;
  avgLatencySavingMs: number;
}

export class FastModeRouter {
  private config: FastModeConfig;
  private requestsRouted: number = 0;
  private totalLatencySavingMs: number = 0;

  constructor(config: FastModeConfig) {
    this.config = { ...config };
  }

  /** Check if a model supports fast mode */
  isSupported(model: string): boolean {
    return this.config.supportedModels.some((pattern) => {
      if (pattern.endsWith('*')) {
        return model.startsWith(pattern.slice(0, -1));
      }
      return model === pattern;
    });
  }

  /**
   * Get the fast-mode endpoint for a model.
   * Appends /fast suffix or priority query param based on tier.
   */
  getEndpoint(model: string, baseEndpoint: string): string {
    if (!this.config.enabled || !this.isSupported(model)) {
      return baseEndpoint;
    }

    this.requestsRouted++;
    // Estimate ~120ms saving for fast, ~200ms for turbo
    this.totalLatencySavingMs += this.config.priorityTier === 'turbo' ? 200 : 120;

    const separator = baseEndpoint.includes('?') ? '&' : '?';

    if (this.config.priorityTier === 'turbo') {
      // Turbo uses a dedicated /fast path
      const url = baseEndpoint.replace(/\/$/, '');
      return `${url}/fast`;
    }

    // Fast tier uses query param
    return `${baseEndpoint}${separator}priority=${this.config.priorityTier}`;
  }

  /** Toggle enabled state, return new state */
  toggle(): boolean {
    this.config.enabled = !this.config.enabled;
    return this.config.enabled;
  }

  /** Get routing stats */
  getStats(): FastModeStats {
    return {
      requestsRouted: this.requestsRouted,
      avgLatencySavingMs: this.requestsRouted > 0
        ? Math.round(this.totalLatencySavingMs / this.requestsRouted)
        : 0,
    };
  }
}
