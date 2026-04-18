/**
 * MCP Server types — JSON-RPC 2.0 based Model Context Protocol
 */

export interface MCPServerConfig {
  name: string;
  version: string;
  tools?: MCPServerToolDefinition[];
  resources?: MCPResourceDefinition[];
  prompts?: MCPPromptDefinition[];
}

export interface MCPServerToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: any) => Promise<any>;
}

export interface MCPResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  handler: () => Promise<string>;
}

export interface MCPPromptDefinition {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
  handler?: (args: Record<string, string>) => Promise<MCPPromptMessage[]>;
}

export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: { type: 'text'; text: string };
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

export const MCP_ERRORS = {
  PARSE_ERROR: { code: -32700, message: 'Parse error' },
  INVALID_REQUEST: { code: -32600, message: 'Invalid Request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INVALID_PARAMS: { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR: { code: -32603, message: 'Internal error' },
  TOOL_NOT_FOUND: { code: -32001, message: 'Tool not found' },
  RESOURCE_NOT_FOUND: { code: -32002, message: 'Resource not found' },
  PROMPT_NOT_FOUND: { code: -32003, message: 'Prompt not found' },
} as const;
