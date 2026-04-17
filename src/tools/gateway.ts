import type { AgentContext } from '../core/types';
import type { MCPTool, MCPToolDefinition, MCPToolResult } from './mcp';

// ─── Gateway Types ───────────────────────────────────────────

export interface ToolGatewayConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  enabledTools?: GatewayToolName[];
  timeout?: number;
}

export type GatewayToolName = 'web-search' | 'image-gen' | 'tts' | 'browser';

interface GatewayToolMeta {
  name: GatewayToolName;
  description: string;
  inputSchema: Record<string, unknown>;
  available: boolean;
}

interface GatewayResponse {
  content: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ─── Gateway Tool Wrapper ────────────────────────────────────

class GatewayTool implements MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;

  constructor(
    private gateway: ToolGateway,
    private meta: GatewayToolMeta,
  ) {
    this.name = `gateway:${meta.name}`;
    this.description = `[Gateway] ${meta.description}`;
    this.inputSchema = meta.inputSchema;
  }

  async execute(input: Record<string, unknown>, _context?: AgentContext): Promise<MCPToolResult> {
    return this.gateway.invokeTool(this.meta.name, input);
  }
}

// ─── Default Tool Definitions ────────────────────────────────

const DEFAULT_TOOL_DEFS: GatewayToolMeta[] = [
  {
    name: 'web-search',
    description: 'Search the web and return results',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        count: { type: 'number', description: 'Number of results (1-10)' },
      },
      required: ['query'],
    },
    available: true,
  },
  {
    name: 'image-gen',
    description: 'Generate images from text prompts',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Image generation prompt' },
        size: { type: 'string', description: 'Image size (e.g. 1024x1024)' },
      },
      required: ['prompt'],
    },
    available: true,
  },
  {
    name: 'tts',
    description: 'Convert text to speech audio',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to synthesize' },
        voice: { type: 'string', description: 'Voice identifier' },
      },
      required: ['text'],
    },
    available: true,
  },
  {
    name: 'browser',
    description: 'Automated browser actions — navigate, screenshot, extract content',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action: navigate | screenshot | extract' },
        url: { type: 'string', description: 'Target URL' },
        selector: { type: 'string', description: 'CSS selector for extraction' },
      },
      required: ['action', 'url'],
    },
    available: true,
  },
];

// ─── ToolGateway ─────────────────────────────────────────────

export class ToolGateway {
  private config: ToolGatewayConfig;
  private availableTools: Map<GatewayToolName, GatewayToolMeta> = new Map();
  private connected = false;

  constructor(config: ToolGatewayConfig) {
    this.config = {
      timeout: 30_000,
      ...config,
    };
  }

  /** Discover available tools from the gateway endpoint. */
  async connect(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const res = await fetch(`${this.config.endpoint}/tools`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!res.ok) {
        throw new Error(`Gateway returned ${res.status}`);
      }

      const data = (await res.json()) as { tools: GatewayToolMeta[] };
      const enabledSet = this.config.enabledTools
        ? new Set(this.config.enabledTools)
        : null;

      for (const tool of data.tools) {
        if (!enabledSet || enabledSet.has(tool.name)) {
          this.availableTools.set(tool.name, tool);
        }
      }
      this.connected = true;
    } catch {
      // Auto-detect failed — fall back to default definitions
      this.loadDefaults();
      this.connected = false;
    }
  }

  /** Load default tool definitions (used as fallback). */
  private loadDefaults(): void {
    const enabledSet = this.config.enabledTools
      ? new Set(this.config.enabledTools)
      : null;

    for (const def of DEFAULT_TOOL_DEFS) {
      if (!enabledSet || enabledSet.has(def.name)) {
        this.availableTools.set(def.name, def);
      }
    }
  }

  /** Invoke a tool through the gateway. */
  async invokeTool(name: GatewayToolName, input: Record<string, unknown>): Promise<MCPToolResult> {
    try {
      const res = await fetch(`${this.config.endpoint}/tools/${name}/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({ input }),
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!res.ok) {
        return { content: `Gateway error: HTTP ${res.status}`, isError: true };
      }

      const data = (await res.json()) as GatewayResponse;
      if (data.error) {
        return { content: data.error, isError: true, metadata: data.metadata };
      }
      return { content: data.content, metadata: data.metadata };
    } catch (err) {
      return {
        content: `Gateway invocation failed: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  }

  /** Get all gateway tools as MCPTool instances for registry integration. */
  getTools(): MCPTool[] {
    return Array.from(this.availableTools.values()).map(
      (meta) => new GatewayTool(this, meta),
    );
  }

  /** Get tool definitions (without execute). */
  listTools(): MCPToolDefinition[] {
    return Array.from(this.availableTools.values()).map(({ name, description, inputSchema }) => ({
      name: `gateway:${name}`,
      description: `[Gateway] ${description}`,
      inputSchema,
    }));
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get toolCount(): number {
    return this.availableTools.size;
  }
}
