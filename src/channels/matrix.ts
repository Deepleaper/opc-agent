import { BaseChannel } from './index';
import type { Message } from '../core/types';

export interface MatrixChannelConfig {
  homeserverUrl?: string;
  accessToken?: string;
  userId?: string;
}

export class MatrixChannel extends BaseChannel {
  readonly type = 'matrix';
  private config: MatrixChannelConfig;

  constructor(config: MatrixChannelConfig = {}) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    try {
      require('matrix-js-sdk');
    } catch {
      throw new Error('Install matrix-js-sdk to use the MatrixChannel. Run: npm install matrix-js-sdk');
    }
  }

  async stop(): Promise<void> {
    // cleanup
  }

  async send(chatId: string, text: string): Promise<void> {
    throw new Error('MatrixChannel: not yet connected. Call start() first.');
  }
}
