import { BaseChannel } from './index';
import type { Message } from '../core/types';

/**
 * Slack Channel — v0.8.0
 * Slack Bot with Socket Mode / Events API support, threads, and slash commands.
 */

export interface SlackChannelConfig {
  /** Bot token (xoxb-...) */
  botToken: string;
  /** App-level token for Socket Mode (xapp-...) */
  appToken?: string;
  /** Signing secret for Events API verification */
  signingSecret?: string;
  /** Use Socket Mode (true) or Events API (false) */
  socketMode?: boolean;
  /** Port for Events API webhook server (default: 3001) */
  port?: number;
  /** Slash commands to register */
  slashCommands?: SlashCommandConfig[];
}

export interface SlashCommandConfig {
  command: string;
  description: string;
  handler?: (payload: SlashCommandPayload) => Promise<string>;
}

export interface SlashCommandPayload {
  command: string;
  text: string;
  userId: string;
  channelId: string;
  triggerId: string;
}

export interface SlackMessageEvent {
  type: string;
  channel: string;
  user: string;
  text: string;
  ts: string;
  threadTs?: string;
  botId?: string;
}

export class SlackChannel extends BaseChannel {
  type = 'slack';
  private config: SlackChannelConfig;
  private running = false;
  private slashHandlers: Map<string, SlashCommandConfig> = new Map();

  constructor(config: SlackChannelConfig) {
    super();
    this.config = config;

    for (const cmd of config.slashCommands ?? []) {
      this.slashHandlers.set(cmd.command, cmd);
    }
  }

  async start(): Promise<void> {
    this.running = true;

    if (this.config.socketMode && this.config.appToken) {
      await this.startSocketMode();
    } else {
      await this.startEventsAPI();
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    // Cleanup connections
  }

  /** Start Socket Mode connection */
  private async startSocketMode(): Promise<void> {
    // TODO: Implement with @slack/socket-mode
    // const { SocketModeClient } = await import('@slack/socket-mode');
    // const client = new SocketModeClient({ appToken: this.config.appToken! });
    // client.on('message', (event) => this.handleMessage(event));
    // await client.start();
  }

  /** Start Events API HTTP server */
  private async startEventsAPI(): Promise<void> {
    // TODO: Implement with express or http
    // const port = this.config.port ?? 3001;
    // Listen for POST /slack/events and /slack/commands
  }

  /** Handle incoming Slack message */
  async handleMessage(event: SlackMessageEvent): Promise<void> {
    // Ignore bot messages
    if (event.botId) return;

    const message = this.slackToMessage(event);
    if (this.handler) {
      const reply = await this.handler(message);
      await this.sendMessage(event.channel, reply.content, event.threadTs ?? event.ts);
    }
  }

  /** Handle slash command */
  async handleSlashCommand(payload: SlashCommandPayload): Promise<string> {
    const cmd = this.slashHandlers.get(payload.command);
    if (cmd?.handler) {
      return cmd.handler(payload);
    }

    // Default: pass to message handler
    const message: Message = {
      id: `slack-cmd-${Date.now()}`,
      role: 'user',
      content: `${payload.command} ${payload.text}`.trim(),
      timestamp: Date.now(),
      metadata: {
        channel: 'slack',
        channelId: payload.channelId,
        userId: payload.userId,
        isSlashCommand: true,
      },
    };

    if (this.handler) {
      const reply = await this.handler(message);
      return reply.content;
    }
    return 'Command received.';
  }

  /** Convert Slack event to Message */
  private slackToMessage(event: SlackMessageEvent): Message {
    return {
      id: event.ts,
      role: 'user',
      content: event.text,
      timestamp: parseFloat(event.ts) * 1000,
      metadata: {
        channel: 'slack',
        channelId: event.channel,
        userId: event.user,
        threadTs: event.threadTs,
      },
    };
  }

  /** Send a message to a Slack channel */
  async sendMessage(channel: string, text: string, threadTs?: string): Promise<void> {
    // TODO: Implement with @slack/web-api
    // const { WebClient } = await import('@slack/web-api');
    // const client = new WebClient(this.config.botToken);
    // await client.chat.postMessage({ channel, text, thread_ts: threadTs });
    void channel;
    void text;
    void threadTs;
  }
}
