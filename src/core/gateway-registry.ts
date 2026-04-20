/**
 * Tool Gateway — Remote managed tool provider pattern.
 *
 * Inspired by Hermes Agent v0.10's Tool Gateway feature.
 * Allows agents to access remote tool services (web search, image gen, TTS,
 * browser automation) through a unified gateway, removing the need for
 * individual API keys per tool.
 *
 * Key features:
 * - Subscription-based tool access (single API key → multiple tools)
 * - Per-tool opt-in/opt-out via configuration
 * - Auto-detection of gateway availability
 * - Fallback to direct API keys when gateway unavailable
 * - Usage tracking and quota enforcement
 *
 * Usage:
 *   const gw = new ToolGateway({ endpoint: 'https://tools.example.com', apiKey: '...' });
 *   await gw.connect();
 *   const result = await gw.invoke('web-search', { query: 'hello' });
 */

import { EventEmitter } from 'events';
import { Logger } from './logger';

// ─── Types ───────────────────────────────────────────────────

export interface ToolGatewayConfig {
  /** Gateway endpoint URL */
  endpoint: string;
  /** API key / subscription token for the gateway */
  apiKey: string;
  /** Tools to enable (empty = all available) */
  enabledTools?: string[];
  /** Timeout for gateway calls (ms, default 60s) */
  timeout?: number;
  /** Whether to prefer gateway over direct API keys */
  preferGateway?: boolean;
  /** Retry config */
  retry?: { maxRetries?: number; backoffMs?: number };
}

export interface GatewayTool {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  category: 'search' | 'generation' | 'browser' | 'tts' | 'utility' | string;
  quotaRemaining?: number;
  available: boolean;
}

export interface GatewayInvocation {
  toolId: string;
  input: Record<string, unknown>;
  requestId?: string;
}

export interface GatewayResult {
  toolId: string;
  requestId: string;
  status: 'success' | 'error' | 'quota_exceeded' | 'unavailable';
  output?: unknown;
  error?: string;
  durationMs: number;
  quotaRemaining?: number;
}

export interface GatewayStatus {
  connected: boolean;
  endpoint: string;
  tools: GatewayTool[];
  subscription?: {
    tier: string;
    quotaUsed: number;
    quotaTotal: number;
    resetAt?: string;
  };
}

// ─── Tool Gateway ────────────────────────────────────────────

export class ToolGateway extends EventEmitter {
  private config: Required<ToolGatewayConfig>;
  private tools: Map<string, GatewayTool> = new Map();
  private connected = false;
  private logger = new Logger('tool-gateway');
  private invocationCount = 0;

  constructor(config: ToolGatewayConfig) {
    super();
    this.config = {
      endpoint: config.endpoint.replace(/\/$/, ''),
      apiKey: config.apiKey,
      enabledTools: config.enabledTools ?? [],
      timeout: config.timeout ?? 60_000,
      preferGateway: config.preferGateway ?? true,
      retry: {
        maxRetries: config.retry?.maxRetries ?? 2,
        backoffMs: config.retry?.backoffMs ?? 1000,
      },
    };
  }

  /** Connect to gateway and discover available tools */
  async connect(): Promise<GatewayStatus> {
    try {
      const res = await this.request('GET', '/tools');
      const data = res as { tools: GatewayTool[]; subscription?: GatewayStatus['subscription'] };

      this.tools.clear();
      for (const tool of data.tools) {
        // If enabledTools is specified, only include those
        if (
          this.config.enabledTools.length === 0 ||
          this.config.enabledTools.includes(tool.id)
        ) {
          this.tools.set(tool.id, tool);
        }
      }

      this.connected = true;
      this.logger.info('Connected to tool gateway', {
        endpoint: this.config.endpoint,
        tools: this.tools.size,
      });
      this.emit('connected', this.getStatus());

      return {
        connected: true,
        endpoint: this.config.endpoint,
        tools: Array.from(this.tools.values()),
        subscription: data.subscription,
      };
    } catch (err) {
      this.connected = false;
      this.logger.error('Failed to connect to tool gateway', {
        error: (err as Error).message,
      });
      throw err;
    }
  }

