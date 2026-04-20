import type { Message } from '../core/types';
import { BaseChannel } from './index';
import { VoiceProcessor, type VoiceConfig } from './voice';
import * as path from 'path';

/**
 * Telegram channel — production-quality Telegram bot integration.
 *
 * Features (aligned with OpenClaw):
 * - Live stream preview (sendMessage + editMessageText)
 * - Ack reaction on message receipt
 * - Typing indicator throughout processing
 * - HTML parse mode with Markdown fallback
 * - Smart text chunking (paragraph-aware)
 * - /start, /help, /status commands
 * - Photo/document caption handling
 * - Callback query (inline button) support
 * - Reply threading
 * - Error recovery with plain-text fallback
 * - Forum topic support
 * - Group mention filtering
 */

export interface TelegramChannelConfig {
  token?: string;
  mode?: 'polling' | 'webhook';
  webhookUrl?: string;
  webhookSecret?: string;
  port?: number;
  // Feature flags
  streaming?: boolean | 'off' | 'partial';
  ackReaction?: string; // emoji to react with on receipt, e.g. "👀"
  linkPreview?: boolean;
  textChunkLimit?: number;
  requireMention?: boolean; // for groups
  botUsername?: string; // for mention detection
  voiceReply?: boolean; // reply with voice when user sends voice message (default: true)
}

export class TelegramChannel extends BaseChannel {
  readonly type = 'telegram';
  private token: string;
  private mode: 'polling' | 'webhook';
  private webhookUrl?: string;
  private webhookSecret?: string;
  private port: number;
  private botUsername: string = '';
  private botInfo: any = null;

  // Config
  private streamingEnabled: boolean;
  private ackReaction: string;
  private linkPreview: boolean;
  private textChunkLimit: number;
  private requireMention: boolean;

  // Polling state
  private offset: number = 0;
  private polling: boolean = false;

  // Webhook state
  private server: import('http').Server | null = null;

  // Stream handler — set by runtime when provider supports streaming
  private streamHandler?: (msg: Message) => AsyncIterable<string>;

  // Voice processor for STT/TTS
  private voice: VoiceProcessor | null = null;
  private voiceReply: boolean = false;

  constructor(config: TelegramChannelConfig = {}) {
    super();
    this.token = config.token ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
    this.mode = config.mode ?? 'polling';
    this.webhookUrl = config.webhookUrl;
    this.webhookSecret = config.webhookSecret;
    this.port = config.port ?? 3001;

    // Feature config
    this.streamingEnabled = config.streaming !== false && config.streaming !== 'off';
    this.ackReaction = config.ackReaction ?? '👀';
    this.linkPreview = config.linkPreview ?? true;
    this.textChunkLimit = config.textChunkLimit ?? 4000;
    this.requireMention = config.requireMention ?? false;
    if (config.botUsername) this.botUsername = config.botUsername.replace('@', '').toLowerCase();

    // Initialize voice processor
    try {
      const voiceConfig: Partial<VoiceConfig> = {};
      if (process.env.OPENAI_API_KEY) voiceConfig.openaiApiKey = process.env.OPENAI_API_KEY;
      if (process.env.OPENAI_BASE_URL) voiceConfig.openaiBaseUrl = process.env.OPENAI_BASE_URL;
      this.voice = new VoiceProcessor(voiceConfig);
      this.voiceReply = config.voiceReply !== false; // default: reply with voice when user sends voice
    } catch { /* voice not available, silent fallback */ }
  }

  setStreamHandler(handler: (msg: Message) => AsyncIterable<string>): void {
    this.streamHandler = handler;
  }

