import { BaseChannel } from './index';
import type { Message } from '../core/types';

export interface IMessageChannelConfig {
  applescriptPath?: string;
}

export class IMessageChannel extends BaseChannel {
  readonly type = 'imessage';
  private config: IMessageChannelConfig;

  constructor(config: IMessageChannelConfig = {}) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    try {
      require('macOS iMessage CLI');
    } catch {
      throw new Error('Install macOS iMessage CLI to use the IMessageChannel. Run: npm install macOS iMessage CLI');
    }
  }

  async stop(): Promise<void> {
    // cleanup
  }

  async send(chatId: string, text: string): Promise<void> {
    throw new Error('IMessageChannel: not yet connected. Call start() first.');
  }
}
