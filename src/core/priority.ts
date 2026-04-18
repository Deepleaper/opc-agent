// ─── Priority / Fast Mode ────────────────────────────────────
// Route requests through provider priority tiers for lower latency.
// Toggle via config or runtime command.

export interface PriorityConfig {
  /** Enable priority mode (default: false) */
  enabled: boolean;
  /** Provider-specific priority settings */
  providers?: PriorityProviderConfig[];
  /** Default priority tier */
  defaultTier?: PriorityTier;
}

export type PriorityTier = 'standard' | 'fast' | 'batch';

export interface PriorityProviderConfig {
  provider: string;
  tier: PriorityTier;
  /** Custom endpoint override for priority routing */
  endpoint?: string;
  /** Supported models for this tier */
  models?: string[];
}

interface PriorityHeaders {
  [key: string]: string;
}

// Known priority-capable providers and their routing
const PROVIDER_PRIORITY_MAP: Record<string, {
  headerKey: string;
  headerValue: Record<PriorityTier, string>;
  supportedModels: string[];
}> = {
  openai: {
    headerKey: 'X-OpenAI-Processing-Priority',
    headerValue: { fast: 'priority', standard: 'auto', batch: 'batch' },
    supportedModels: ['gpt-5', 'gpt-5.4', 'gpt-4.1', 'codex-*', 'o3-*', 'o4-mini*'],
  },
  anthropic: {
    headerKey: 'anthropic-priority',
    headerValue: { fast: 'high', standard: 'normal', batch: 'low' },
    supportedModels: ['claude-opus-*', 'claude-sonnet-*', 'claude-4*'],
  },
  google: {
    headerKey: 'X-Goog-Priority',
    headerValue: { fast: 'high', standard: 'normal', batch: 'low' },
    supportedModels: ['gemini-2.5-*', 'gemini-3-*'],
  },
};

export class PriorityRouter {
  private config: PriorityConfig;
  private runtimeTier: PriorityTier;

  constructor(config: PriorityConfig) {
    this.config = config;
    this.runtimeTier = config.defaultTier ?? 'standard';
  }

  /** Toggle fast mode on/off at runtime */
  toggle(): PriorityTier {
    this.runtimeTier = this.runtimeTier === 'fast' ? 'standard' : 'fast';
    return this.runtimeTier;
  }

  /** Set specific tier */
  setTier(tier: PriorityTier): void {
    this.runtimeTier = tier;
  }

  /** Get current tier */
  getTier(): PriorityTier {
    return this.runtimeTier;
  }

  /** Check if fast mode is active */
  isFast(): boolean {
    return this.runtimeTier === 'fast';
  }

  /**
   * Get priority headers for a provider + model combination.
   * Returns empty object if provider doesn't support priority or model isn't eligible.
   */
  getHeaders(provider: string, model: string): PriorityHeaders {
    if (!this.config.enabled) return {};

    const tier = this.getEffectiveTier(provider);
    if (tier === 'standard') return {};

    const providerMap = PROVIDER_PRIORITY_MAP[provider.toLowerCase()];
    if (!providerMap) return {};

    // Check model eligibility
    if (!this.isModelEligible(providerMap.supportedModels, model)) return {};

    return { [providerMap.headerKey]: providerMap.headerValue[tier] };
  }

  /**
   * Get effective endpoint for a provider, allowing priority-specific routing.
   */
  getEndpoint(provider: string, defaultEndpoint: string): string {
    const providerConfig = this.config.providers?.find(
      (p) => p.provider.toLowerCase() === provider.toLowerCase()
    );
    if (providerConfig?.endpoint && this.runtimeTier === 'fast') {
      return providerConfig.endpoint;
    }
    return defaultEndpoint;
  }

  private getEffectiveTier(provider: string): PriorityTier {
    // Check provider-specific override first
    const providerConfig = this.config.providers?.find(
      (p) => p.provider.toLowerCase() === provider.toLowerCase()
    );
    if (providerConfig) return providerConfig.tier;
    return this.runtimeTier;
  }

  private isModelEligible(patterns: string[], model: string): boolean {
    return patterns.some((pattern) => {
      if (pattern.endsWith('*')) {
        return model.startsWith(pattern.slice(0, -1));
      }
      return model === pattern;
    });
  }

  /** Status summary for dashboard / CLI */
  status(): { tier: PriorityTier; enabled: boolean; providers: string[] } {
    return {
      tier: this.runtimeTier,
      enabled: this.config.enabled,
      providers: Object.keys(PROVIDER_PRIORITY_MAP),
    };
  }
}