  async start(): Promise<void> {
    if (!this.token) {
      console.warn('[TelegramChannel] No bot token provided. Set TELEGRAM_BOT_TOKEN or pass token in config.');
      return;
    }

    // Fetch bot info for username detection
    try {
      const me = await this.apiCall('getMe');
      if (me?.result) {
        this.botInfo = me.result;
        this.botUsername = (me.result.username ?? '').toLowerCase();
        console.log(`[TelegramChannel] Bot: @${this.botUsername}`);
      }
    } catch {}

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
          // Don't await — process concurrently for better responsiveness
          this.processUpdate(update).catch((err) => {
            console.error('[TelegramChannel] Update processing error:', err);
          });
        }
      } catch (err) {
        console.error('[TelegramChannel] Polling error:', err);
        if (this.polling) {
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }
  }

  private async getUpdates(): Promise<any[]> {
    const url = `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.offset}&timeout=30&allowed_updates=${encodeURIComponent('["message","callback_query","message_reaction"]')}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40000);

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
      const params: Record<string, unknown> = {
        url: `${this.webhookUrl}/webhook/${this.token}`,
        allowed_updates: ['message', 'callback_query', 'message_reaction'],
      };
      if (this.webhookSecret) params.secret_token = this.webhookSecret;
      await this.apiCall('setWebhook', params);
    }

    const express = (await import('express')).default;
    const app = express();
    app.use(express.json());

    app.post(`/webhook/${this.token}`, async (req, res) => {
      // Verify secret if configured
      if (this.webhookSecret && req.headers['x-telegram-bot-api-secret-token'] !== this.webhookSecret) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      try {
        // Don't await — respond quickly, process in background
        this.processUpdate(req.body).catch((err) => {
          console.error('[TelegramChannel] Webhook processing error:', err);
        });
        res.json({ ok: true });
      } catch (err) {
        console.error('[TelegramChannel] Webhook error:', err);
        res.status(500).json({ error: 'Internal error' });
      }
    });

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', channel: 'telegram', mode: 'webhook', bot: this.botUsername });
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

  // ─── Update Processing ──────────────────────────────────

  private async processUpdate(update: any): Promise<void> {
    // Handle callback queries (inline buttons)
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return;
    }

    const message = update.message || update.edited_message;
    if (!message || !this.handler) return;

    // Handle commands
    if (message.text?.startsWith('/')) {
      const handled = await this.handleCommand(message);
      if (handled) return;
    }

    // Extract text from various message types
    const text = message.text || message.caption;

    // Handle voice messages — STT transcription
    if (!text && (message.voice || message.audio) && this.voice?.isSTTAvailable()) {
      try {
        const fileId = message.voice?.file_id || message.audio?.file_id;
        if (fileId) {
          // Get file path from Telegram
          const fileInfo = await this.apiCall('getFile', { file_id: fileId });
          const filePath = fileInfo?.result?.file_path;
          if (filePath) {
            const downloadUrl = `https://api.telegram.org/file/bot${this.token}/${filePath}`;
            const localPath = path.join('.opc/voice-tmp', `voice-${Date.now()}.ogg`);
            await this.voice.downloadFile(downloadUrl, localPath);

            // Transcribe
            const transcribedText = await this.voice.speechToText(localPath);
            if (transcribedText) {
              // Send transcription as a quiet indicator
              await this.apiCall('sendMessage', {
                chat_id: message.chat.id,
                text: `🎤 <i>${transcribedText}</i>`,
                parse_mode: 'HTML',
                reply_to_message_id: message.message_id,
              });

              // Process as normal text message, mark as voice for reply handling
              const voiceMsg: Message = {
                id: `tg_${message.message_id}`,
                role: 'user',
                content: transcribedText,
                timestamp: message.date * 1000,
                metadata: {
                  sessionId: this.getSessionId(message),
                  chatId: message.chat.id,
                  userId: message.from?.id,
                  username: message.from?.username,
                  firstName: message.from?.first_name,
                  lastName: message.from?.last_name,
                  platform: 'telegram',
                  chatType: message.chat.type,
                  messageThreadId: message.message_thread_id,
                  replyToMessageId: message.message_id,
                  isVoice: true,
                },
              };
              this.handler(voiceMsg);
              return;
            }
          }
        }
      } catch (err: any) {
        console.error('[Telegram] Voice STT failed:', err.message);
        // Fall through — if STT fails, ignore the voice message gracefully
      }
    }

    if (!text) return;

    // Group mention filtering
    if (this.isGroupChat(message) && this.requireMention) {
      if (!this.isMentioned(text)) return;
    }

    // Build message object
    const msg: Message = {
      id: `tg_${message.message_id}`,
      role: 'user',
      content: text,
      timestamp: message.date * 1000,
      metadata: {
        sessionId: this.getSessionId(message),
        chatId: message.chat.id,
        userId: message.from?.id,
        username: message.from?.username,
        firstName: message.from?.first_name,
        lastName: message.from?.last_name,
        platform: 'telegram',
        chatType: message.chat.type,
        messageThreadId: message.message_thread_id,
        replyToMessageId: message.message_id,
      },
    };

    // Ack reaction — immediate visual feedback
    if (this.ackReaction) {
      this.setReaction(message.chat.id, message.message_id, this.ackReaction).catch(() => {});
    }

    // Typing indicator
    const threadId = message.message_thread_id;
    await this.sendTyping(message.chat.id, threadId);
    const typingInterval = setInterval(() => {
      this.sendTyping(message.chat.id, threadId).catch(() => {});
    }, 4000);

    try {
      if (this.streamingEnabled && this.streamHandler) {
        await this.streamResponse(message.chat.id, msg, message.message_id, threadId);
      } else {
        const response = await this.handler(msg);
        await this.sendFormattedMessage(message.chat.id, response.content, message.message_id, threadId);
      }

      // Remove ack reaction after successful response
      if (this.ackReaction) {
        this.setReaction(message.chat.id, message.message_id, '').catch(() => {});
      }
    } catch (err) {
      console.error('[TelegramChannel] Error processing message:', err);
      await this.sendFormattedMessage(message.chat.id, '⚠️ Sorry, something went wrong. Please try again.', message.message_id, threadId);
    } finally {
      clearInterval(typingInterval);
    }
  }

  // ─── Commands ───────────────────────────────────────────

  private async handleCommand(message: any): Promise<boolean> {
    const text = message.text ?? '';
    const command = text.split(' ')[0].split('@')[0].toLowerCase(); // Strip @botname

    switch (command) {
      case '/start':
        await this.sendFormattedMessage(
          message.chat.id,
          `👋 <b>Hello${message.from?.first_name ? ' ' + this.escapeHtml(message.from.first_name) : ''}!</b>\n\nI'm ready to help. Send me a message to get started.\n\nCommands:\n/help — Show available commands\n/status — Check bot status`,
          undefined,
          message.message_thread_id
        );
        return true;

      case '/help':
        await this.sendFormattedMessage(
          message.chat.id,
          `📖 <b>Available Commands</b>\n\n/start — Start conversation\n/help — Show this help\n/status — Bot status\n\nJust send a message and I'll respond!`,
          undefined,
          message.message_thread_id
        );
        return true;

      case '/status':
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const mins = Math.floor((uptime % 3600) / 60);
        await this.sendFormattedMessage(
          message.chat.id,
          `🟢 <b>Bot Status</b>\n\n⏱ Uptime: ${hours}h ${mins}m\n🤖 Bot: @${this.botUsername}\n💬 Mode: ${this.mode}\n📡 Streaming: ${this.streamingEnabled ? 'on' : 'off'}`,
          undefined,
          message.message_thread_id
        );
        return true;

      default:
        return false; // Not a recognized command, let it flow through as normal message
    }
  }

  // ─── Callback Queries (Inline Buttons) ──────────────────

  private async handleCallbackQuery(query: any): Promise<void> {
    // Answer the callback to remove loading state
    await this.apiCall('answerCallbackQuery', { callback_query_id: query.id });

    if (!this.handler || !query.data) return;

    const msg: Message = {
      id: `tg_cb_${query.id}`,
      role: 'user',
      content: `callback_data: ${query.data}`,
      timestamp: Date.now(),
      metadata: {
        sessionId: `tg_${query.message?.chat?.id ?? query.from.id}`,
        chatId: query.message?.chat?.id ?? query.from.id,
        userId: query.from.id,
        username: query.from.username,
        firstName: query.from.first_name,
        platform: 'telegram',
        chatType: query.message?.chat?.type ?? 'private',
        isCallback: true,
      },
    };

    try {
      const response = await this.handler(msg);
      const chatId = query.message?.chat?.id ?? query.from.id;
      await this.sendFormattedMessage(chatId, response.content);
    } catch (err) {
      console.error('[TelegramChannel] Callback query error:', err);
    }
  }

  // ─── Streaming ──────────────────────────────────────────

  private async streamResponse(chatId: number | string, msg: Message, replyTo?: number, threadId?: number): Promise<void> {
    if (!this.streamHandler) return;

    let sentMessageId: number | null = null;
    let fullText = '';
    let lastEditTime = 0;
    const EDIT_INTERVAL = 800; // Edit slightly faster than before
    const MIN_FIRST_SEND = 20; // Min chars before first send (avoid tiny initial message)

    const doEdit = async (final: boolean = false) => {
      if (!sentMessageId || !fullText) return;
      const displayText = final ? fullText : fullText + ' ▍'; // Cursor indicator while streaming
      try {
        await this.apiCall('editMessageText', {
          chat_id: chatId,
          message_id: sentMessageId,
          text: displayText,
          parse_mode: 'HTML',
          disable_web_page_preview: !this.linkPreview,
        });
        lastEditTime = Date.now();
      } catch {
        // HTML parse failed, try plain text
        try {
          await this.apiCall('editMessageText', {
            chat_id: chatId,
            message_id: sentMessageId,
            text: displayText,
          });
          lastEditTime = Date.now();
        } catch {}
      }
    };

    try {
      for await (const chunk of this.streamHandler(msg)) {
        fullText += chunk;

        if (!sentMessageId && fullText.length >= MIN_FIRST_SEND) {
          const result = await this.sendFormattedMessage(chatId, fullText + ' ▍', replyTo, threadId);
          sentMessageId = result?.message_id;
          lastEditTime = Date.now();
        } else if (sentMessageId) {
          const now = Date.now();
          if (now - lastEditTime >= EDIT_INTERVAL) {
            await doEdit();
          }
        }
      }

      // Final edit — remove cursor, clean formatting
      if (sentMessageId && fullText) {
        await doEdit(true);
      } else if (!sentMessageId && fullText) {
        // Never sent first message (very short response)
        await this.sendFormattedMessage(chatId, fullText, replyTo, threadId);
      }
    } catch (err) {
      if (!sentMessageId && fullText) {
        await this.sendFormattedMessage(chatId, fullText, replyTo, threadId);
      }
      throw err;
    }
  }

  // ─── Message Sending ───────────────────────────────────

  async sendFormattedMessage(chatId: number | string, text: string, replyTo?: number, threadId?: number): Promise<any> {
    const chunks = this.smartSplit(text, this.textChunkLimit);
    let lastResult: any = null;

    for (const chunk of chunks) {
      const baseParams: Record<string, unknown> = {
        chat_id: chatId,
        disable_web_page_preview: !this.linkPreview,
        ...(replyTo ? { reply_to_message_id: replyTo } : {}),
        ...(threadId ? { message_thread_id: threadId } : {}),
      };

      // Try HTML first (richer formatting)
      try {
        const htmlText = this.markdownToHtml(chunk);
        lastResult = await this.apiCall('sendMessage', {
          ...baseParams,
          text: htmlText,
          parse_mode: 'HTML',
        });
      } catch {
        // HTML failed, try Markdown
        try {
          lastResult = await this.apiCall('sendMessage', {
            ...baseParams,
            text: chunk,
            parse_mode: 'Markdown',
          });
        } catch {
          // All parsing failed, send plain text
          lastResult = await this.apiCall('sendMessage', {
            ...baseParams,
            text: chunk,
          });
        }
      }

      // Only reply to first chunk
      replyTo = undefined;
    }
    return lastResult?.result;
  }

  async sendMessage(chatId: number | string, text: string): Promise<void> {
    await this.sendFormattedMessage(chatId, text);
  }

  /** Send a voice message (TTS) alongside or instead of text */
  async sendVoiceMessage(chatId: number | string, text: string, replyTo?: number): Promise<boolean> {
    if (!this.voice || !this.voice.isTTSAvailable()) return false;
    try {
      // Generate audio
      const audioPath = await this.voice.textToSpeech(text.substring(0, 500)); // TTS limit
      if (!audioPath) return false;

      // Send voice via Telegram multipart upload
      const audioData = (await import('fs')).readFileSync(audioPath);
      const boundary = '----OPCVoice' + Date.now();
      const parts: Buffer[] = [];

      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`));
      if (replyTo) {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="reply_to_message_id"\r\n\r\n${replyTo}\r\n`));
      }
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="voice"; filename="reply.ogg"\r\nContent-Type: audio/ogg\r\n\r\n`));
      parts.push(audioData);
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

      const body = Buffer.concat(parts);
      const url = `https://api.telegram.org/bot${this.token}/sendVoice`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body,
      });

      // Cleanup temp file
      try { (await import('fs')).unlinkSync(audioPath); } catch { /* ignore */ }

      return response.ok;
    } catch (err: any) {
      console.error('[Telegram] TTS reply failed:', err.message);
      return false;
    }
  }

  // ─── Reactions ──────────────────────────────────────────

  private async setReaction(chatId: number | string, messageId: number, emoji: string): Promise<void> {
    try {
      await this.apiCall('setMessageReaction', {
        chat_id: chatId,
        message_id: messageId,
        reaction: emoji ? [{ type: 'emoji', emoji }] : [],
      });
    } catch {
      // Reactions may not be available in all chats
    }
  }

  // ─── Typing ─────────────────────────────────────────────

  private async sendTyping(chatId: number | string, threadId?: number): Promise<void> {
    await this.apiCall('sendChatAction', {
      chat_id: chatId,
      action: 'typing',
      ...(threadId ? { message_thread_id: threadId } : {}),
    }).catch(() => {});
  }

  // ─── Helpers ────────────────────────────────────────────

  private isGroupChat(message: any): boolean {
    return message.chat.type === 'group' || message.chat.type === 'supergroup';
  }

  private isMentioned(text: string): boolean {
    if (!this.botUsername) return true;
    const lower = text.toLowerCase();
    return lower.includes(`@${this.botUsername}`);
  }

  private getSessionId(message: any): string {
    const chatId = message.chat.id;
    const threadId = message.message_thread_id;
    if (threadId && message.chat.is_forum) {
      return `tg_${chatId}_topic_${threadId}`;
    }
    return `tg_${chatId}`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Convert basic Markdown to Telegram-safe HTML.
   * Handles: bold, italic, code, code blocks, links.
   */
  private markdownToHtml(text: string): string {
    let html = this.escapeHtml(text);

    // Code blocks (```...```)
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, code) => {
      return `<pre${lang ? ` class="language-${lang}"` : ''}>${code}</pre>`;
    });

    // Inline code (`...`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold (**...**)
    html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

    // Italic (*...*)
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<i>$1</i>');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    return html;
  }

  /**
   * Smart text splitting — prefer paragraph boundaries (blank lines) before hard length split.
   * Aligned with OpenClaw's chunkMode="newline" behavior.
   */
  private smartSplit(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];

    const parts: string[] = [];
    let remaining = text;

    while (remaining.length > maxLen) {
      // Try to find a paragraph break (double newline) near the limit
      let splitAt = remaining.lastIndexOf('\n\n', maxLen);
      if (splitAt < maxLen * 0.3) {
        // No good paragraph break, try single newline
        splitAt = remaining.lastIndexOf('\n', maxLen);
      }
      if (splitAt < maxLen * 0.3) {
        // No good newline, hard split at limit
        splitAt = maxLen;
      }

      parts.push(remaining.slice(0, splitAt).trimEnd());
      remaining = remaining.slice(splitAt).trimStart();
    }

    if (remaining) parts.push(remaining);
    return parts;
  }

  private async apiCall(method: string, body?: Record<string, unknown>): Promise<any> {
    const url = `https://api.telegram.org/bot${this.token}/${method}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json() as { ok: boolean; result?: any; description?: string };
      if (!data.ok) {
        const err = new Error(`Telegram API ${method} failed: ${data.description}`);
        (err as any).telegramError = data;
        throw err;
      }
      return data;
    } catch (err) {
      if ((err as any).telegramError) throw err;
      console.error(`[TelegramChannel] API call ${method} failed:`, err);
      throw err;
    }
  }
}
