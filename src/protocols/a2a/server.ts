import { createServer, IncomingMessage, ServerResponse } from 'http';
import type {
  A2AAgentCard, A2ATask, A2ATaskStatus, A2AMessage, A2AArtifact,
  JsonRpcRequest, JsonRpcResponse,
} from './types';
import { JSON_RPC_ERRORS } from './types';
import { oadToAgentCard } from './utils';

export class A2AServer {
  private tasks: Map<string, A2ATask> = new Map();
  private agent: any;
  private card: A2AAgentCard;
  private server: any;
  private taskHandler?: (task: A2ATask) => Promise<A2ATask>;

  constructor(agent: any, config?: { card?: Partial<A2AAgentCard>; oad?: any; port?: number }) {
    this.agent = agent;

    // Build card from OAD if available, then overlay explicit config
    const baseCard = config?.oad
      ? oadToAgentCard(config.oad, config?.card?.url || `http://localhost:${config?.port || 3001}`)
      : {
          name: agent?.name || 'opc-agent',
          description: agent?.config?.systemPrompt?.slice(0, 200) || 'OPC Agent',
          url: `http://localhost:${config?.port || 3001}`,
          version: '1.0.0',
          capabilities: { streaming: true, pushNotifications: false, stateTransitionHistory: true },
          skills: [],
          defaultInputModes: ['text'],
          defaultOutputModes: ['text'],
        };

    this.card = { ...baseCard, ...config?.card } as A2AAgentCard;
  }

  /** Set custom handler for processing tasks */
  onTask(handler: (task: A2ATask) => Promise<A2ATask>): void {
    this.taskHandler = handler;
  }

  getAgentCard(): A2AAgentCard {
    return this.card;
  }

  getTasks(): A2ATask[] {
    return Array.from(this.tasks.values());
  }

  /** Mount A2A routes on an existing HTTP server handler */
  mount(handleRequest: (req: IncomingMessage, res: ServerResponse) => void): (req: IncomingMessage, res: ServerResponse) => void {
    return (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      // /.well-known/agent.json
      if (url.pathname === '/.well-known/agent.json' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.card, null, 2));
        return;
      }

      // JSON-RPC endpoint
      if (url.pathname === '/' && req.method === 'POST') {
        this.handleHTTP(req, res);
        return;
      }

