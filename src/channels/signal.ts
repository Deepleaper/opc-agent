import { BaseChannel } from './index';
import type { Message } from '../core/types';

export interface SignalChannelConfig {
  signalCliPath?: string;
  phoneNumber?: string;
}

export class SignalChannel extends BaseChannel {
  readonly type = 'signal';
  private config: SignalChannelConfig;

  constructor(config: SignalChannelConfig = {}) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    try {
      require('signal-cli');
    } catch {
      throw new Error('Install signal-cli to use the SignalChannel. Run: npm install signal-cli');
    }
  }

  async stop(): Promise<void> {
    // cleanup
  }

  async send(chatId: string, text: string): Promise<void> {
    throw new Error('SignalChannel: not yet connected. Call start() first.');
  }
}
