import { describe, it, expect } from 'vitest';
import { TelegramChannel } from '../src/channels/telegram';
import { DiscordChannel } from '../src/channels/discord';

describe('TelegramChannel', () => {
  it('should create with default config (polling mode)', () => {
    const channel = new TelegramChannel({ token: 'test-token' });
    expect(channel.type).toBe('telegram');
  });

  it('should create with webhook mode', () => {
    const channel = new TelegramChannel({
      token: 'test-token',
      mode: 'webhook',
      webhookUrl: 'https://example.com',
      port: 4000,
    });
    expect(channel.type).toBe('telegram');
  });

  it('should warn and return if no token on start', async () => {
    const channel = new TelegramChannel({ token: '' });
    // Should not throw, just warn
    await channel.start();
    await channel.stop();
  });

  it('should support onMessage handler', () => {
    const channel = new TelegramChannel({ token: 'test-token' });
    const handler = async (msg: any) => ({ ...msg, role: 'assistant' as const });
    channel.onMessage(handler);
    // No throw = success
    expect(channel.type).toBe('telegram');
  });
});

describe('DiscordChannel', () => {
  it('should create with default config', () => {
    const channel = new DiscordChannel({ botToken: 'test-token' });
    expect(channel.type).toBe('discord');
  });

  it('should warn and return if no token on start', async () => {
    const channel = new DiscordChannel({ botToken: '' });
    await channel.start();
    await channel.stop();
  });

  it('should support onMessage handler', () => {
    const channel = new DiscordChannel({ botToken: 'test-token' });
    const handler = async (msg: any) => ({ ...msg, role: 'assistant' as const });
    channel.onMessage(handler);
    expect(channel.type).toBe('discord');
  });

  it('should handle stop gracefully when not started', async () => {
    const channel = new DiscordChannel({ botToken: 'test-token' });
    await channel.stop(); // Should not throw
  });
});
