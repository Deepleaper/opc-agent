// AG-UI Client — Connects to AG-UI SSE endpoint
import type { AGUIEvent, AGUIRunRequest, AGUIMessage } from './types';
import { isValidEventType } from './types';

export class AGUIClient {
  private endpoint: string;
  private controller?: AbortController;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async run(request: AGUIRunRequest, onEvent: (event: AGUIEvent) => void): Promise<void> {
    this.controller = new AbortController();

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: this.controller.signal,
    });

    if (!res.ok) {
      throw new Error(`AG-UI request failed: ${res.status} ${res.statusText}`);
    }

    if (!res.body) {
      throw new Error('No response body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: AGUIEvent = JSON.parse(line.slice(6));
              if (event.type && isValidEventType(event.type)) {
                onEvent(event);
              }
            } catch {
              // skip malformed events
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async sendText(text: string, onChunk: (text: string) => void): Promise<string> {
    let fullText = '';
    const request: AGUIRunRequest = {
      messages: [{ id: `msg_${Date.now()}`, role: 'user', content: text }],
    };

    await this.run(request, (event) => {
      if (event.type === 'TEXT_MESSAGE_CONTENT') {
        const delta = (event as any).delta as string;
        fullText += delta;
        onChunk(delta);
      }
    });

    return fullText;
  }

  abort(): void {
    this.controller?.abort();
    this.controller = undefined;
  }
}