      // Fall through to original handler
      handleRequest(req, res);
    };
  }

  async start(port: number): Promise<void> {
    this.card.url = `http://localhost:${port}`;
    return new Promise((resolve) => {
      this.server = createServer((req, res) => {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

        if (url.pathname === '/.well-known/agent.json' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.card, null, 2));
          return;
        }

        if (url.pathname === '/' && req.method === 'POST') {
          this.handleHTTP(req, res);
          return;
        }

        res.writeHead(404);
        res.end('Not Found');
      });

      this.server.listen(port, () => resolve());
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private async handleHTTP(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    let rpcReq: JsonRpcRequest;

    try {
      rpcReq = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.rpcError(null, JSON_RPC_ERRORS.PARSE_ERROR, 'Parse error')));
      return;
    }

    if (!rpcReq.jsonrpc || rpcReq.jsonrpc !== '2.0' || !rpcReq.method) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.rpcError(rpcReq?.id ?? null, JSON_RPC_ERRORS.INVALID_REQUEST, 'Invalid Request')));
      return;
    }

    // SSE for streaming
    if (rpcReq.method === 'tasks/sendSubscribe') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      try {
        await this.tasksSendSubscribe(rpcReq.params, (event: any) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        });
      } catch (err: any) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      }
      res.end();
      return;
    }

    const result = await this.handleRPC(rpcReq.method, rpcReq.params, rpcReq.id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  private async handleRPC(method: string, params: any, id: string | number | null): Promise<JsonRpcResponse> {
    try {
      let result: any;
      switch (method) {
        case 'tasks/send':
          result = await this.tasksSend(params);
          break;
        case 'tasks/get':
          result = await this.tasksGet(params);
          break;
        case 'tasks/cancel':
          result = await this.tasksCancel(params);
          break;
        default:
          return this.rpcError(id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Method not found: ${method}`);
      }
      return { jsonrpc: '2.0', id: id!, result };
    } catch (err: any) {
      if (err.code) {
        return this.rpcError(id, err.code, err.message);
      }
      return this.rpcError(id, JSON_RPC_ERRORS.INTERNAL_ERROR, err.message);
    }
  }

  async tasksSend(params: { id: string; sessionId?: string; message: A2AMessage; metadata?: any }): Promise<A2ATask> {
    const taskId = params.id;
    const sessionId = params.sessionId || `session_${Date.now()}`;

    let task = this.tasks.get(taskId);
    if (!task) {
      task = {
        id: taskId,
        sessionId,
        status: { state: 'submitted', timestamp: new Date().toISOString() },
        history: [],
        artifacts: [],
        metadata: params.metadata,
      };
      this.tasks.set(taskId, task);
    }

    // Add user message to history
    task.history.push(params.message);
    task.status = { state: 'working', timestamp: new Date().toISOString() };

    // Process with custom handler or agent
    if (this.taskHandler) {
      task = await this.taskHandler(task);
      this.tasks.set(taskId, task);
      return task;
    }

    // Default: use agent.handleMessage if available
    if (this.agent?.handleMessage) {
      try {
        const textContent = params.message.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('\n');

        const response = await this.agent.handleMessage({
          id: taskId,
          role: 'user',
          content: textContent,
          timestamp: Date.now(),
        });

        const agentMessage: A2AMessage = {
          role: 'agent',
          parts: [{ type: 'text', text: response.content }],
        };

        task.history.push(agentMessage);
        task.status = { state: 'completed', message: agentMessage, timestamp: new Date().toISOString() };
      } catch (err: any) {
        task.status = {
          state: 'failed',
          message: { role: 'agent', parts: [{ type: 'text', text: err.message }] },
          timestamp: new Date().toISOString(),
        };
      }
    } else {
      // No agent — just mark completed with echo
      const agentMessage: A2AMessage = {
        role: 'agent',
        parts: [{ type: 'text', text: 'No agent handler configured' }],
      };
      task.history.push(agentMessage);
      task.status = { state: 'completed', message: agentMessage, timestamp: new Date().toISOString() };
    }

    this.tasks.set(taskId, task);
    return task;
  }

  async tasksSendSubscribe(params: any, onEvent: (event: any) => void): Promise<void> {
    const taskId = params.id;
    const sessionId = params.sessionId || `session_${Date.now()}`;

    let task: A2ATask = {
      id: taskId,
      sessionId,
      status: { state: 'submitted', timestamp: new Date().toISOString() },
      history: [],
      artifacts: [],
      metadata: params.metadata,
    };
    this.tasks.set(taskId, task);
    task.history.push(params.message);

    // Emit submitted
    onEvent({ jsonrpc: '2.0', result: { id: taskId, status: task.status } });

    task.status = { state: 'working', timestamp: new Date().toISOString() };
    onEvent({ jsonrpc: '2.0', result: { id: taskId, status: task.status } });

    // Process
    if (this.agent?.handleMessage) {
      const textContent = params.message.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('\n');

      try {
        const response = await this.agent.handleMessage({
          id: taskId, role: 'user', content: textContent, timestamp: Date.now(),
        });

        const agentMessage: A2AMessage = { role: 'agent', parts: [{ type: 'text', text: response.content }] };
        task.history.push(agentMessage);
        task.status = { state: 'completed', message: agentMessage, timestamp: new Date().toISOString() };
      } catch (err: any) {
        task.status = { state: 'failed', message: { role: 'agent', parts: [{ type: 'text', text: err.message }] }, timestamp: new Date().toISOString() };
      }
    } else {
      const msg: A2AMessage = { role: 'agent', parts: [{ type: 'text', text: 'No agent handler' }] };
      task.history.push(msg);
      task.status = { state: 'completed', message: msg, timestamp: new Date().toISOString() };
    }

    this.tasks.set(taskId, task);
    onEvent({ jsonrpc: '2.0', result: { id: taskId, status: task.status, history: task.history } });
  }

  async tasksGet(params: { id: string; historyLength?: number }): Promise<A2ATask> {
    const task = this.tasks.get(params.id);
    if (!task) {
      const err: any = new Error(`Task not found: ${params.id}`);
      err.code = JSON_RPC_ERRORS.TASK_NOT_FOUND;
      throw err;
    }

    if (params.historyLength !== undefined) {
      return { ...task, history: task.history.slice(-params.historyLength) };
    }
    return task;
  }

  async tasksCancel(params: { id: string }): Promise<A2ATask> {
    const task = this.tasks.get(params.id);
    if (!task) {
      const err: any = new Error(`Task not found: ${params.id}`);
      err.code = JSON_RPC_ERRORS.TASK_NOT_FOUND;
      throw err;
    }

    task.status = { state: 'canceled', timestamp: new Date().toISOString() };
    this.tasks.set(params.id, task);
    return task;
  }

  private rpcError(id: any, code: number, message: string): JsonRpcResponse {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.on('error', reject);
    });
  }
}
