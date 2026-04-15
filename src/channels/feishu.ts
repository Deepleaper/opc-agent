import { BaseChannel } from './index';
import type { Message } from '../core/types';

/**
 * Feishu / Lark Channel — v1.1.0
 *
 * Supports:
 * - Event Subscription (webhook) mode for receiving messages
 * - Bot send via Feishu Open API
 * - URL verification challenge
 * - Message card (interactive) responses
 * - Group chat & P2P messaging
 *
 * Env vars:
 *   FEISHU_APP_ID, FEISHU_APP_SECRET — app credentials
 *   FEISHU_VERIFICATION_TOKEN — event subscription verification
 *   FEISHU_ENCRYPT_KEY — (optional) event encryption key
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
  /** Webhook server port (default: 3002) */
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
  private server: import('http').Server | null = null;
  private tokenCache: FeishuTokenCache | null = null;
  private processedEvents = new Set<string>();

  constructor(config: FeishuChannelConfig = {}) {
    super();
    this.config = {
      appId: config.appId ?? process.env.FEISHU_APP_ID ?? '',
      appSecret: config.appSecret ?? process.env.FEISHU_APP_SECRET ?? '',
      verificationToken: config.verificationToken ?? process.env.FEISHU_VERIFICATION_TOKEN ?? '',
      encryptKey: config.encryptKey ?? process.env.FEISHU_ENCRYPT_KEY,
      port: config.port ?? 3002,
      apiBase: config.apiBase ?? 'https://open.feishu.cn',
    };
  }

  async start(): Promise<void> {
    if (!this.config.appId || !this.config.appSecret) {
      console.warn('[FeishuChannel] Missing appId/appSecret. Set FEISHU_APP_ID and FEISHU_APP_SECRET.');
      return;
    }

    const express = (await import('express')).default;
    const app = express();
    app.use(express.json());

    // Event subscription endpoint
    app.post('/feishu/event', async (req, res) => {
      try {
        const body = req.body;

        // URL verification challenge
        if (body.type === 'url_verification') {
          res.json({ challenge: body.challenge });
          return;
        }

        // Deduplicate events
        const eventId = body.header?.event_id;
        if (eventId && this.processedEvents.has(eventId)) {
          res.json({ ok: true });
          return;
        }
        if (eventId) {
          this.processedEvents.add(eventId);
          // Prune old events (keep last 1000)
          if (this.processedEvents.size > 1000) {
            const arr = [...this.processedEvents];
            this.processedEvents = new Set(arr.slice(-500));
          }
        }

        // Verify token
        if (this.config.verificationToken && body.header?.token !== this.config.verificationToken) {
          res.status(403).json({ error: 'Invalid verification token' });
          return;
        }

        // Handle im.message.receive_v1
        const event = body.event;
        if (body.header?.event_type === 'im.message.receive_v1' && this.handler) {
          const msgBody = event?.message;
          if (!msgBody) { res.json({ ok: true }); return; }

          // Only handle text messages for now
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
            // Acknowledge non-text silently
            res.json({ ok: true });
            return;
          }

          // Strip @bot mentions
          content = content.replace(/@_user_\d+/g, '').trim();
          if (!content) { res.json({ ok: true }); return; }

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
              chatType: msgBody.chat_type, // 'p2p' or 'group'
            },
          };

          const response = await this.handler(msg);
          await this.sendTextMessage(chatId, response.content);
        }

        res.json({ ok: true });
      } catch (err) {
        console.error('[FeishuChannel] Error handling event:', err);
        res.status(500).json({ error: 'Internal error' });
      }
    });

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', channel: 'feishu' });
    });

    this.server = app.listen(this.config.port, () => {
      console.log(`[FeishuChannel] Listening on port ${this.config.port}`);
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  /** Get tenant access token (cached) */
  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const resp = await fetch(`${this.config.apiBase}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: this.config.appId,
        app_secret: this.config.appSecret,
      }),
    });

    const data = await resp.json() as { tenant_access_token: string; expire: number; code: number };
    if (data.code !== 0) {
      throw new Error(`[FeishuChannel] Failed to get access token: ${JSON.stringify(data)}`);
    }

    this.tokenCache = {
      token: data.tenant_access_token,
      expiresAt: Date.now() + (data.expire - 60) * 1000, // refresh 60s early
    };
    return this.tokenCache.token;
  }

  /** Send a text message to a chat */
  async sendTextMessage(chatId: string, text: string): Promise<void> {
    const token = await this.getAccessToken();
    const resp = await fetch(`${this.config.apiBase}/open-apis/im/v1/messages?receive_id_type=chat_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      }),
    });

    if (!resp.ok) {
      console.error('[FeishuChannel] Failed to send message:', await resp.text());
    }
  }

  /** Send an interactive card message */
  async sendCardMessage(chatId: string, card: Record<string, unknown>): Promise<void> {
    const token = await this.getAccessToken();
    await fetch(`${this.config.apiBase}/open-apis/im/v1/messages?receive_id_type=chat_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      }),
    });
  }
}
