import type { ISkill, IChannel, Message } from '../core/types';
import type { MCPTool } from '../tools/mcp';
import { Logger } from '../core/logger';

/**
 * Plugin lifecycle hooks - v1.0.0
 */
export interface PluginHooks {
  onInit?: () => Promise<void>;
  onMessage?: (message: Message) => Promise<Message | void>;
  onResponse?: (message: Message, response: Message) => Promise<Message | void>;
  onError?: (error: Error, context?: Record<string, unknown>) => Promise<void>;
  onShutdown?: () => Promise<void>;
  // Legacy aliases
  beforeInit?: () => Promise<void>;
  afterInit?: () => Promise<void>;
  beforeMessage?: (message: { content: string }) => Promise<void>;
  afterMessage?: (message: { content: string }, response: { content: string }) => Promise<void>;
  beforeShutdown?: () => Promise<void>;
}

/**
 * Plugin manifest in OAD: plugins: [{ name, config }]
 */
export interface PluginManifest {
  name: string;
  config?: Record<string, unknown>;
}

/**
 * Plugin interface - extend agent with skills, tools, channels, and lifecycle hooks.
 */
export interface IPlugin {
  name: string;
  version: string;
  description?: string;
  hooks?: PluginHooks;
  skills?: ISkill[];
  tools?: MCPTool[];
  channels?: IChannel[];
}

export class PluginManager {
  private plugins: Map<string, IPlugin> = new Map();
  private logger = new Logger('plugins');

  register(plugin: IPlugin): void {
    if (this.plugins.has(plugin.name)) {
      this.logger.warn(`Plugin "${plugin.name}" already registered, replacing`);
    }
    this.plugins.set(plugin.name, plugin);
    this.logger.info(`Plugin registered: ${plugin.name}@${plugin.version}`);
  }

  unregister(name: string): void {
    this.plugins.delete(name);
  }

  get(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }

  list(): { name: string; version: string; description?: string }[] {
    return Array.from(this.plugins.values()).map(({ name, version, description }) => ({
      name, version, description,
    }));
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  async runHook(hookName: keyof PluginHooks, ...args: unknown[]): Promise<void> {
    for (const plugin of this.plugins.values()) {
      const hook = plugin.hooks?.[hookName];
      if (hook) {
        try {
          await (hook as (...a: unknown[]) => Promise<void>)(...args);
        } catch (err) {
          this.logger.error(`Plugin "${plugin.name}" hook "${hookName}" failed`, {
            error: err instanceof Error ? err.message : String(err),
          });
          // Don't let one plugin break others
        }
      }
    }
  }

  async runOnInit(): Promise<void> {
    await this.runHook('onInit');
    await this.runHook('beforeInit');
    await this.runHook('afterInit');
  }

  async runOnMessage(message: Message): Promise<Message> {
    let msg = message;
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.onMessage) {
        const result = await plugin.hooks.onMessage(msg);
        if (result) msg = result;
      }
      if (plugin.hooks?.beforeMessage) {
        await plugin.hooks.beforeMessage({ content: msg.content });
      }
    }
    return msg;
  }

  async runOnResponse(message: Message, response: Message): Promise<Message> {
    let resp = response;
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.onResponse) {
        const result = await plugin.hooks.onResponse(message, resp);
        if (result) resp = result;
      }
      if (plugin.hooks?.afterMessage) {
        await plugin.hooks.afterMessage({ content: message.content }, { content: resp.content });
      }
    }
    return resp;
  }

  async runOnError(error: Error, context?: Record<string, unknown>): Promise<void> {
    await this.runHook('onError', error, context);
  }

  async runOnShutdown(): Promise<void> {
    await this.runHook('onShutdown');
    await this.runHook('beforeShutdown');
  }

  getAllSkills(): ISkill[] {
    const skills: ISkill[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.skills) skills.push(...plugin.skills);
    }
    return skills;
  }

  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.tools) tools.push(...plugin.tools);
    }
    return tools;
  }

  getAllChannels(): IChannel[] {
    const channels: IChannel[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.channels) channels.push(...plugin.channels);
    }
    return channels;
  }
}

// ── Built-in Plugins ────────────────────────────────────────

export function createLoggingPlugin(): IPlugin {
  const logger = new Logger('agent:messages');
  return {
    name: 'logging',
    version: '1.0.0',
    description: 'Logs all messages and responses',
    hooks: {
      onInit: async () => { logger.info('Agent initialized'); },
      onMessage: async (msg: Message) => { logger.info(`← ${msg.role}: ${msg.content.slice(0, 100)}`); return undefined as any; },
      onResponse: async (_msg: Message, resp: Message) => { logger.info(`→ ${resp.role}: ${resp.content.slice(0, 100)}`); return undefined as any; },
      onError: async (err: Error) => { logger.error(`Error: ${err.message}`); },
      onShutdown: async () => { logger.info('Agent shutting down'); },
    },
  };
}

export function createAnalyticsPlugin(): IPlugin {
  const stats = { messages: 0, errors: 0, startedAt: 0 };
  return {
    name: 'analytics',
    version: '1.0.0',
    description: 'Tracks message counts and error rates',
    hooks: {
      onInit: async () => { stats.startedAt = Date.now(); },
      onMessage: async () => { stats.messages++; return undefined as any; },
      onError: async () => { stats.errors++; },
    },
  };
}

export function createRateLimitPlugin(maxPerMinute = 60): IPlugin {
  const timestamps: number[] = [];
  return {
    name: 'rate-limit',
    version: '1.0.0',
    description: `Rate limits to ${maxPerMinute} messages/minute`,
    hooks: {
      onMessage: async () => {
        const now = Date.now();
        const windowStart = now - 60_000;
        while (timestamps.length > 0 && timestamps[0] < windowStart) timestamps.shift();
        if (timestamps.length >= maxPerMinute) {
          throw new Error('Rate limit exceeded. Please slow down.');
        }
        timestamps.push(now);
        return undefined as any;
      },
    },
  };
}
