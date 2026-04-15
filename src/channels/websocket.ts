import type { Message } from '../core/types';
import { BaseChannel } from './index';
import { WebSocketServer, type WebSocket } from 'ws';

/**
 * WebSocket channel — real-time bidirectional communication.
 */
export class WebSocketChannel extends BaseChannel {
  readonly type = 'websocket';
  private wss: WebSocketServer | null = null;
  private port: number;
  private clients: Set<WebSocket> = new Set();

  constructor(port: number = 3002) {
    super();
    this.port = port;
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: this.port });

      this.wss.on('connection', (ws) => {
        this.clients.add(ws);

        ws.on('message', async (data) => {
          if (!this.handler) return;

          try {
            const parsed = JSON.parse(data.toString());
            const msg: Message = {
              id: parsed.id ?? `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              role: 'user',
              content: parsed.content ?? parsed.message ?? data.toString(),
              timestamp: Date.now(),
              metadata: {
                sessionId: parsed.sessionId ?? 'ws-default',
                platform: 'websocket',
              },
            };

            const response = await this.handler(msg);
            ws.send(JSON.stringify({
              id: response.id,
              content: response.content,
              timestamp: response.timestamp,
            }));
          } catch (err) {
            ws.send(JSON.stringify({ error: 'Invalid message format' }));
          }
        });

        ws.on('close', () => {
          this.clients.delete(ws);
        });

        ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
      });

      this.wss.on('listening', () => {
        console.log(`[WebSocketChannel] Listening on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();

    return new Promise((resolve, reject) => {
      if (!this.wss) return resolve();
      this.wss.close((err) => (err ? reject(err) : resolve()));
    });
  }

  broadcast(content: string): void {
    const msg = JSON.stringify({ type: 'broadcast', content, timestamp: Date.now() });
    for (const client of this.clients) {
      if (client.readyState === 1) { // OPEN
        client.send(msg);
      }
    }
  }
}
