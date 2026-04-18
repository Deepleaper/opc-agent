import { spawn, type ChildProcess } from 'child_process';
import type { MCPToolDefinition, MCPToolResult } from './mcp';

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export class MCPClient {
  private process: ChildProcess | null = null;
  private config: MCPServerConfig | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private buffer = '';
  private connected = false;

  async connect(config: MCPServerConfig): Promise<void> {
    this.config = config;
    this.process = spawn(config.command, config.args ?? [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...config.env },
    });

    this.process.stdout!.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.process.on('error', (err) => {
      for (const [, p] of this.pending) p.reject(err);
      this.pending.clear();
    });

    this.process.on('exit', () => {
      this.connected = false;
      for (const [, p] of this.pending) p.reject(new Error('MCP server exited'));
      this.pending.clear();
    });

    // Send initialize
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'opc-agent', version: '0.7.0' },
    });

    // Send initialized notification
    this.sendNotification('notifications/initialized', {});
    this.connected = true;
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const p = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) {
            p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            p.resolve(msg.result);
          }
        }
      } catch { /* skip non-JSON lines */ }
    }
  }

  private sendRequest(method: string, params?: Record<string, unknown>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin?.writable) {
        reject(new Error('MCP server not connected'));
        return;
      }
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const msg = JSON.stringify({ jsonrpc: '2.0', method, params: params ?? {}, id });
      this.process.stdin.write(msg + '\n');

      // Timeout after 30s
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP request timed out: ${method}`));
        }
      }, 30000);
    });
  }

  private sendNotification(method: string, params: Record<string, unknown>): void {
    if (!this.process?.stdin?.writable) return;
    const msg = JSON.stringify({ jsonrpc: '2.0', method, params });
    this.process.stdin.write(msg + '\n');
  }

  async listTools(): Promise<MCPToolDefinition[]> {
    const result = await this.sendRequest('tools/list');
    return (result.tools ?? []).map((t: any) => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: t.inputSchema ?? {},
    }));
  }

  async callTool(name: string, input: Record<string, unknown>): Promise<MCPToolResult> {
    const result = await this.sendRequest('tools/call', { name, arguments: input });
    const content = (result.content ?? [])
      .map((c: any) => c.text ?? JSON.stringify(c))
      .join('\n');
    return { content, isError: result.isError ?? false };
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
    this.pending.clear();
  }

  isConnected(): boolean {
    return this.connected;
  }
}
