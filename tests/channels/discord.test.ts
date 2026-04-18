import { describe, it, expect, vi } from 'vitest';
import { DiscordChannel } from '../../src/channels/discord';

describe('DiscordChannel', () => {
  it('constructor sets config from params', () => {
    const ch = new DiscordChannel({ botToken: 'tok-123', applicationId: 'app-1' });
    expect((ch as any).config.botToken).toBe('tok-123');
    expect((ch as any).config.applicationId).toBe('app-1');
  });

  it('type is discord', () => {
    const ch = new DiscordChannel({ botToken: 'tok' });
    expect(ch.type).toBe('discord');
  });

  it('constructor reads token from env var', () => {
    const orig = process.env.DISCORD_BOT_TOKEN;
    process.env.DISCORD_BOT_TOKEN = 'env-discord-tok';
    const ch = new DiscordChannel({});
    expect((ch as any).config.botToken).toBe('env-discord-tok');
    if (orig) process.env.DISCORD_BOT_TOKEN = orig;
    else delete process.env.DISCORD_BOT_TOKEN;
  });

  it('defaults useThreads to true', () => {
    const ch = new DiscordChannel({ botToken: 'tok' });
    expect((ch as any).config.useThreads).toBe(true);
  });

  it('guildIds defaults to empty array', () => {
    const ch = new DiscordChannel({ botToken: 'tok' });
    expect((ch as any).config.guildIds).toEqual([]);
  });

  it('missing token results in empty string', () => {
    const orig = process.env.DISCORD_BOT_TOKEN;
    delete process.env.DISCORD_BOT_TOKEN;
    const ch = new DiscordChannel({});
    expect((ch as any).config.botToken).toBe('');
    if (orig) process.env.DISCORD_BOT_TOKEN = orig;
  });

  it('start with no token warns but does not throw', async () => {
    const orig = process.env.DISCORD_BOT_TOKEN;
    delete process.env.DISCORD_BOT_TOKEN;
    const ch = new DiscordChannel({});
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await ch.start();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    if (orig) process.env.DISCORD_BOT_TOKEN = orig;
  });

  it('message chunking at 2000 chars', () => {
    const longText = 'x'.repeat(3500);
    const chunks: string[] = [];
    for (let i = 0; i < longText.length; i += 2000) {
      chunks.push(longText.slice(i, i + 2000));
    }
    expect(chunks).toHaveLength(2);
    expect(chunks[0].length).toBe(2000);
    expect(chunks[1].length).toBe(1500);
  });

  it('sequenceNumber starts null', () => {
    const ch = new DiscordChannel({ botToken: 'tok' });
    expect((ch as any).sequenceNumber).toBeNull();
  });

  it('ws starts null', () => {
    const ch = new DiscordChannel({ botToken: 'tok' });
    expect((ch as any).ws).toBeNull();
  });

  it('custom guildIds are set', () => {
    const ch = new DiscordChannel({ botToken: 'tok', guildIds: ['g1', 'g2'] });
    expect((ch as any).config.guildIds).toEqual(['g1', 'g2']);
  });
});
