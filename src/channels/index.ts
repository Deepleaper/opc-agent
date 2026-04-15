import type { IChannel, Message } from '../core/types';

export type { IChannel } from '../core/types';

export abstract class BaseChannel implements IChannel {
  abstract type: string;
  protected handler: ((message: Message) => Promise<Message>) | null = null;

  onMessage(handler: (message: Message) => Promise<Message>): void {
    this.handler = handler;
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
}
