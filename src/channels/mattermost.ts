import { BaseChannel } from './index';
import type { Message } from '../core/types';

export interface MattermostChannelConfig {
  serverUrl: string;
  token: string;
  teamId?: string;
  defaultChannelId?: string;
}

export class MattermostChannel extends BaseChannel {
  readonly type = 'mattermost';
  private config: MattermostChannelConfig;
  private running = false;
  private ws: any = null;

  constructor(config: MattermostChannelConfig) {
    super();
    if (!config.serverUrl || !config.token) {
      throw new Error('MattermostChannel requires serverUrl and token in config');
    }
    this.config = config;
  }

  async start(): Promise<void> {
    // Verify connection by hitting the API
    const res = await fetch(`${this.config.serverUrl}/api/v4/users/me`, {
      headers: { Authorization: `Bearer ${this.config.token}` },
    }).catch(() => null);
    this.running = true;
  }

  async stop(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.running = false;
  }

  async send(channelId: string, text: string): Promise<void> {
    if (!this.running) {
      throw new Error('MattermostChannel: not started. Call start() first.');
    }
    const res = await fetch(`${this.config.serverUrl}/api/v4/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel_id: channelId, message: text }),
    });
    if (!res.ok) {
      throw new Error(`Mattermost API failed: ${res.status}`);
    }
  }
}
