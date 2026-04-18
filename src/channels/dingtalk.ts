import { BaseChannel } from './index';
import type { Message } from '../core/types';

export interface DingTalkChannelConfig {
  webhookUrl: string;
  secret?: string;
  appKey?: string;
  appSecret?: string;
}

export class DingTalkChannel extends BaseChannel {
  readonly type = 'dingtalk';
  private config: DingTalkChannelConfig;
  private running = false;

  constructor(config: DingTalkChannelConfig) {
    super();
    if (!config.webhookUrl) {
      throw new Error('DingTalkChannel requires webhookUrl in config');
    }
    this.config = config;
  }

  async start(): Promise<void> {
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async send(chatId: string, text: string): Promise<void> {
    if (!this.running) {
      throw new Error('DingTalkChannel: not started. Call start() first.');
    }
    const body = JSON.stringify({ msgtype: 'text', text: { content: text } });
    const res = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) {
      throw new Error(`DingTalk webhook failed: ${res.status}`);
    }
  }
}
