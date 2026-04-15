import { describe, it, expect } from 'vitest';
import { t, setLocale, getLocale, detectLocale, addMessages } from '../src/i18n';

describe('i18n', () => {
  it('should return English messages by default', () => {
    setLocale('en');
    expect(t('agent.greeting')).toBe('Hello! How can I help you?');
  });

  it('should return Chinese messages', () => {
    setLocale('zh-CN');
    expect(t('agent.greeting')).toBe('你好！有什么可以帮你的？');
    setLocale('en'); // reset
  });

  it('should interpolate params', () => {
    setLocale('en');
    expect(t('agent.started', { name: 'TestBot' })).toBe('Agent "TestBot" started successfully');
  });

  it('should fall back to key if not found', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('should get and set locale', () => {
    setLocale('zh-CN');
    expect(getLocale()).toBe('zh-CN');
    setLocale('en');
    expect(getLocale()).toBe('en');
  });

  it('should add custom messages', () => {
    addMessages('en', { 'custom.key': 'Custom value' });
    expect(t('custom.key')).toBe('Custom value');
  });

  it('should detect locale from environment', () => {
    const locale = detectLocale();
    expect(['en', 'zh-CN']).toContain(locale);
  });
});
