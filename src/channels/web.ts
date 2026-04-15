import express, { type Express, type Request, type Response } from 'express';
import type { Server } from 'http';
import type { Message } from '../core/types';
import { BaseChannel } from './index';

export class WebChannel extends BaseChannel {
  readonly type = 'web';
  private app: Express;
  private server: Server | null = null;
  private port: number;

  constructor(port: number = 3000) {
    super();
    this.port = port;
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    this.app.post('/chat', async (req: Request, res: Response) => {
      if (!this.handler) {
        res.status(503).json({ error: 'Agent not ready' });
        return;
      }

      const { message, sessionId } = req.body;
      if (!message) {
        res.status(400).json({ error: 'message is required' });
        return;
      }

      const msg: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        content: message,
        timestamp: Date.now(),
        metadata: { sessionId: sessionId ?? 'default' },
      };

      try {
        const response = await this.handler(msg);
        res.json({ response: response.content, id: response.id });
      } catch (err) {
        res.status(500).json({ error: 'Internal error' });
      }
    });

    // SSE streaming endpoint
    this.app.get('/stream', (req: Request, res: Response) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write('data: {"type":"connected"}\n\n');

      const interval = setInterval(() => {
        res.write('data: {"type":"heartbeat"}\n\n');
      }, 30000);

      req.on('close', () => clearInterval(interval));
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`[WebChannel] Listening on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) return resolve();
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}
