import type { Message } from '../core/types';
import { BaseChannel } from './index';

/**
 * Telegram channel — basic webhook handler for Telegram Bot API.
 * Set TELEGRAM_BOT_TOKEN env var or pass in config.
 */
export class TelegramChannel extends BaseChannel {
  readonly type = 'telegram';
  private token: string;
  private webhookUrl?: string;
  private server: import('http').Server | null = null;
  private port: number;

  constructor(options: { token?: string; webhookUrl?: string; port?: number } = {}) {
    super();
    this.token = options.token ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
    this.webhookUrl = options.webhookUrl;
    this.port = options.port ?? 3001;
  }

  async start(): Promise<void> {
    if (!this.token) {
      console.warn('[TelegramChannel] No bot token provided. Set TELEGRAM_BOT_TOKEN or pass token in config.');
      return;
    }

    const express = (await import('express')).default;
    const app = express();
    app.use(express.json());

    app.post(`/webhook/${this.token}`, async (req, res) => {
      try {
        const update = req.body;
        if (update.message?.text && this.handler) {
          const msg: Message = {
            id: `tg_${update.message.message_id}`,
            role: 'user',
            content: update.message.text,
            timestamp: update.message.date * 1000,
            metadata: {
              sessionId: `tg_${update.message.chat.id}`,
              chatId: update.message.chat.id,
              userId: update.message.from?.id,
              platform: 'telegram',
            },
          };

          const response = await this.handler(msg);
          await this.sendMessage(update.message.chat.id, response.content);
        }
        res.json({ ok: true });
      } catch (err) {
        console.error('[TelegramChannel] Error handling update:', err);
        res.status(500).json({ error: 'Internal error' });
      }
    });

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', channel: 'telegram' });
    });

    return new Promise((resolve) => {
      this.server = app.listen(this.port, () => {
        console.log(`[TelegramChannel] Webhook server on port ${this.port}`);
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

  private async sendMessage(chatId: number, text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
      });
    } catch (err) {
      console.error('[TelegramChannel] Failed to send message:', err);
    }
  }
}
