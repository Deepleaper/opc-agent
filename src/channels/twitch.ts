import { BaseChannel } from './index';
import type { Message } from '../core/types';

export interface TwitchChannelConfig {
  username: string;
  oauthToken: string;
  channels: string[];
}

export class TwitchChannel extends BaseChannel {
  readonly type = 'twitch';
  private config: TwitchChannelConfig;
  private client: any = null;
  private running = false;

  constructor(config: TwitchChannelConfig) {
    super();
    if (!config.username || !config.oauthToken || !config.channels?.length) {
      throw new Error('TwitchChannel requires username, oauthToken, and channels in config');
    }
    this.config = config;
  }

  async start(): Promise<void> {
    let tmi: any;
    try {
      tmi = require('tmi.js');
    } catch {
      throw new Error('Install tmi.js to use the TwitchChannel. Run: npm install tmi.js');
    }
    this.client = new tmi.Client({
      identity: { username: this.config.username, password: this.config.oauthToken },
      channels: this.config.channels,
    });
    await this.client.connect();
    this.running = true;

    this.client.on('message', async (channel: string, tags: any, message: string, self: boolean) => {
      if (self || !this.handler) return;
      const msg: Message = {
        id: tags.id || Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: Date.now(),
        metadata: { channel, username: tags.username, tags },
      };
      await this.handler(msg);
    });
  }

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
    this.running = false;
  }

  async send(channel: string, text: string): Promise<void> {
    if (!this.running || !this.client) {
      throw new Error('TwitchChannel: not started. Call start() first.');
    }
    await this.client.say(channel, text);
  }
}
