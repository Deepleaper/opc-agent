import * as http from 'http';
import { randomUUID } from 'crypto';

export interface APIServerConfig {
  port: number;
  host: string;
  apiKey?: string;
  agent: any;
}

interface OpenAIError {
  error: { message: string; type: string; code: string | number };
}

function jsonError(message: string, type: string, code: string | number): OpenAIError {
  return { error: { message, type, code } };
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function parseBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function sendJSON(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { ...corsHeaders(), 'Content-Type': 'application/json' });
  res.end(body);
}

export class APIServer {
  private server: http.Server | null = null;
  private config: APIServerConfig;

  constructor(config: Partial<APIServerConfig> & { agent: any }) {
    this.config = {
      port: config.port ?? 8080,
      host: config.host ?? '0.0.0.0',
      apiKey: config.apiKey,
      agent: config.agent,
    };
  }

  private authenticate(req: http.IncomingMessage): boolean {
    if (!this.config.apiKey) return true;
    const auth = req.headers['authorization'] ?? '';
    return auth === `Bearer ${this.config.apiKey}`;
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));
      this.server.listen(this.config.port, this.config.host, () => resolve());
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) this.server.close(() => resolve());
      else resolve();
    });
  }

  getPort(): number { return this.config.port; }
  getHost(): string { return this.config.host; }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    // Health check (no auth)
    if (method === 'GET' && url === '/health') {
      sendJSON(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
      return;
    }

    // Auth check for all other endpoints
    if (!this.authenticate(req)) {
      sendJSON(res, 401, jsonError('Invalid API key', 'authentication_error', 401));
      return;
    }

    try {
      if (method === 'GET' && url === '/v1/models') {
        return this.handleModels(res);
      }
      if (method === 'GET' && url === '/v1/agent/status') {
        return this.handleAgentStatus(res);
      }
      if (method === 'POST' && url === '/v1/chat/completions') {
        return await this.handleChatCompletions(req, res);
      }
      if (method === 'POST' && url === '/v1/embeddings') {
        return await this.handleEmbeddings(req, res);
      }

      sendJSON(res, 404, jsonError('Not found', 'not_found', 404));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sendJSON(res, 500, jsonError(msg, 'internal_error', 500));
    }
  }

  private handleModels(res: http.ServerResponse): void {
    const agent = this.config.agent;
    const modelId = agent?.config?.model ?? agent?.model ?? 'default';
    sendJSON(res, 200, {
      object: 'list',
      data: [{ id: modelId, object: 'model', created: Math.floor(Date.now() / 1000), owned_by: 'opc-agent' }],
    });
  }

  private handleAgentStatus(res: http.ServerResponse): void {
    const agent = this.config.agent;
    sendJSON(res, 200, {
      name: agent?.name ?? agent?.config?.name ?? 'unknown',
      state: agent?.state ?? 'unknown',
      uptime: process.uptime(),
    });
  }

  private async handleChatCompletions(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let body: any;
    try {
      body = JSON.parse(await parseBody(req));
    } catch {
      sendJSON(res, 400, jsonError('Invalid JSON body', 'invalid_request_error', 400));
      return;
    }

    const { model, messages, temperature, max_tokens, stream, tools } = body;
    if (!messages || !Array.isArray(messages)) {
      sendJSON(res, 400, jsonError('messages is required and must be an array', 'invalid_request_error', 400));
      return;
    }

    const agent = this.config.agent;
    const requestId = `chatcmpl-${randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const modelId = model ?? agent?.config?.model ?? agent?.model ?? 'default';

    if (stream) {
      // SSE streaming
      res.writeHead(200, {
        ...corsHeaders(),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      try {
        const responseText = await this.getAgentResponse(agent, messages, { temperature, max_tokens, tools });
        // Stream in chunks
        const chunkSize = 10;
        for (let i = 0; i < responseText.length; i += chunkSize) {
          const delta = responseText.slice(i, i + chunkSize);
          const chunk = {
            id: requestId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: modelId,
            choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
          };
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        // Final chunk
        const finalChunk = {
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: modelId,
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        };
        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
        res.write('data: [DONE]\n\n');
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        res.write(`data: ${JSON.stringify({ error: { message: errMsg } })}\n\n`);
      }
      res.end();
    } else {
      // Non-streaming
      const responseText = await this.getAgentResponse(agent, messages, { temperature, max_tokens, tools });
      sendJSON(res, 200, {
        id: requestId,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: modelId,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: responseText },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: messages.reduce((a: number, m: any) => a + (m.content?.length ?? 0), 0),
          completion_tokens: responseText.length,
          total_tokens: messages.reduce((a: number, m: any) => a + (m.content?.length ?? 0), 0) + responseText.length,
        },
      });
    }
  }

  private async getAgentResponse(agent: any, messages: any[], options: any): Promise<string> {
    // Try various agent interfaces
    if (agent?.chat) {
      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
      return await agent.chat(lastUserMsg?.content ?? '', options);
    }
    if (agent?.processMessage) {
      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
      const result = await agent.processMessage({ id: 'api', role: 'user', content: lastUserMsg?.content ?? '', timestamp: Date.now() });
      return result?.response ?? result?.content ?? String(result);
    }
    if (agent?.provider?.chat) {
      const formatted = messages.map((m: any) => ({ id: 'x', role: m.role, content: m.content, timestamp: Date.now() }));
      return await agent.provider.chat(formatted, agent.systemPrompt ?? '');
    }
    return 'Agent does not support chat interface';
  }

  private async handleEmbeddings(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let body: any;
    try {
      body = JSON.parse(await parseBody(req));
    } catch {
      sendJSON(res, 400, jsonError('Invalid JSON body', 'invalid_request_error', 400));
      return;
    }

    const { input, model } = body;
    if (!input) {
      sendJSON(res, 400, jsonError('input is required', 'invalid_request_error', 400));
      return;
    }

    const agent = this.config.agent;
    const inputs = Array.isArray(input) ? input : [input];

    try {
      if (agent?.embed || agent?.provider?.embed) {
        const embedFn = agent.embed?.bind(agent) ?? agent.provider.embed.bind(agent.provider);
        const data = await Promise.all(inputs.map(async (text: string, i: number) => {
          const embedding = await embedFn(text);
          return { object: 'embedding', embedding, index: i };
        }));
        sendJSON(res, 200, {
          object: 'list',
          data,
          model: model ?? 'default',
          usage: { prompt_tokens: inputs.join('').length, total_tokens: inputs.join('').length },
        });
      } else {
        sendJSON(res, 501, jsonError('Embedding provider not configured', 'not_implemented', 501));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sendJSON(res, 500, jsonError(msg, 'internal_error', 500));
    }
  }
}
