import { BaseChannel } from './index';
import type { Message } from '../core/types';

export interface SMSChannelConfig {
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
}

export class SMSChannel extends BaseChannel {
  readonly type = 'sms';
  private config: SMSChannelConfig;

  constructor(config: SMSChannelConfig = {}) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    try {
      require('twilio');
    } catch {
      throw new Error('Install twilio to use the SMSChannel. Run: npm install twilio');
    }
  }

  async stop(): Promise<void> {
    // cleanup
  }

  async send(chatId: string, text: string): Promise<void> {
    throw new Error('SMSChannel: not yet connected. Call start() first.');
  }
}
