import { describe, it, expect } from 'vitest';
import { WebhookChannel } from '../src/channels/webhook';

describe('WebhookChannel', () => {
  it('should create with default config', () => {
    const channel = new WebhookChannel();
    expect(channel.type).toBe('webhook');
  });

  it('should verify signatures', () => {
    const channel = new WebhookChannel({ secret: 'test-secret' });
    const body = '{"event":"test"}';
    const sig = channel.createSignature(body, 'test-secret');
    expect(channel.verifySignature(body, sig, 'test-secret')).toBe(true);
    expect(channel.verifySignature(body, 'invalid', 'test-secret')).toBe(false);
  });

  it('should add outgoing webhooks', () => {
    const channel = new WebhookChannel();
    channel.addOutgoing({ name: 'test', url: 'http://localhost:9999', events: ['*'], secret: 'abc' });
    expect(channel.type).toBe('webhook');
  });

  it('should start and stop server', async () => {
    const channel = new WebhookChannel({ port: 0 }); // port 0 = random
    await channel.start();
    await channel.stop();
  });
});
