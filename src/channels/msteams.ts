import { BaseChannel } from './index';
import type { Message } from '../core/types';

export interface MSTeamsChannelConfig {
  appId?: string;
  appPassword?: string;
}

export class MSTeamsChannel extends BaseChannel {
  readonly type = 'msteams';
  private config: MSTeamsChannelConfig;

  constructor(config: MSTeamsChannelConfig = {}) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    try {
      require('botframework-connector');
    } catch {
      throw new Error('Install botframework-connector to use the MSTeamsChannel. Run: npm install botframework-connector');
    }
  }

  async stop(): Promise<void> {
    // cleanup
  }

  async send(chatId: string, text: string): Promise<void> {
    throw new Error('MSTeamsChannel: not yet connected. Call start() first.');
  }
}
