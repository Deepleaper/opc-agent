import { BaseChannel } from './index';
import type { Message } from '../core/types';

export interface GoogleChatChannelConfig {
  webhookUrl: string;
}

export class GoogleChatChannel extends BaseChannel {
  readonly type = 'googlechat';
  private config: GoogleChatChannelConfig;
  private running = false;

  constructor(config: GoogleChatChannelConfig) {
    super();
    if (!config.webhookUrl) {
      throw new Error('GoogleChatChannel requires webhookUrl in config');
    }
    this.config = config;
  }

  async start(): Promise<void> {
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async send(spaceId: string, text: string): Promise<void> {
    if (!this.running) {
      throw new Error('GoogleChatChannel: not started. Call start() first.');
    }
    const res = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      throw new Error(`Google Chat webhook failed: ${res.status}`);
    }
  }
}
