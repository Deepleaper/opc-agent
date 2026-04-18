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
 * v1.6.0 — Enhanced Plugin interface with middleware pattern.
 * Plugins implementing this interface use next() to chain processing.
 */
export interface Plugin {
  name: string;
  version: string;
  description?: string;

  // Lifecycle hooks
  onInit?(runtime: any): Promise<void>;
  onMessage?(message: any, next: (msg: any) => Promise<any>): Promise<any>;
  onResponse?(response: any, next: (res: any) => Promise<any>): Promise<any>;
  onError?(error: Error): void;
  onShutdown?(): Promise<void>;

  // Registration
  tools?: any[];
  skills?: any[];
  channels?: any[];
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
  private enhancedPlugins: Map<string, Plugin> = new Map();
  private logger = new Logger('plugins');

  register(plugin: IPlugin): void {
    if (this.plugins.has(plugin.name)) {
      this.logger.warn(`Plugin "${plugin.name}" already registered, replacing`);
    }
    this.plugins.set(plugin.name, plugin);
    this.logger.info(`Plugin registered: ${plugin.name}@${plugin.version}`);
  }

  /**
   * Register an enhanced plugin with middleware support (v1.6.0).
   */
  registerEnhanced(plugin: Plugin): void {
    if (this.enhancedPlugins.has(plugin.name)) {
      this.logger.warn(`Enhanced plugin "${plugin.name}" already registered, replacing`);
    }
    this.enhancedPlugins.set(plugin.name, plugin);
    this.logger.info(`Enhanced plugin registered: ${plugin.name}@${plugin.version}`);
  }

  unregisterEnhanced(name: string): void {
    this.enhancedPlugins.delete(name);
  }

  getEnhanced(name: string): Plugin | undefined {
    return this.enhancedPlugins.get(name);
  }

  listEnhanced(): Plugin[] {
    return Array.from(this.enhancedPlugins.values());
  }

  unregister(name: string): void {
    this.plugins.delete(name);
    this.enhancedPlugins.delete(name);
  }

  get(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }

  list(): { name: string; version: string; description?: string }[] {
    const legacy = Array.from(this.plugins.values()).map(({ name, version, description }) => ({
      name, version, description,
    }));
    const enhanced = Array.from(this.enhancedPlugins.values()).map(({ name, version, description }) => ({
      name, version, description,
    }));
    return [...legacy, ...enhanced];
  }

  has(name: string): boolean {
    return this.plugins.has(name) || this.enhancedPlugins.has(name);
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

  /**
   * Initialize all plugins (legacy + enhanced).
   */
  async initAll(runtime?: any): Promise<void> {
    await this.runOnInit();
    for (const plugin of this.enhancedPlugins.values()) {
      if (plugin.onInit) {
        try {
          await plugin.onInit(runtime);
        } catch (err) {
          this.logger.error(`Enhanced plugin "${plugin.name}" onInit failed`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  /**
   * Shutdown all plugins (legacy + enhanced).
   */
  async shutdownAll(): Promise<void> {
    await this.runOnShutdown();
    for (const plugin of this.enhancedPlugins.values()) {
      if (plugin.onShutdown) {
        try {
          await plugin.onShutdown();
        } catch (err) {
          this.logger.error(`Enhanced plugin "${plugin.name}" onShutdown failed`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  /**
   * Run message through enhanced plugin middleware chain.
   * Each plugin calls next() to pass to the next plugin.
   */
  async runMessageMiddleware(message: any): Promise<any> {
    const plugins = Array.from(this.enhancedPlugins.values()).filter(p => p.onMessage);
    if (plugins.length === 0) return message;

    let index = 0;
    const next = async (msg: any): Promise<any> => {
      if (index >= plugins.length) return msg;
      const plugin = plugins[index++];
      return plugin.onMessage!(msg, next);
    };
    return next(message);
  }

  /**
   * Run response through enhanced plugin middleware chain.
   */
  async runResponseMiddleware(response: any): Promise<any> {
    const plugins = Array.from(this.enhancedPlugins.values()).filter(p => p.onResponse);
    if (plugins.length === 0) return response;

    let index = 0;
    const next = async (res: any): Promise<any> => {
      if (index >= plugins.length) return res;
      const plugin = plugins[index++];
      return plugin.onResponse!(res, next);
    };
    return next(response);
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
    // Also run enhanced middleware
    msg = await this.runMessageMiddleware(msg);
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
    // Also run enhanced middleware
    resp = await this.runResponseMiddleware(resp);
    return resp;
  }

  async runOnError(error: Error, context?: Record<string, unknown>): Promise<void> {
    await this.runHook('onError', error, context);
    for (const plugin of this.enhancedPlugins.values()) {
      if (plugin.onError) {
        try {
          plugin.onError(error);
        } catch (_) { /* ignore */ }
      }
    }
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
