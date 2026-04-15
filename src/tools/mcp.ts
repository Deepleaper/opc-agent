import type { AgentContext, Message } from '../core/types';

/**
 * MCP (Model Context Protocol) compatible tool interface.
 * Tools follow the MCP standard format with JSON Schema input validation.
 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
}

export interface MCPToolResult {
  content: string;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}

export interface MCPTool extends MCPToolDefinition {
  execute(input: Record<string, unknown>, context?: AgentContext): Promise<MCPToolResult>;
}

export class MCPToolRegistry {
  private tools: Map<string, MCPTool> = new Map();

  register(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  list(): MCPToolDefinition[] {
    return Array.from(this.tools.values()).map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    }));
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async execute(name: string, input: Record<string, unknown>, context?: AgentContext): Promise<MCPToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { content: `Tool '${name}' not found`, isError: true };
    }
    try {
      return await tool.execute(input, context);
    } catch (err) {
      return {
        content: `Tool execution error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  }
}

/**
 * Create an MCP tool from a simple function.
 */
export function createMCPTool(
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  executeFn: (input: Record<string, unknown>, context?: AgentContext) => Promise<MCPToolResult>,
): MCPTool {
  return { name, description, inputSchema, execute: executeFn };
}
