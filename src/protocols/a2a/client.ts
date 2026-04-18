import type { A2AAgentCard, A2ATask, A2AMessage, JsonRpcResponse } from './types';

export class A2AClient {
  private agentUrl: string;
  private auth?: { scheme: string; token: string };

  constructor(agentUrl: string, auth?: { scheme: string; token: string }) {
    this.agentUrl = agentUrl.endsWith('/') ? agentUrl.slice(0, -1) : agentUrl;
    this.auth = auth;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.auth) {
      if (this.auth.scheme === 'bearer') {
        headers['Authorization'] = `Bearer ${this.auth.token}`;
      } else if (this.auth.scheme === 'apiKey') {
        headers['X-API-Key'] = this.auth.token;
      }
    }
    return headers;
  }

  private async rpc(method: string, params?: any): Promise<any> {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      method,
      params,
    });

    const res = await fetch(this.agentUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body,
    });

    const json: JsonRpcResponse = await res.json() as any;
    if (json.error) {
      const err: any = new Error(json.error.message);
      err.code = json.error.code;
      throw err;
    }
    return json.result;
  }

  async getAgentCard(): Promise<A2AAgentCard> {
    const res = await fetch(`${this.agentUrl}/.well-known/agent.json`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch agent card: ${res.status}`);
    return res.json() as any;
  }

  async sendTask(message: A2AMessage, options?: { taskId?: string; sessionId?: string }): Promise<A2ATask> {
    return this.rpc('tasks/send', {
      id: options?.taskId || `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId: options?.sessionId,
      message,
    });
  }

  async sendTaskSubscribe(
    message: A2AMessage,
    onEvent: (event: any) => void,
    options?: { taskId?: string },
  ): Promise<void> {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: `${Date.now()}`,
      method: 'tasks/sendSubscribe',
      params: {
        id: options?.taskId || `task_${Date.now()}`,
        message,
      },
    });

    const res = await fetch(this.agentUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body,
    });

    if (!res.ok || !res.body) throw new Error(`SSE failed: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            onEvent(JSON.parse(line.slice(6)));
          } catch { /* skip malformed */ }
        }
      }
    }
  }

  async getTask(taskId: string): Promise<A2ATask> {
    return this.rpc('tasks/get', { id: taskId });
  }

  async cancelTask(taskId: string): Promise<A2ATask> {
    return this.rpc('tasks/cancel', { id: taskId });
  }

  async sendText(text: string, options?: { taskId?: string }): Promise<string> {
    const task = await this.sendTask(
      { role: 'user', parts: [{ type: 'text', text }] },
      options,
    );

    // Extract text from last agent message
    const agentMessages = task.history.filter(m => m.role === 'agent');
    const last = agentMessages[agentMessages.length - 1];
    if (!last) return '';

    return last.parts
      .filter(p => p.type === 'text')
      .map(p => (p as any).text)
      .join('\n');
  }
}
