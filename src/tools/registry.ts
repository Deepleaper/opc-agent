// v2 tool registry — central registry for all available tools
import type { ToolDefinition } from '../core/types';

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
  category?: string;
  enabled: boolean;
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  register(tool: RegisteredTool): void {
    this.tools.set(tool.definition.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  list(enabled?: boolean): RegisteredTool[] {
    const all = Array.from(this.tools.values());
    return enabled !== undefined ? all.filter((t) => t.enabled === enabled) : all;
  }

  definitions(): ToolDefinition[] {
    return this.list(true).map((t) => t.definition);
  }

  async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`unknown tool: ${name}`);
    if (!tool.enabled) throw new Error(`tool disabled: ${name}`);
    return tool.handler(args);
  }

  toOpenAIFormat(): { type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }[] {
    return this.list(true).map((t) => ({
      type: 'function',
      function: {
        name: t.definition.name,
        description: t.definition.description,
        parameters: t.definition.parameters as Record<string, unknown>,
      },
    }));
  }
}
