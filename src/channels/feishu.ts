import { BaseChannel } from './index';
import type { Message } from '../core/types';
import * as http from 'http';
import * as https from 'https';

/**
 * Feishu / Lark Channel — v1.1.0
 *
 * Supports:
 * - Event Subscription (webhook) mode for receiving messages
 * - Bot send via Feishu Open API
 * - URL verification challenge
 * - Message card (interactive) responses
 * - Group chat & P2P messaging
 * - Event deduplication
 * - No external dependencies (uses Node.js built-in http/https)
 */

export interface FeishuChannelConfig {
  /** Feishu App ID */
  appId?: string;
  /** Feishu App Secret */
  appSecret?: string;
  /** Verification token for event subscription */
  verificationToken?: string;
  /** Encrypt key (optional, for encrypted events) */
  encryptKey?: string;
  /** Webhook server port (default: 8081) */
  port?: number;
  /** API base URL (use 'https://open.larksuite.com' for Lark international) */
  apiBase?: string;
}

interface FeishuTokenCache {
  token: string;
  expiresAt: number;
}

export class FeishuChannel extends BaseChannel {
  readonly type = 'feishu';
  private config: Required<Pick<FeishuChannelConfig, 'port' | 'apiBase'>> & FeishuChannelConfig;
  private server: http.Server | null = null;
  private tokenCache: FeishuTokenCache | null = null;
  private processedEvents = new Set<string>();

  constructor(config: FeishuChannelConfig = {}) {
    super();
    this.config = {
      appId: config.appId ?? process.env.FEISHU_APP_ID ?? '',
      appSecret: config.appSecret ?? process.env.FEISHU_APP_SECRET ?? '',
      verificationToken: config.verificationToken ?? process.env.FEISHU_VERIFICATION_TOKEN ?? '',
      encryptKey: config.encryptKey ?? process.env.FEISHU_ENCRYPT_KEY,
      port: config.port ?? 8081,
      apiBase: config.apiBase ?? 'https://open.feishu.cn',
    };
  }

