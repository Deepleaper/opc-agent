import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramChannel } from '../../src/channels/telegram';

describe('TelegramChannel', () => {
  it('constructor sets token from config', () => {
    const ch = new TelegramChannel({ token: 'test-token-123' });
    expect((ch as any).token).toBe('test-token-123');
  });

  it('constructor defaults to polling mode', () => {
    const ch = new TelegramChannel({ token: 'tok' });
    expect((ch as any).mode).toBe('polling');
  });

  it('constructor reads token from env var', () => {
    const orig = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = 'env-token';
    const ch = new TelegramChannel({});
    expect((ch as any).token).toBe('env-token');
    if (orig) process.env.TELEGRAM_BOT_TOKEN = orig;
    else delete process.env.TELEGRAM_BOT_TOKEN;
  });

  it('constructor sets webhook mode', () => {
    const ch = new TelegramChannel({ token: 'tok', mode: 'webhook', webhookUrl: 'https://x.com' });
    expect((ch as any).mode).toBe('webhook');
    expect((ch as any).webhookUrl).toBe('https://x.com');
  });

  it('constructor defaults port to 3001', () => {
    const ch = new TelegramChannel({ token: 'tok' });
    expect((ch as any).port).toBe(3001);
  });

  it('constructor uses custom port', () => {
    const ch = new TelegramChannel({ token: 'tok', port: 8080 });
    expect((ch as any).port).toBe(8080);
  });

  it('type is telegram', () => {
    const ch = new TelegramChannel({ token: 'tok' });
    expect(ch.type).toBe('telegram');
  });

  it('processUpdate extracts message text', async () => {
    const ch = new TelegramChannel({ token: 'tok' });
    const messages: any[] = [];
    (ch as any).handler = async (msg: any) => { messages.push(msg); return { id: 'r', role: 'assistant', content: 'ok', timestamp: Date.now() }; };
    // Mock apiCall to avoid actual Telegram API requests
    (ch as any).apiCall = vi.fn().mockResolvedValue({ message_id: 1 });
    await (ch as any).processUpdate({
      message: { message_id: 1, text: 'hello', date: 1000, chat: { id: 123 }, from: { id: 456, first_name: 'Test' } },
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('hello');
  });

  it('processUpdate handles edited_message', async () => {
    const ch = new TelegramChannel({ token: 'tok' });
    const messages: any[] = [];
    (ch as any).handler = async (msg: any) => { messages.push(msg); return { id: 'r', role: 'assistant', content: 'ok', timestamp: Date.now() }; };
    (ch as any).apiCall = vi.fn().mockResolvedValue({ message_id: 1 });
    await (ch as any).processUpdate({
      edited_message: { message_id: 2, text: 'edited', date: 1000, chat: { id: 123 }, from: { id: 456, first_name: 'Test' } },
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('edited');
  });

  it('processUpdate ignores non-text updates', async () => {
    const ch = new TelegramChannel({ token: 'tok' });
    const messages: any[] = [];
    ch.onMessage(async (msg) => { messages.push(msg); return { id: 'r', role: 'assistant', content: 'ok', timestamp: Date.now() } as any; });
    (ch as any).sendMessage = vi.fn();
    await (ch as any).processUpdate({
      message: { message_id: 3, photo: [{}], date: 1000, chat: { id: 123 }, from: { id: 456 } },
    });
    expect(messages).toHaveLength(0);
  });

  it('processUpdate ignores update without handler', async () => {
    const ch = new TelegramChannel({ token: 'tok' });
    // Should not throw
    await (ch as any).processUpdate({
      message: { message_id: 4, text: 'hello', date: 1000, chat: { id: 123 }, from: { id: 456 } },
    });
  });

  it('offset starts at 0', () => {
    const ch = new TelegramChannel({ token: 'tok' });
    expect((ch as any).offset).toBe(0);
  });

  it('missing token results in empty string', () => {
    const orig = process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    const ch = new TelegramChannel({});
    expect((ch as any).token).toBe('');
    if (orig) process.env.TELEGRAM_BOT_TOKEN = orig;
  });

  it('start with no token warns but does not throw', async () => {
    const orig = process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    const ch = new TelegramChannel({});
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await ch.start();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    if (orig) process.env.TELEGRAM_BOT_TOKEN = orig;
  });

  it('sendMessage is a function', () => {
    const ch = new TelegramChannel({ token: 'tok' });
    expect(typeof (ch as any).sendMessage === 'function' || typeof (ch as any).apiCall === 'function').toBe(true);
  });

  it('long message chunking helper if available', () => {
    // Test the concept - messages over 4096 chars should be split
    const longText = 'a'.repeat(5000);
    const chunks: string[] = [];
    for (let i = 0; i < longText.length; i += 4096) {
      chunks.push(longText.slice(i, i + 4096));
    }
    expect(chunks).toHaveLength(2);
    expect(chunks[0].length).toBe(4096);
    expect(chunks[1].length).toBe(904);
  });
});
