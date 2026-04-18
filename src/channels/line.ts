import { BaseChannel } from './index';
import type { Message } from '../core/types';

export interface LINEChannelConfig {
  channelAccessToken?: string;
  channelSecret?: string;
}

export class LINEChannel extends BaseChannel {
  readonly type = 'line';
  private config: LINEChannelConfig;

  constructor(config: LINEChannelConfig = {}) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    try {
      require('@line/bot-sdk');
    } catch {
      throw new Error('Install @line/bot-sdk to use the LINEChannel. Run: npm install @line/bot-sdk');
    }
  }

  async stop(): Promise<void> {
    // cleanup
  }

  async send(chatId: string, text: string): Promise<void> {
    throw new Error('LINEChannel: not yet connected. Call start() first.');
  }
}
