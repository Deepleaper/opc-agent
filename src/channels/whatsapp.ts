import { BaseChannel } from './index';
import type { Message } from '../core/types';

export interface WhatsAppChannelConfig {
  phoneNumber?: string;
  authDir?: string;
}

export class WhatsAppChannel extends BaseChannel {
  readonly type = 'whatsapp';
  private config: WhatsAppChannelConfig;

  constructor(config: WhatsAppChannelConfig = {}) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    try {
      require('@whiskeysockets/baileys');
    } catch {
      throw new Error('Install @whiskeysockets/baileys to use the WhatsAppChannel. Run: npm install @whiskeysockets/baileys');
    }
  }

  async stop(): Promise<void> {
    // cleanup
  }

  async send(chatId: string, text: string): Promise<void> {
    throw new Error('WhatsAppChannel: not yet connected. Call start() first.');
  }
}
