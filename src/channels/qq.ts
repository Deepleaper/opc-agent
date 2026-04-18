import { BaseChannel } from './index';
import type { Message } from '../core/types';

export interface QQChannelConfig {
  appId?: string;
  token?: string;
  sandbox?: boolean;
}

export class QQChannel extends BaseChannel {
  readonly type = 'qq';
  private config: QQChannelConfig;

  constructor(config: QQChannelConfig = {}) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    try {
      require('qq-bot-sdk');
    } catch {
      throw new Error('Install qq-bot-sdk to use the QQChannel. Run: npm install qq-bot-sdk');
    }
  }

  async stop(): Promise<void> {
    // cleanup
  }

  async send(chatId: string, text: string): Promise<void> {
    throw new Error('QQChannel: not yet connected. Call start() first.');
  }
}
