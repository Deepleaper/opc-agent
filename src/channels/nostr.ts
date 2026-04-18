import { BaseChannel } from './index';
import type { Message } from '../core/types';

export interface NostrChannelConfig {
  privateKey?: string;
  relays?: string[];
}

export class NostrChannel extends BaseChannel {
  readonly type = 'nostr';
  private config: NostrChannelConfig;

  constructor(config: NostrChannelConfig = {}) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    try {
      require('nostr-tools');
    } catch {
      throw new Error('Install nostr-tools to use the NostrChannel. Run: npm install nostr-tools');
    }
  }

  async stop(): Promise<void> {
    // cleanup
  }

  async send(chatId: string, text: string): Promise<void> {
    throw new Error('NostrChannel: not yet connected. Call start() first.');
  }
}
