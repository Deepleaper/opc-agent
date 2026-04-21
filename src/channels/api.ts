// v2 API channel — REST/JSON API channel for programmatic agent access
import type { ApiChannelConfig, IChannel, Message } from '../core/types';
import express from 'express';
import type { Express } from 'express';

export class ApiChannel implements IChannel {
  readonly type = 'api';
  private app: Express;
  private handler?: (msg: Message) => Promise<Message>;
  private server?: ReturnType<Express['listen']>;

  constructor(private config: ApiChannelConfig) {
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes(): void {
    const base = this.config.basePath ?? '/api';

    this.app.post(`${base}/chat`, async (req, res) => {
      if (!this.handler) { res.status(503).json({ error: 'no handler' }); return; }
      try {
        const msg: Message = { id: Date.now().toString(), role: 'user', content: req.body.content ?? '', timestamp: Date.now() };
        const reply = await this.handler(msg);
        res.json(reply);
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    this.app.get(`${base}/health`, (_req, res) => { res.json({ status: 'ok' }); });
  }

  onMessage(handler: (msg: Message) => Promise<Message>): void {
    this.handler = handler;
  }

  async start(): Promise<void> {
    const port = this.config.port ?? 8080;
    return new Promise((resolve) => {
      this.server = this.app.listen(port, resolve);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) { resolve(); return; }
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}
