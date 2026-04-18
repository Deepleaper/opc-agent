import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { createInterface } from 'readline';
import type {
  MCPServerConfig, MCPServerToolDefinition, MCPResourceDefinition,
  MCPPromptDefinition, JsonRpcRequest, JsonRpcResponse,
} from './types';
import { MCP_ERRORS } from './types';

export class MCPServer {
  private config: MCPServerConfig;
  private tools: Map<string, MCPServerToolDefinition> = new Map();
  private resources: Map<string, MCPResourceDefinition> = new Map();
  private prompts: Map<string, MCPPromptDefinition> = new Map();
  private sseClients: Set<ServerResponse> = new Set();
  private httpServer: ReturnType<typeof createServer> | null = null;

  constructor(config: MCPServerConfig) {
    this.config = config;
    for (const t of config.tools ?? []) this.addTool(t);
    for (const r of config.resources ?? []) this.addResource(r);
    for (const p of config.prompts ?? []) this.addPrompt(p);
  }

  addTool(tool: MCPServerToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  removeTool(name: string): void {
    this.tools.delete(name);
  }

  addResource(resource: MCPResourceDefinition): void {
    this.resources.set(resource.uri, resource);
  }

  removeResource(uri: string): void {
    this.resources.delete(uri);
  }

  addPrompt(prompt: MCPPromptDefinition): void {
    this.prompts.set(prompt.name, prompt);
  }

  getToolCount(): number { return this.tools.size; }
  getResourceCount(): number { return this.resources.size; }
  getPromptCount(): number { return this.prompts.size; }
  getConnectedClients(): number { return this.sseClients.size; }

  /** Serve over stdio — one JSON-RPC message per line */
  async serveStdio(): Promise<void> {
    const rl = createInterface({ input: process.stdin, terminal: false });
    rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcRequest;
        const response = await this.handleMessage(msg);
        if (response) {
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } catch {
        const err: JsonRpcResponse = {
          jsonrpc: '2.0', id: null,
          error: MCP_ERRORS.PARSE_ERROR,
        };
        process.stdout.write(JSON.stringify(err) + '\n');
      }
    });
  }

  /** Serve over HTTP + SSE */
  async serveHTTP(port: number): Promise<void> {
    this.httpServer = createServer((req, res) => this.handleHTTP(req, res));
    return new Promise((resolve) => {
      this.httpServer!.listen(port, () => resolve());
    });
  }

  /** Mount on existing HTTP server at a path prefix */
  mount(server: any, path = '/mcp'): void {
    const orig = server.listeners('request')[0] as any;
    server.removeAllListeners('request');
    server.on('request', (req: IncomingMessage, res: ServerResponse) => {
      if (req.url?.startsWith(path)) {
        // Rewrite URL to strip prefix
        req.url = req.url.slice(path.length) || '/';
        this.handleHTTP(req, res);
      } else if (orig) {
        orig(req, res);
      }
    });
  }

  stop(): void {
    this.httpServer?.close();
    for (const client of this.sseClients) {
      client.end();
    }
    this.sseClients.clear();
  }

  private handleHTTP(req: IncomingMessage, res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/sse' && req.method === 'GET') {
      // SSE endpoint
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      this.sseClients.add(res);
      // Send endpoint info
      res.write(`data: ${JSON.stringify({ type: 'endpoint', url: '/message' })}\n\n`);
      req.on('close', () => this.sseClients.delete(res));
      return;
    }

    if (url.pathname === '/message' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const msg = JSON.parse(body) as JsonRpcRequest;
          const response = await this.handleMessage(msg);
          if (response) {
            // Send via SSE to all clients
            for (const client of this.sseClients) {
              client.write(`data: ${JSON.stringify(response)}\n\n`);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
          } else {
            res.writeHead(202);
            res.end();
          }
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: MCP_ERRORS.PARSE_ERROR }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  }

  async handleMessage(msg: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    // Notifications (no id) don't get responses
    if (msg.id === undefined) return null;

    const id = msg.id;
    try {
      switch (msg.method) {
        case 'initialize':
          return this.rpcResult(id, {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: this.tools.size > 0 ? { listChanged: true } : undefined,
              resources: this.resources.size > 0 ? { subscribe: false, listChanged: true } : undefined,
              prompts: this.prompts.size > 0 ? { listChanged: true } : undefined,
            },
            serverInfo: { name: this.config.name, version: this.config.version },
          });

        case 'tools/list':
          return this.rpcResult(id, {
            tools: Array.from(this.tools.values()).map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          });

        case 'tools/call': {
          const { name, arguments: args } = msg.params ?? {};
          const tool = this.tools.get(name);
          if (!tool) return this.rpcError(id, MCP_ERRORS.TOOL_NOT_FOUND);
          // Validate required fields
          const schema = tool.inputSchema;
          if (schema?.required && Array.isArray(schema.required)) {
            for (const field of schema.required) {
              if (args?.[field] === undefined) {
                return this.rpcError(id, { code: -32602, message: `Missing required parameter: ${field}` });
              }
            }
          }
          try {
            const result = await tool.handler(args ?? {});
            return this.rpcResult(id, {
              content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }],
            });
          } catch (err: any) {
            return this.rpcResult(id, {
              content: [{ type: 'text', text: err.message || 'Tool execution failed' }],
              isError: true,
            });
          }
        }

        case 'resources/list':
          return this.rpcResult(id, {
            resources: Array.from(this.resources.values()).map(r => ({
              uri: r.uri, name: r.name, description: r.description, mimeType: r.mimeType,
            })),
          });

        case 'resources/read': {
          const { uri } = msg.params ?? {};
          const resource = this.resources.get(uri);
          if (!resource) return this.rpcError(id, MCP_ERRORS.RESOURCE_NOT_FOUND);
          const content = await resource.handler();
          return this.rpcResult(id, {
            contents: [{ uri, mimeType: resource.mimeType || 'text/plain', text: content }],
          });
        }

        case 'prompts/list':
          return this.rpcResult(id, {
            prompts: Array.from(this.prompts.values()).map(p => ({
              name: p.name, description: p.description,
              arguments: p.arguments,
            })),
          });

        case 'prompts/get': {
          const { name, arguments: promptArgs } = msg.params ?? {};
          const prompt = this.prompts.get(name);
          if (!prompt) return this.rpcError(id, MCP_ERRORS.PROMPT_NOT_FOUND);
          const messages = prompt.handler
            ? await prompt.handler(promptArgs ?? {})
            : [{ role: 'user' as const, content: { type: 'text' as const, text: prompt.description || '' } }];
          return this.rpcResult(id, { description: prompt.description, messages });
        }

        default:
          return this.rpcError(id, MCP_ERRORS.METHOD_NOT_FOUND);
      }
    } catch (err: any) {
      return this.rpcError(id, { ...MCP_ERRORS.INTERNAL_ERROR, data: err.message });
    }
  }

  private rpcResult(id: number | string, result: any): JsonRpcResponse {
    return { jsonrpc: '2.0', id, result };
  }

  private rpcError(id: number | string, error: { code: number; message: string; data?: any }): JsonRpcResponse {
    return { jsonrpc: '2.0', id, error };
  }
}
