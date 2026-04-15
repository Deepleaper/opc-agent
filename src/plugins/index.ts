import type { ISkill, IChannel } from '../core/types';
import type { MCPTool } from '../tools/mcp';

/**
 * Plugin lifecycle hooks.
 */
export interface PluginHooks {
  beforeInit?: () => Promise<void>;
  afterInit?: () => Promise<void>;
  beforeMessage?: (message: { content: string }) => Promise<void>;
  afterMessage?: (message: { content: string }, response: { content: string }) => Promise<void>;
  beforeShutdown?: () => Promise<void>;
}

/**
 * Plugin interface — extend agent with skills, tools, channels, and lifecycle hooks.
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

  register(plugin: IPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  unregister(name: string): void {
    this.plugins.delete(name);
  }

  get(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }

  list(): { name: string; version: string; description?: string }[] {
    return Array.from(this.plugins.values()).map(({ name, version, description }) => ({
      name,
      version,
      description,
    }));
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  async runHook(hookName: keyof PluginHooks, ...args: unknown[]): Promise<void> {
    for (const plugin of this.plugins.values()) {
      const hook = plugin.hooks?.[hookName];
      if (hook) {
        await (hook as (...a: unknown[]) => Promise<void>)(...args);
      }
    }
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
