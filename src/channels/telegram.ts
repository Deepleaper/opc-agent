import type { Message } from '../core/types';
import { BaseChannel } from './index';

/**
 * Telegram channel — supports both long-polling and webhook modes.
 *
 * Config:
 *   token: bot token (or TELEGRAM_BOT_TOKEN env var)
 *   mode: 'polling' | 'webhook' (default: 'polling')
 *   webhookUrl: required for webhook mode
 *   port: webhook server port (default: 3001)
 *
 * Polling mode requires no public URL — ideal for dev/local.
 * Webhook mode is more efficient for production.
 */

export interface TelegramChannelConfig {
  token?: string;
  mode?: 'polling' | 'webhook';
  webhookUrl?: string;
  port?: number;
}

export class TelegramChannel extends BaseChannel {
  readonly type = 'telegram';
  private token: string;
  private mode: 'polling' | 'webhook';
  private webhookUrl?: string;
  private port: number;

  // Polling state
  private offset: number = 0;
  private polling: boolean = false;

  // Webhook state
  private server: import('http').Server | null = null;

  constructor(config: TelegramChannelConfig = {}) {
    super();
    this.token = config.token ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
    this.mode = config.mode ?? 'polling';
    this.webhookUrl = config.webhookUrl;
    this.port = config.port ?? 3001;
  }

  async start(): Promise<void> {
    if (!this.token) {
      console.warn('[TelegramChannel] No bot token provided. Set TELEGRAM_BOT_TOKEN or pass token in config.');
      return;
    }

    if (this.mode === 'webhook') {
      await this.startWebhook();
    } else {
      await this.startPolling();
    }
  }

  async stop(): Promise<void> {
    if (this.mode === 'webhook') {
      await this.stopWebhook();
    } else {
      this.polling = false;
    }
  }

  // ─── Polling Mode ────────────────────────────────────────

  private async startPolling(): Promise<void> {
    // Delete any existing webhook so polling works
    await this.apiCall('deleteWebhook');
    console.log(`[TelegramChannel] Started long-polling mode`);
    this.polling = true;
    this.poll();
  }

  private async poll(): Promise<void> {
    while (this.polling) {
      try {
        const updates = await this.getUpdates();
        for (const update of updates) {
          await this.processUpdate(update);
        }
      } catch (err) {
        console.error('[TelegramChannel] Polling error:', err);
        // Back off on error
        if (this.polling) {
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }
  }

  private async getUpdates(): Promise<any[]> {
    const url = `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.offset}&timeout=30&allowed_updates=["message"]`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40000); // 30s long-poll + 10s buffer

    try {
      const res = await fetch(url, { signal: controller.signal });
      const data = (await res.json()) as { ok: boolean; result: any[] };
      if (data.ok && data.result.length > 0) {
        this.offset = data.result[data.result.length - 1].update_id + 1;
      }
      return data.result || [];
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Webhook Mode ────────────────────────────────────────

  private async startWebhook(): Promise<void> {
    if (this.webhookUrl) {
      await this.apiCall('setWebhook', { url: `${this.webhookUrl}/webhook/${this.token}` });
    }

    const express = (await import('express')).default;
    const app = express();
    app.use(express.json());

    app.post(`/webhook/${this.token}`, async (req, res) => {
      try {
        await this.processUpdate(req.body);
        res.json({ ok: true });
      } catch (err) {
        console.error('[TelegramChannel] Webhook error:', err);
        res.status(500).json({ error: 'Internal error' });
      }
    });

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', channel: 'telegram', mode: 'webhook' });
    });

    return new Promise((resolve) => {
      this.server = app.listen(this.port, () => {
        console.log(`[TelegramChannel] Webhook server on port ${this.port}`);
        resolve();
      });
    });
  }

  private async stopWebhook(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) return resolve();
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  // ─── Shared ──────────────────────────────────────────────

  private async processUpdate(update: any): Promise<void> {
    const message = update.message || update.edited_message;
    if (!message?.text || !this.handler) return;

    const msg: Message = {
      id: `tg_${message.message_id}`,
      role: 'user',
      content: message.text,
      timestamp: message.date * 1000,
      metadata: {
        sessionId: `tg_${message.chat.id}`,
        chatId: message.chat.id,
        userId: message.from?.id,
        username: message.from?.username,
        firstName: message.from?.first_name,
        platform: 'telegram',
        chatType: message.chat.type,
      },
    };

    const response = await this.handler(msg);
    await this.sendMessage(message.chat.id, response.content);
  }

  async sendMessage(chatId: number | string, text: string): Promise<void> {
    // Telegram max message length is 4096
    const chunks = this.splitText(text, 4096);
    for (const chunk of chunks) {
      await this.apiCall('sendMessage', {
        chat_id: chatId,
        text: chunk,
        parse_mode: 'Markdown',
      });
    }
  }

  private async apiCall(method: string, body?: Record<string, unknown>): Promise<any> {
    const url = `https://api.telegram.org/bot${this.token}/${method}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      return await res.json();
    } catch (err) {
      console.error(`[TelegramChannel] API call ${method} failed:`, err);
      throw err;
    }
  }

  private splitText(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];
    const parts: string[] = [];
    for (let i = 0; i < text.length; i += maxLen) {
      parts.push(text.slice(i, i + maxLen));
    }
    return parts;
  }
}
