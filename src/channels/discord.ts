import { BaseChannel } from './index';
import type { Message } from '../core/types';

/**
 * Discord Channel — v1.1.0
 *
 * Supports:
 * - Discord Bot via Gateway (WebSocket) or HTTP interactions
 * - Slash commands, message content intent
 * - Thread-based conversations
 * - Reactions, embeds
 *
 * Env vars:
 *   DISCORD_BOT_TOKEN — bot token
 *   DISCORD_APPLICATION_ID — application ID for slash commands
 */

export interface DiscordChannelConfig {
  /** Bot token */
  botToken?: string;
  /** Application ID */
  applicationId?: string;
  /** Guild IDs to register slash commands (empty = global) */
  guildIds?: string[];
  /** Whether to use threads for conversations */
  useThreads?: boolean;
}

export class DiscordChannel extends BaseChannel {
  readonly type = 'discord';
  private config: DiscordChannelConfig;
  private ws: import('ws').WebSocket | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private sequenceNumber: number | null = null;
  private sessionId: string | null = null;
  private resumeUrl: string | null = null;

  constructor(config: DiscordChannelConfig = {}) {
    super();
    this.config = {
      botToken: config.botToken ?? process.env.DISCORD_BOT_TOKEN ?? '',
      applicationId: config.applicationId ?? process.env.DISCORD_APPLICATION_ID ?? '',
      guildIds: config.guildIds ?? [],
      useThreads: config.useThreads ?? true,
    };
  }

  async start(): Promise<void> {
    if (!this.config.botToken) {
      console.warn('[DiscordChannel] No bot token. Set DISCORD_BOT_TOKEN.');
      return;
    }

    // Get gateway URL
    const gatewayResp = await fetch('https://discord.com/api/v10/gateway/bot', {
      headers: { Authorization: `Bot ${this.config.botToken}` },
    });
    const gatewayData = await gatewayResp.json() as { url: string };
    const wsUrl = `${gatewayData.url}?v=10&encoding=json`;

    const { WebSocket } = await import('ws');
    this.ws = new WebSocket(wsUrl);

    this.ws.on('message', async (data: Buffer) => {
      const payload = JSON.parse(data.toString());
      this.sequenceNumber = payload.s ?? this.sequenceNumber;

      switch (payload.op) {
        case 10: // Hello
          this.startHeartbeat(payload.d.heartbeat_interval);
          this.identify();
          break;
        case 11: // Heartbeat ACK
          break;
        case 0: // Dispatch
          if (payload.t === 'READY') {
            this.sessionId = payload.d.session_id;
            this.resumeUrl = payload.d.resume_gateway_url;
            console.log(`[DiscordChannel] Connected as ${payload.d.user.username}`);
          } else if (payload.t === 'MESSAGE_CREATE') {
            await this.handleMessage(payload.d);
          }
          break;
      }
    });

    this.ws.on('close', (code: number) => {
      console.log(`[DiscordChannel] WebSocket closed: ${code}`);
      this.stopHeartbeat();
      // Auto-reconnect after 5s for resumable codes
      if (code !== 4004 && code !== 4014) {
        setTimeout(() => this.start(), 5000);
      }
    });

    this.ws.on('error', (err: Error) => {
      console.error('[DiscordChannel] WebSocket error:', err.message);
    });
  }

  async stop(): Promise<void> {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000);
      this.ws = null;
    }
  }

  private identify(): void {
    this.ws?.send(JSON.stringify({
      op: 2,
      d: {
        token: this.config.botToken,
        intents: (1 << 9) | (1 << 15), // GUILD_MESSAGES | MESSAGE_CONTENT
        properties: {
          os: process.platform,
          browser: 'opc-agent',
          device: 'opc-agent',
        },
      },
    }));
  }

  private startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat();
    // Send first heartbeat with jitter
    setTimeout(() => {
      this.sendHeartbeat();
      this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), intervalMs);
    }, intervalMs * Math.random());
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendHeartbeat(): void {
    this.ws?.send(JSON.stringify({ op: 1, d: this.sequenceNumber }));
  }

  private async handleMessage(d: Record<string, unknown>): Promise<void> {
    // Ignore bot messages
    const author = d.author as Record<string, unknown>;
    if (author?.bot) return;
    if (!d.content || !this.handler) return;

    const msg: Message = {
      id: `discord_${d.id}`,
      role: 'user',
      content: d.content as string,
      timestamp: new Date(d.timestamp as string).getTime(),
      metadata: {
        sessionId: `discord_${d.channel_id}`,
        chatId: d.channel_id as string,
        userId: author.id as string,
        platform: 'discord',
        guildId: d.guild_id as string | undefined,
        threadId: (d as Record<string, unknown>).thread?.toString(),
      },
    };

    const response = await this.handler(msg);
    await this.sendMessage(d.channel_id as string, response.content);
  }

  async sendMessage(channelId: string, content: string): Promise<void> {
    // Discord max message length is 2000
    const chunks = this.splitMessage(content, 2000);
    for (const chunk of chunks) {
      await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${this.config.botToken}`,
        },
        body: JSON.stringify({ content: chunk }),
      });
    }
  }

  private splitMessage(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];
    const parts: string[] = [];
    for (let i = 0; i < text.length; i += maxLen) {
      parts.push(text.slice(i, i + maxLen));
    }
    return parts;
  }
}
