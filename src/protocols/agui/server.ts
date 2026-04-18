// AG-UI Server — SSE streaming endpoint for agent-to-frontend communication
import { IncomingMessage, ServerResponse, Server } from 'http';
import type { AGUIEvent, AGUIRunRequest, AGUIMessage } from './types';
import type { BaseAgent } from '../../core/agent';
import type { Message } from '../../core/types';

// ─── AGUIEventEmitter ────────────────────────────────────────

export class AGUIEventEmitter {
  private closed = false;

  constructor(private res: ServerResponse) {}

  emit(event: AGUIEvent): void {
    if (this.closed) return;
    const data = JSON.stringify(event);
    this.res.write(`data: ${data}\n\n`);
  }

  textStart(messageId: string): void {
    this.emit({ type: 'TEXT_MESSAGE_START', messageId, role: 'assistant', timestamp: now() });
  }

  textContent(messageId: string, delta: string): void {
    this.emit({ type: 'TEXT_MESSAGE_CONTENT', messageId, delta, timestamp: now() });
  }

  textEnd(messageId: string): void {
    this.emit({ type: 'TEXT_MESSAGE_END', messageId, timestamp: now() });
  }

  toolCallStart(id: string, name: string): void {
    this.emit({ type: 'TOOL_CALL_START', toolCallId: id, toolCallName: name, timestamp: now() });
  }

  toolCallArgs(id: string, delta: string): void {
    this.emit({ type: 'TOOL_CALL_ARGS', toolCallId: id, delta, timestamp: now() });
  }

  toolCallEnd(id: string): void {
    this.emit({ type: 'TOOL_CALL_END', toolCallId: id, timestamp: now() });
  }

  stateSnapshot(snapshot: Record<string, any>): void {
    this.emit({ type: 'STATE_SNAPSHOT', snapshot, timestamp: now() });
  }

  stateDelta(delta: any[]): void {
    this.emit({ type: 'STATE_DELTA', delta, timestamp: now() });
  }

  runStarted(runId: string, threadId?: string): void {
    this.emit({ type: 'RUN_STARTED', runId, ...(threadId ? { threadId } : {}), timestamp: now() });
  }

  runFinished(runId: string): void {
    this.emit({ type: 'RUN_FINISHED', runId, timestamp: now() });
  }

  runError(runId: string, message: string, code?: string): void {
    this.emit({ type: 'RUN_ERROR', runId, message, ...(code ? { code } : {}), timestamp: now() });
  }

  stepStarted(stepId: string, stepName?: string): void {
    this.emit({ type: 'STEP_STARTED', stepId, ...(stepName ? { stepName } : {}), timestamp: now() });
  }

  stepFinished(stepId: string): void {
    this.emit({ type: 'STEP_FINISHED', stepId, timestamp: now() });
  }

  messagesSnapshot(messages: AGUIMessage[]): void {
    this.emit({ type: 'MESSAGES_SNAPSHOT', messages, timestamp: now() });
  }

  custom(name: string, value: any): void {
    this.emit({ type: 'CUSTOM', name, value, timestamp: now() });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.res.end();
  }

  get isClosed(): boolean {
    return this.closed;
  }
}

// ─── AGUIServer ──────────────────────────────────────────────

export class AGUIServer {
  private agent: BaseAgent;
  private path: string;

  constructor(agent: BaseAgent, config?: { path?: string }) {
    this.agent = agent;
    this.path = config?.path ?? '/agui';
  }

  mount(server: Server): void {
    const original = server.listeners('request')[0] as any;
    server.removeAllListeners('request');

    server.on('request', (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (req.method === 'POST' && url.pathname === this.path) {
        this.handleRun(req, res);
      } else if (req.method === 'OPTIONS' && url.pathname === this.path) {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
      } else if (original) {
        original(req, res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
  }

  async handleRun(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body = '';
    for await (const chunk of req) body += chunk;

    let request: AGUIRunRequest;
    try {
      request = JSON.parse(body);
      if (!request.messages || !Array.isArray(request.messages)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'messages array required' }));
        return;
      }
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const emitter = new AGUIEventEmitter(res);
    const runId = request.runId ?? `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      await this.streamResponse(request, emitter, runId);
    } catch (err: any) {
      emitter.runError(runId, err?.message ?? 'Unknown error', 'INTERNAL_ERROR');
    } finally {
      emitter.close();
    }
  }

  private async streamResponse(request: AGUIRunRequest, emitter: AGUIEventEmitter, runId: string): Promise<void> {
    emitter.runStarted(runId, request.threadId);

    // Convert AG-UI messages to BaseAgent message format
    const lastUserMsg = [...request.messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) {
      emitter.runError(runId, 'No user message found', 'BAD_REQUEST');
      return;
    }

    const message: Message = {
      id: lastUserMsg.id || `msg_${Date.now()}`,
      role: 'user',
      content: lastUserMsg.content,
      timestamp: Date.now(),
      metadata: {
        channel: 'agui',
        sessionId: request.threadId ?? 'agui-default',
      },
    };

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Try streaming if agent supports it
    try {
      emitter.textStart(messageId);

      let hasChunks = false;
      for await (const chunk of this.agent.handleMessageStream(message)) {
        hasChunks = true;
        emitter.textContent(messageId, chunk);
      }

      if (!hasChunks) {
        // Fallback to non-streaming
        const response = await this.agent.handleMessage(message);
        emitter.textContent(messageId, response.content);
      }

      emitter.textEnd(messageId);
    } catch {
      // Fallback to non-streaming handleMessage
      emitter.textStart(messageId);
      const response = await this.agent.handleMessage(message);
      emitter.textContent(messageId, response.content);
      emitter.textEnd(messageId);
    }

    emitter.runFinished(runId);
  }
}

function now(): string {
  return new Date().toISOString();
}