  /** Invoke a tool through the gateway */
  async invoke(toolId: string, input: Record<string, unknown>): Promise<GatewayResult> {
    if (!this.connected) {
      throw new Error('Tool gateway not connected. Call connect() first.');
    }

    const tool = this.tools.get(toolId);
    if (!tool) {
      return {
        toolId,
        requestId: this.generateRequestId(),
        status: 'unavailable',
        error: `Tool "${toolId}" not available on this gateway`,
        durationMs: 0,
      };
    }

    if (!tool.available) {
      return {
        toolId,
        requestId: this.generateRequestId(),
        status: 'unavailable',
        error: `Tool "${toolId}" is currently unavailable`,
        durationMs: 0,
      };
    }

    const requestId = this.generateRequestId();
    const start = Date.now();

    try {
      const result = await this.request('POST', '/invoke', {
        toolId,
        input,
        requestId,
      });

      const durationMs = Date.now() - start;
      this.invocationCount++;

      const gatewayResult: GatewayResult = {
        toolId,
        requestId,
        status: 'success',
        output: (result as any).output,
        durationMs,
        quotaRemaining: (result as any).quotaRemaining,
      };

      // Update quota info
      if (gatewayResult.quotaRemaining !== undefined) {
        tool.quotaRemaining = gatewayResult.quotaRemaining;
      }

      this.emit('invocation', gatewayResult);
      return gatewayResult;
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = (err as Error).message;

      const status = message.includes('quota') ? 'quota_exceeded' : 'error';
      const gatewayResult: GatewayResult = {
        toolId,
        requestId,
        status,
        error: message,
        durationMs,
      };

      this.emit('invocation:error', gatewayResult);
      return gatewayResult;
    }
  }

  /** Get a tool definition (for MCP/tool schema exposure) */
  getTool(toolId: string): GatewayTool | undefined {
    return this.tools.get(toolId);
  }

  /** List all available tools */
  listTools(): GatewayTool[] {
    return Array.from(this.tools.values());
  }

  /** Get current status */
  getStatus(): GatewayStatus {
    return {
      connected: this.connected,
      endpoint: this.config.endpoint,
      tools: Array.from(this.tools.values()),
    };
  }

  /** Check if gateway should be preferred over direct API call */
  shouldUseGateway(toolId: string): boolean {
    if (!this.connected) return false;
    if (!this.config.preferGateway) return false;
    const tool = this.tools.get(toolId);
    if (!tool || !tool.available) return false;
    if (tool.quotaRemaining !== undefined && tool.quotaRemaining <= 0) return false;
    return true;
  }

  /** Disconnect from gateway */
  disconnect(): void {
    this.connected = false;
    this.tools.clear();
    this.emit('disconnected');
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get totalInvocations(): number {
    return this.invocationCount;
  }

  // ─── Private helpers ─────────────────────────────────────────

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = `${this.config.endpoint}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeout);

    let lastError: Error | undefined;
    const maxAttempts = 1 + this.config.retry.maxRetries;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
            'X-Client': 'opc-agent',
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(`Gateway ${res.status}: ${errBody || res.statusText}`);
        }

        return await res.json();
      } catch (err) {
        lastError = err as Error;
        if (attempt < maxAttempts - 1) {
          await new Promise(r =>
            setTimeout(r, this.config.retry.backoffMs * (attempt + 1)),
          );
        }
      }
    }

    clearTimeout(timer);
    throw lastError!;
  }

  private generateRequestId(): string {
    return `gw_${++this.invocationCount}_${Date.now().toString(36)}`;
  }
}

// ─── Tool Gateway Registry (multi-gateway support) ───────────

export class ToolGatewayRegistry {
  private gateways: Map<string, ToolGateway> = new Map();
  private toolToGateway: Map<string, string> = new Map();
  private logger = new Logger('tool-gateway-registry');

  /** Register a gateway */
  register(name: string, gateway: ToolGateway): void {
    this.gateways.set(name, gateway);
    // Index tools → gateway
    for (const tool of gateway.listTools()) {
      this.toolToGateway.set(tool.id, name);
    }
    this.logger.info('Gateway registered', { name, tools: gateway.listTools().length });
  }

  /** Find which gateway provides a tool */
  findGateway(toolId: string): ToolGateway | undefined {
    const name = this.toolToGateway.get(toolId);
    return name ? this.gateways.get(name) : undefined;
  }

  /** Invoke a tool, auto-routing to the right gateway */
  async invoke(toolId: string, input: Record<string, unknown>): Promise<GatewayResult> {
    const gateway = this.findGateway(toolId);
    if (!gateway) {
      return {
        toolId,
        requestId: 'none',
        status: 'unavailable',
        error: `No gateway provides tool "${toolId}"`,
        durationMs: 0,
      };
    }
    return gateway.invoke(toolId, input);
  }

  /** List all tools across all gateways */
  listAllTools(): Array<GatewayTool & { gateway: string }> {
    const result: Array<GatewayTool & { gateway: string }> = [];
    for (const [name, gw] of this.gateways) {
      for (const tool of gw.listTools()) {
        result.push({ ...tool, gateway: name });
      }
    }
    return result;
  }

  /** Disconnect all gateways */
  disconnectAll(): void {
    for (const gw of this.gateways.values()) {
      gw.disconnect();
    }
    this.gateways.clear();
    this.toolToGateway.clear();
  }
}
