import { BaseChannel } from './index';
import type { Message } from '../core/types';
import { Logger } from '../core/logger';
import * as http from 'http';
import * as crypto from 'crypto';

// ── Webhook Types ───────────────────────────────────────────

export interface WebhookConfig {
  port?: number;
  path?: string;
  secret?: string;
  retryAttempts?: number;
  retryDelayMs?: number;
  outgoing?: WebhookOutgoing[];
}

export interface WebhookOutgoing {
  name: string;
  url: string;
  secret?: string;
  events: string[];
}

export interface WebhookPayload {
  event: string;
  data: unknown;
  timestamp: number;
  id: string;
}

// ── Webhook Channel ─────────────────────────────────────────

export class WebhookChannel extends BaseChannel {
  type = 'webhook';
  private config: WebhookConfig;
  private server: http.Server | null = null;
  private logger = new Logger('webhook-channel');
  private outgoing: WebhookOutgoing[] = [];

  constructor(config?: WebhookConfig) {
    super();
    this.config = config ?? {};
    this.outgoing = config?.outgoing ?? [];
  }

  async start(): Promise<void> {
    const port = this.config.port ?? 3100;
    const path = this.config.path ?? '/webhook';

    this.server = http.createServer(async (req, res) => {
      if (req.url !== path || req.method !== 'POST') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      try {
        const body = await this.readBody(req);

        // Verify signature if secret configured
        if (this.config.secret) {
          const signature = req.headers['x-webhook-signature'] as string;
          if (!this.verifySignature(body, signature, this.config.secret)) {
            res.writeHead(401);
            res.end('Invalid signature');
            return;
          }
        }

        const payload: WebhookPayload = JSON.parse(body);
        const message: Message = {
          id: payload.id ?? `wh_${Date.now()}`,
          role: 'user',
          content: typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data),
          timestamp: payload.timestamp ?? Date.now(),
          metadata: { channel: 'webhook', event: payload.event },
        };

        if (this.handler) {
          const response = await this.handler(message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', response: response.content }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
        }
      } catch (err) {
        this.logger.error('Webhook error', { error: (err as Error).message });
        res.writeHead(500);
        res.end('Internal error');
      }
    });

    return new Promise((resolve) => {
      this.server!.listen(port, () => {
        this.logger.info('Webhook channel started', { port, path });
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('Webhook channel stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /** Send a webhook to outgoing endpoints */
  async send(event: string, data: unknown): Promise<void> {
    const targets = this.outgoing.filter(o => o.events.includes(event) || o.events.includes('*'));

    for (const target of targets) {
      const payload: WebhookPayload = {
        event,
        data,
        timestamp: Date.now(),
        id: `wh_out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      };

      await this.sendWithRetry(target, payload);
    }
  }

  private async sendWithRetry(target: WebhookOutgoing, payload: WebhookPayload): Promise<void> {
    const maxRetries = this.config.retryAttempts ?? 3;
    const retryDelay = this.config.retryDelayMs ?? 1000;
    const body = JSON.stringify(payload);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.httpPost(target.url, body, target.secret);
        return;
      } catch (err) {
        if (attempt === maxRetries) {
          this.logger.error('Webhook delivery failed', { target: target.name, error: (err as Error).message });
          throw err;
        }
        await new Promise(r => setTimeout(r, retryDelay * Math.pow(2, attempt)));
      }
    }
  }

  private httpPost(url: string, body: string, secret?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (secret) {
        headers['x-webhook-signature'] = this.createSignature(body, secret);
      }

      const req = http.request(
        { hostname: urlObj.hostname, port: urlObj.port, path: urlObj.pathname, method: 'POST', headers },
        (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
          res.resume();
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.on('error', reject);
    });
  }

  verifySignature(body: string, signature: string, secret: string): boolean {
    if (!signature) return false;
    const expected = this.createSignature(body, secret);
    if (signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  createSignature(body: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  addOutgoing(outgoing: WebhookOutgoing): void {
    this.outgoing.push(outgoing);
  }
}
