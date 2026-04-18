import { describe, it, expect } from 'vitest';
import { WeChatChannel } from '../../src/channels/wechat';
import * as crypto from 'crypto';

describe('WeChatChannel', () => {
  // ── XML Parsing ──────────────────────────────────

  describe('parseXML', () => {
    it('should parse text message XML', () => {
      const xml = `<xml>
        <ToUserName><![CDATA[gh_123456]]></ToUserName>
        <FromUserName><![CDATA[oUser123]]></FromUserName>
        <CreateTime>1348831860</CreateTime>
        <MsgType><![CDATA[text]]></MsgType>
        <Content><![CDATA[Hello World]]></Content>
        <MsgId>1234567890123456</MsgId>
      </xml>`;

      const msg = WeChatChannel.parseXML(xml);
      expect(msg).not.toBeNull();
      expect(msg!.toUserName).toBe('gh_123456');
      expect(msg!.fromUserName).toBe('oUser123');
      expect(msg!.createTime).toBe(1348831860);
      expect(msg!.msgType).toBe('text');
      expect(msg!.content).toBe('Hello World');
      expect(msg!.msgId).toBe('1234567890123456');
    });

    it('should parse event message XML (subscribe)', () => {
      const xml = `<xml>
        <ToUserName><![CDATA[gh_123456]]></ToUserName>
        <FromUserName><![CDATA[oUser123]]></FromUserName>
        <CreateTime>1348831860</CreateTime>
        <MsgType><![CDATA[event]]></MsgType>
        <Event><![CDATA[subscribe]]></Event>
      </xml>`;

      const msg = WeChatChannel.parseXML(xml);
      expect(msg).not.toBeNull();
      expect(msg!.msgType).toBe('event');
      expect(msg!.event).toBe('subscribe');
    });

    it('should parse image message XML', () => {
      const xml = `<xml>
        <ToUserName><![CDATA[gh_123456]]></ToUserName>
        <FromUserName><![CDATA[oUser123]]></FromUserName>
        <CreateTime>1348831860</CreateTime>
        <MsgType><![CDATA[image]]></MsgType>
        <MsgId>1234567890123456</MsgId>
      </xml>`;

      const msg = WeChatChannel.parseXML(xml);
      expect(msg).not.toBeNull();
      expect(msg!.msgType).toBe('image');
    });

    it('should return null for invalid XML', () => {
      expect(WeChatChannel.parseXML('')).toBeNull();
      expect(WeChatChannel.parseXML('not xml')).toBeNull();
      expect(WeChatChannel.parseXML('<xml></xml>')).toBeNull();
    });

    it('should handle XML with plain text (no CDATA)', () => {
      const xml = `<xml>
        <ToUserName>gh_123456</ToUserName>
        <FromUserName>oUser123</FromUserName>
        <CreateTime>1348831860</CreateTime>
        <MsgType>text</MsgType>
        <Content>Hello</Content>
      </xml>`;

      const msg = WeChatChannel.parseXML(xml);
      expect(msg).not.toBeNull();
      expect(msg!.content).toBe('Hello');
    });
  });

  // ── XML Response Formatting ──────────────────────

  describe('formatXMLResponse', () => {
    it('should format valid XML response', () => {
      const xml = WeChatChannel.formatXMLResponse('oUser123', 'gh_123456', 'Hello!');
      expect(xml).toContain('<ToUserName><![CDATA[oUser123]]></ToUserName>');
      expect(xml).toContain('<FromUserName><![CDATA[gh_123456]]></FromUserName>');
      expect(xml).toContain('<Content><![CDATA[Hello!]]></Content>');
      expect(xml).toContain('<MsgType><![CDATA[text]]></MsgType>');
      expect(xml).toContain('<CreateTime>');
    });

    it('should handle special characters in content', () => {
      const xml = WeChatChannel.formatXMLResponse('u', 'g', 'Hello <world> & "friends"');
      expect(xml).toContain('Hello <world> & "friends"');
    });
  });

  // ── Signature Verification ───────────────────────

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const token = 'mytoken123';
      const channel = new WeChatChannel({ appId: 'id', appSecret: 'secret', token });

      const timestamp = '1348831860';
      const nonce = 'abc123';
      const arr = [token, timestamp, nonce].sort();
      const expectedSignature = crypto.createHash('sha1').update(arr.join('')).digest('hex');

      expect(channel.verifySignature(expectedSignature, timestamp, nonce)).toBe(true);
    });

    it('should reject invalid signature', () => {
      const channel = new WeChatChannel({ appId: 'id', appSecret: 'secret', token: 'mytoken' });
      expect(channel.verifySignature('invalidsig', '123', 'abc')).toBe(false);
    });

    it('should handle empty inputs', () => {
      const channel = new WeChatChannel({ appId: 'id', appSecret: 'secret', token: 'tok' });
      expect(channel.verifySignature('', '', '')).toBe(false);
    });
  });

  // ── Message Handling ─────────────────────────────

  describe('handleMessage', () => {
    it('should handle subscribe event', async () => {
      const channel = new WeChatChannel({ appId: 'id', appSecret: 'secret', token: 'tok' });
      const result = await channel.handleMessage({
        toUserName: 'gh_123',
        fromUserName: 'oUser',
        createTime: 1000,
        msgType: 'event',
        event: 'subscribe',
      });
      expect(result).toContain('Welcome');
    });

    it('should handle text message with handler', async () => {
      const channel = new WeChatChannel({ appId: 'id', appSecret: 'secret', token: 'tok' });
      channel.onMessage(async (msg) => ({
        id: 'reply',
        role: 'assistant',
        content: `Echo: ${msg.content}`,
        timestamp: Date.now(),
      }));

      const result = await channel.handleMessage({
        toUserName: 'gh_123',
        fromUserName: 'oUser',
        createTime: 1000,
        msgType: 'text',
        content: 'Hello',
        msgId: 'msg1',
      });
      expect(result).toBe('Echo: Hello');
    });

    it('should return empty for text message without handler', async () => {
      const channel = new WeChatChannel({ appId: 'id', appSecret: 'secret', token: 'tok' });
      const result = await channel.handleMessage({
        toUserName: 'gh_123',
        fromUserName: 'oUser',
        createTime: 1000,
        msgType: 'text',
        content: 'Hello',
      });
      expect(result).toBe('');
    });
  });
});