  async start(): Promise<void> {
    if (!this.config.appId || !this.config.appSecret) {
      console.warn('[FeishuChannel] Missing appId/appSecret. Set FEISHU_APP_ID and FEISHU_APP_SECRET.');
      return;
    }

    this.server = http.createServer(async (req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', channel: 'feishu' }));
        return;
      }

      if (req.method !== 'POST') {
        res.writeHead(404);
        res.end();
        return;
      }

      try {
        const body = await this.readBody(req);
        const parsed = JSON.parse(body);
        await this.handleEvent(parsed, res);
      } catch (err) {
        console.error('[FeishuChannel] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal error' }));
      }
    });

    return new Promise((resolve) => {
      this.server!.listen(this.config.port, () => {
        console.log(`[FeishuChannel] Listening on port ${this.config.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) return resolve();
      this.server.close((err) => (err ? reject(err) : resolve()));
      this.server = null;
    });
  }

  /** Handle Feishu event */
  private async handleEvent(body: any, res: http.ServerResponse): Promise<void> {
    // URL verification challenge
    if (body.type === 'url_verification') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ challenge: body.challenge }));
      return;
    }

    // Deduplicate events
    const eventId = body.header?.event_id;
    if (eventId && this.processedEvents.has(eventId)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (eventId) {
      this.processedEvents.add(eventId);
      if (this.processedEvents.size > 1000) {
        const arr = [...this.processedEvents];
        this.processedEvents = new Set(arr.slice(-500));
      }
    }

    // Verify token
    if (this.config.verificationToken && body.header?.token !== this.config.verificationToken) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid verification token' }));
      return;
    }

    // Handle im.message.receive_v1
    const event = body.event;
    if (body.header?.event_type === 'im.message.receive_v1' && this.handler) {
      const msgBody = event?.message;
      if (!msgBody) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      const msgType = msgBody.message_type;
      let content = '';
      if (msgType === 'text') {
        try {
          const parsed = JSON.parse(msgBody.content);
          content = parsed.text ?? '';
        } catch {
          content = msgBody.content ?? '';
        }
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // Strip @bot mentions
      content = content.replace(/@_user_\d+/g, '').trim();
      if (!content) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      const chatId = msgBody.chat_id;
      const senderId = event.sender?.sender_id?.open_id ?? 'unknown';

      const msg: Message = {
        id: `feishu_${msgBody.message_id}`,
        role: 'user',
        content,
        timestamp: parseInt(msgBody.create_time, 10) || Date.now(),
        metadata: {
          sessionId: `feishu_${chatId}`,
          chatId,
          userId: senderId,
          platform: 'feishu',
          messageId: msgBody.message_id,
          chatType: msgBody.chat_type,
        },
      };

      // Don't block the response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));

      try {
        const response = await this.handler(msg);
        await this.sendTextMessage(chatId, response.content);
      } catch (err) {
        console.error('[FeishuChannel] Handler error:', err);
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  }

  /** Parse Feishu event body (exported for testing) */
  static parseEventBody(body: any): { type: string; challenge?: string; eventType?: string; content?: string; chatId?: string; senderId?: string; messageId?: string } {
    if (body.type === 'url_verification') {
      return { type: 'url_verification', challenge: body.challenge };
    }

    const eventType = body.header?.event_type;
    const event = body.event;

    if (eventType === 'im.message.receive_v1' && event?.message) {
      const msgBody = event.message;
      let content = '';
      if (msgBody.message_type === 'text') {
        try {
          const parsed = JSON.parse(msgBody.content);
          content = parsed.text ?? '';
        } catch {
          content = msgBody.content ?? '';
        }
      }

      return {
        type: 'message',
        eventType,
        content: content.replace(/@_user_\d+/g, '').trim(),
        chatId: msgBody.chat_id,
        senderId: event.sender?.sender_id?.open_id,
        messageId: msgBody.message_id,
      };
    }

    return { type: 'unknown', eventType };
  }

  /** Get tenant access token (cached) */
  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const body = JSON.stringify({
      app_id: this.config.appId,
      app_secret: this.config.appSecret,
    });

    const result = await this.httpsPost(
      `${this.config.apiBase}/open-apis/auth/v3/tenant_access_token/internal`,
      body
    );

    const data = JSON.parse(result);
    if (data.code !== 0) {
      throw new Error(`[FeishuChannel] Failed to get access token: ${result}`);
    }

    this.tokenCache = {
      token: data.tenant_access_token,
      expiresAt: Date.now() + (data.expire - 60) * 1000,
    };
    return this.tokenCache.token;
  }

  /** Send a text message to a chat */
  async sendTextMessage(chatId: string, text: string): Promise<void> {
    const token = await this.getAccessToken();
    const body = JSON.stringify({
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    });

    const url = `${this.config.apiBase}/open-apis/im/v1/messages?receive_id_type=chat_id`;
    await this.httpsPostWithAuth(url, body, token);
  }

  /** Send an interactive card message */
  async sendCardMessage(chatId: string, card: Record<string, unknown>): Promise<void> {
    const token = await this.getAccessToken();
    const body = JSON.stringify({
      receive_id: chatId,
      msg_type: 'interactive',
      content: JSON.stringify(card),
    });

    const url = `${this.config.apiBase}/open-apis/im/v1/messages?receive_id_type=chat_id`;
    await this.httpsPostWithAuth(url, body, token);
  }

  /** Read request body */
  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', reject);
    });
  }

  /** HTTPS POST */
  private httpsPost(url: string, body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const req = https.request({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString()));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  /** HTTPS POST with Bearer auth */
  private httpsPostWithAuth(url: string, body: string, token: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const req = https.request({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'Authorization': `Bearer ${token}`,
        },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString()));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}
