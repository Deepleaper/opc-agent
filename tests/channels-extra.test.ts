import { describe, it, expect } from 'vitest';
import { WhatsAppChannel } from '../src/channels/whatsapp';
import { SignalChannel } from '../src/channels/signal';
import { MatrixChannel } from '../src/channels/matrix';
import { IMessageChannel } from '../src/channels/imessage';
import { LINEChannel } from '../src/channels/line';
import { MSTeamsChannel } from '../src/channels/msteams';
import { QQChannel } from '../src/channels/qq';
import { NostrChannel } from '../src/channels/nostr';
import { SMSChannel } from '../src/channels/sms';

describe('Additional Channels', () => {
  it('should create WhatsApp channel', () => {
    const ch = new WhatsAppChannel({ phoneNumber: '+1234567890' });
    expect(ch.type).toBe('whatsapp');
  });

  it('should throw on start without deps', async () => {
    const ch = new SignalChannel();
    await expect(ch.start()).rejects.toThrow(/Install/);
  });

  it('should create Matrix channel', () => {
    const ch = new MatrixChannel({ homeserverUrl: 'https://matrix.org' });
    expect(ch.type).toBe('matrix');
  });

  it('should create all channel types', () => {
    const channels = [
      new IMessageChannel(),
      new LINEChannel(),
      new MSTeamsChannel(),
      new QQChannel(),
      new NostrChannel(),
      new SMSChannel(),
    ];
    const types = channels.map(c => c.type);
    expect(types).toEqual(['imessage', 'line', 'msteams', 'qq', 'nostr', 'sms']);
  });

  it('should throw on send before start', async () => {
    const ch = new WhatsAppChannel();
    await expect(ch.send('123', 'hello')).rejects.toThrow(/not yet connected/);
  });
});
