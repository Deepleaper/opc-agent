import { BaseChannel } from './index';
import type { Message } from '../core/types';

export interface IRCChannelConfig {
  host: string;
  port?: number;
  nick: string;
  channels: string[];
  tls?: boolean;
  password?: string;
}

export class IRCChannel extends BaseChannel {
  readonly type = 'irc';
  private config: IRCChannelConfig;
  private client: any = null;
  private running = false;

  constructor(config: IRCChannelConfig) {
    super();
    if (!config.host || !config.nick || !config.channels?.length) {
      throw new Error('IRCChannel requires host, nick, and channels in config');
    }
    this.config = config;
  }

  async start(): Promise<void> {
    let IRC: any;
    try {
      IRC = require('irc-framework');
    } catch {
      throw new Error('Install irc-framework to use the IRCChannel. Run: npm install irc-framework');
    }
    this.client = new IRC.Client();
    this.client.connect({
      host: this.config.host,
      port: this.config.port ?? (this.config.tls ? 6697 : 6667),
      nick: this.config.nick,
      tls: this.config.tls ?? false,
      password: this.config.password,
    });

    await new Promise<void>((resolve, reject) => {
      this.client.on('registered', () => {
        for (const ch of this.config.channels) {
          this.client.join(ch);
        }
        resolve();
      });
      this.client.on('error', (err: any) => reject(new Error(`IRC connection error: ${err.message || err}`)));
    });

    this.running = true;

    this.client.on('privmsg', async (event: any) => {
      if (!this.handler) return;
      const msg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: event.message,
        timestamp: Date.now(),
        metadata: { channel: event.target, nick: event.nick },
      };
      await this.handler(msg);
    });
  }

  async stop(): Promise<void> {
    if (this.client) {
      this.client.quit('Goodbye');
      this.client = null;
    }
    this.running = false;
  }

  async send(target: string, text: string): Promise<void> {
    if (!this.running || !this.client) {
      throw new Error('IRCChannel: not started. Call start() first.');
    }
    this.client.say(target, text);
  }
}
