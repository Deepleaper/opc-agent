import { describe, it, expect } from 'vitest';
import { EmailChannel } from '../../src/channels/email';

describe('EmailChannel', () => {
  // ── Webhook Payload Parsing ──────────────────────

  describe('parseWebhookPayload', () => {
    it('should parse standard payload', () => {
      const payload = {
        from: 'alice@example.com',
        to: ['bob@example.com'],
        subject: 'Test Email',
        body: 'Hello from email',
        messageId: '<msg123@example.com>',
        date: '2026-01-15T10:00:00Z',
      };

      const email = EmailChannel.parseWebhookPayload(payload);
      expect(email).not.toBeNull();
      expect(email!.from).toBe('alice@example.com');
      expect(email!.to).toEqual(['bob@example.com']);
      expect(email!.subject).toBe('Test Email');
      expect(email!.body).toBe('Hello from email');
      expect(email!.messageId).toBe('<msg123@example.com>');
    });

    it('should parse SendGrid-style payload', () => {
      const payload = {
        from: 'sender@test.com',
        to: 'recipient@test.com',
        subject: 'SG Test',
        text: 'Body from SendGrid',
        html: '<p>Body from SendGrid</p>',
      };

      const email = EmailChannel.parseWebhookPayload(payload);
      expect(email).not.toBeNull();
      expect(email!.body).toBe('Body from SendGrid');
      expect(email!.html).toBe('<p>Body from SendGrid</p>');
      expect(email!.to).toEqual(['recipient@test.com']);
    });

    it('should parse Mailgun-style payload', () => {
      const payload = {
        sender: 'mg@example.com',
        recipient: 'user@example.com',
        subject: 'MG Test',
        'body-plain': 'Plain text body',
        'body-html': '<p>HTML body</p>',
        'Message-Id': '<mg123@mailgun>',
      };

      const email = EmailChannel.parseWebhookPayload(payload);
      expect(email).not.toBeNull();
      expect(email!.from).toBe('mg@example.com');
      expect(email!.body).toBe('Plain text body');
      expect(email!.messageId).toBe('<mg123@mailgun>');
    });

    it('should return null for payload without from', () => {
      const email = EmailChannel.parseWebhookPayload({ subject: 'No sender' });
      expect(email).toBeNull();
    });

    it('should handle envelope format', () => {
      const payload = {
        envelope: { from: 'env@test.com', to: ['a@b.com'] },
        subject: 'Envelope test',
        body: 'content',
      };

      const email = EmailChannel.parseWebhookPayload(payload);
      expect(email).not.toBeNull();
      expect(email!.from).toBe('env@test.com');
    });

    it('should generate messageId if missing', () => {
      const payload = { from: 'a@b.com', body: 'test' };
      const email = EmailChannel.parseWebhookPayload(payload);
      expect(email).not.toBeNull();
      expect(email!.messageId).toMatch(/^email-/);
    });

    it('should handle inReplyTo and references', () => {
      const payload = {
        from: 'a@b.com',
        body: 'reply',
        inReplyTo: '<orig@b.com>',
        references: ['<orig@b.com>', '<prev@b.com>'],
      };

      const email = EmailChannel.parseWebhookPayload(payload);
      expect(email!.inReplyTo).toBe('<orig@b.com>');
      expect(email!.references).toEqual(['<orig@b.com>', '<prev@b.com>']);
    });
  });

  // ── Filter Matching ──────────────────────────────

  describe('matchesFilters', () => {
    it('should match all when no filters', () => {
      const channel = new EmailChannel({ mode: 'webhook' });
      const result = channel.matchesFilters({
        messageId: 'x', from: 'a@b.com', to: [], subject: 'test', body: '', date: new Date(),
      });
      expect(result).toBe(true);
    });

    it('should filter by from address', () => {
      const channel = new EmailChannel({
        mode: 'webhook',
        filters: { from: ['allowed@example.com'] },
      });

      expect(channel.matchesFilters({
        messageId: 'x', from: 'allowed@example.com', to: [], subject: '', body: '', date: new Date(),
      })).toBe(true);

      expect(channel.matchesFilters({
        messageId: 'x', from: 'blocked@other.com', to: [], subject: '', body: '', date: new Date(),
      })).toBe(false);
    });

    it('should filter by subject', () => {
      const channel = new EmailChannel({
        mode: 'webhook',
        filters: { subject: ['[SUPPORT]'] },
      });

      expect(channel.matchesFilters({
        messageId: 'x', from: 'a@b.com', to: [], subject: '[SUPPORT] Help me', body: '', date: new Date(),
      })).toBe(true);

      expect(channel.matchesFilters({
        messageId: 'x', from: 'a@b.com', to: [], subject: 'Random email', body: '', date: new Date(),
      })).toBe(false);
    });
  });

  // ── Constructor ──────────────────────────────────

  describe('constructor', () => {
    it('should create with webhook mode', () => {
      const channel = new EmailChannel({ mode: 'webhook', webhookPort: 9090 });
      expect(channel.type).toBe('email');
    });
  });
});
