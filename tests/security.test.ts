import { describe, it, expect } from 'vitest';
import { sanitizeInput, detectInjection, APIKeyManager } from '../src/core/security';

describe('Security', () => {
  describe('sanitizeInput', () => {
    it('strips script tags', () => {
      expect(sanitizeInput('<script>alert(1)</script>hello')).not.toContain('<script');
    });
    it('encodes HTML entities', () => {
      const result = sanitizeInput('a < b & c > d');
      expect(result).toContain('&lt;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&gt;');
    });
  });

  describe('detectInjection', () => {
    it('detects XSS', () => {
      const r = detectInjection('<script>alert(1)</script>');
      expect(r.safe).toBe(false);
      expect(r.threats).toContain('xss');
    });
    it('passes clean input', () => {
      expect(detectInjection('Hello world')).toEqual({ safe: true, threats: [] });
    });
  });

  describe('APIKeyManager', () => {
    it('add, validate, revoke', () => {
      const mgr = new APIKeyManager();
      mgr.addKey('key1', { label: 'test' });
      expect(mgr.isValid('key1')).toBe(true);
      expect(mgr.isValid('key2')).toBe(false);
      mgr.revokeKey('key1');
      expect(mgr.isValid('key1')).toBe(false);
    });

    it('rotate key', () => {
      const mgr = new APIKeyManager();
      mgr.addKey('old');
      expect(mgr.rotateKey('old', 'new')).toBe(true);
      expect(mgr.isValid('old')).toBe(false);
      expect(mgr.isValid('new')).toBe(true);
    });

    it('expires keys', () => {
      const mgr = new APIKeyManager();
      mgr.addKey('expired', { expiresAt: Date.now() - 1000 });
      expect(mgr.isValid('expired')).toBe(false);
    });

    it('listActive filters', () => {
      const mgr = new APIKeyManager();
      mgr.addKey('a');
      mgr.addKey('b');
      mgr.revokeKey('b');
      expect(mgr.listActive().length).toBe(1);
    });
  });
});
