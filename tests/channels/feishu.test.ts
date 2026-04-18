import { describe, it, expect } from 'vitest';
import { FeishuChannel } from '../../src/channels/feishu';

describe('FeishuChannel', () => {
  // ── Event Parsing ────────────────────────────────

  describe('parseEventBody', () => {
    it('should parse url_verification challenge', () => {
      const body = { type: 'url_verification', challenge: 'abc123' };
      const result = FeishuChannel.parseEventBody(body);
      expect(result.type).toBe('url_verification');
      expect(result.challenge).toBe('abc123');
    });

    it('should parse text message event', () => {
      const body = {
        header: {
          event_id: 'evt_123',
          event_type: 'im.message.receive_v1',
          token: 'tok',
        },
        event: {
          message: {
            message_id: 'msg_123',
            chat_id: 'oc_456',
            message_type: 'text',
            content: JSON.stringify({ text: 'Hello Feishu' }),
            create_time: '1699999999',
            chat_type: 'p2p',
          },
          sender: {
            sender_id: { open_id: 'ou_789' },
          },
        },
      };

      const result = FeishuChannel.parseEventBody(body);
      expect(result.type).toBe('message');
      expect(result.content).toBe('Hello Feishu');
      expect(result.chatId).toBe('oc_456');
      expect(result.senderId).toBe('ou_789');
      expect(result.messageId).toBe('msg_123');
    });

    it('should strip @bot mentions from content', () => {
      const body = {
        header: { event_type: 'im.message.receive_v1' },
        event: {
          message: {
            message_id: 'msg_1',
            chat_id: 'oc_1',
            message_type: 'text',
            content: JSON.stringify({ text: '@_user_123 Hello bot' }),
          },
          sender: { sender_id: { open_id: 'ou_1' } },
        },
      };

      const result = FeishuChannel.parseEventBody(body);
      expect(result.content).toBe('Hello bot');
    });

    it('should return empty content for non-text messages', () => {
      const body = {
        header: { event_type: 'im.message.receive_v1' },
        event: {
          message: {
            message_id: 'msg_1',
            chat_id: 'oc_1',
            message_type: 'image',
            content: '{}',
          },
          sender: { sender_id: { open_id: 'ou_1' } },
        },
      };

      const result = FeishuChannel.parseEventBody(body);
      expect(result.content).toBe('');
    });

    it('should handle unknown event types', () => {
      const body = { header: { event_type: 'some.other.event' }, event: {} };
      const result = FeishuChannel.parseEventBody(body);
      expect(result.type).toBe('unknown');
    });

    it('should handle malformed content JSON gracefully', () => {
      const body = {
        header: { event_type: 'im.message.receive_v1' },
        event: {
          message: {
            message_id: 'msg_1',
            chat_id: 'oc_1',
            message_type: 'text',
            content: 'not-json',
          },
          sender: { sender_id: { open_id: 'ou_1' } },
        },
      };

      const result = FeishuChannel.parseEventBody(body);
      expect(result.content).toBe('not-json');
    });
  });

  // ── Constructor ──────────────────────────────────

  describe('constructor', () => {
    it('should use defaults', () => {
      const channel = new FeishuChannel();
      expect(channel.type).toBe('feishu');
    });

    it('should accept config', () => {
      const channel = new FeishuChannel({
        appId: 'myapp',
        appSecret: 'secret',
        port: 9999,
      });
      expect(channel.type).toBe('feishu');
    });
  });
});
