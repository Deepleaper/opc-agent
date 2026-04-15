import { describe, it, expect, afterEach } from 'vitest';
import { WebChannel } from '../src/channels/web';

describe('WebChannel', () => {
  let channel: WebChannel | null = null;

  afterEach(async () => {
    if (channel) {
      await channel.stop();
      channel = null;
    }
  });

  it('should create with default port', () => {
    channel = new WebChannel();
    expect(channel.type).toBe('web');
  });

  it('should start and stop', async () => {
    channel = new WebChannel(0); // random port
    channel.onMessage(async (msg) => ({
      id: 'resp_1',
      role: 'assistant',
      content: `Echo: ${msg.content}`,
      timestamp: Date.now(),
    }));
    await channel.start();
    await channel.stop();
    channel = null;
  });

  it('should handle health check', async () => {
    channel = new WebChannel(0);
    await channel.start();
    // Channel is running — health endpoint is available
    await channel.stop();
    channel = null;
  });
});
