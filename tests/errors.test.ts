import { describe, it, expect } from 'vitest';
import { OPCError, ProviderError, ValidationError, ConfigError, ChannelError, PluginError, RateLimitError, SecurityError, TimeoutError, wrapError, formatErrorForUser } from '../src/core/errors';

describe('Error Hierarchy', () => {
  it('OPCError has code, hint, timestamp', () => {
    const err = new OPCError('boom', { code: 'TEST', hint: 'try again' });
    expect(err.message).toBe('boom');
    expect(err.code).toBe('TEST');
    expect(err.hint).toBe('try again');
    expect(err.timestamp).toBeGreaterThan(0);
    expect(err.toUserMessage()).toContain('try again');
  });

  it('toJSON serializes correctly', () => {
    const err = new OPCError('test', { code: 'T1' });
    const json = err.toJSON();
    expect(json.name).toBe('OPCError');
    expect(json.code).toBe('T1');
  });

  it('ProviderError includes provider', () => {
    const err = new ProviderError('openai', 'API key invalid', { statusCode: 401 });
    expect(err.provider).toBe('openai');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('OPC_PROVIDER_ERROR');
    expect(err instanceof OPCError).toBe(true);
  });

  it('ValidationError includes errors array', () => {
    const err = new ValidationError('Invalid config', ['missing name', 'bad version'], 'metadata');
    expect(err.errors).toEqual(['missing name', 'bad version']);
    expect(err.field).toBe('metadata');
  });

  it('ConfigError', () => {
    const err = new ConfigError('Missing oad.yaml');
    expect(err.code).toBe('OPC_CONFIG_ERROR');
  });

  it('ChannelError', () => {
    const err = new ChannelError('web', 'Port in use');
    expect(err.channelType).toBe('web');
  });

  it('PluginError', () => {
    const err = new PluginError('my-plugin', 'Init failed');
    expect(err.pluginName).toBe('my-plugin');
  });

  it('RateLimitError', () => {
    const err = new RateLimitError(undefined, 5000);
    expect(err.retryAfterMs).toBe(5000);
    expect(err.toUserMessage()).toContain('5 seconds');
  });

  it('SecurityError', () => {
    const err = new SecurityError('Blocked');
    expect(err.code).toBe('OPC_SECURITY_ERROR');
  });

  it('TimeoutError', () => {
    const err = new TimeoutError('llm-call', 30000);
    expect(err.message).toContain('30000ms');
  });

  it('wrapError wraps unknown errors', () => {
    const wrapped = wrapError('string error');
    expect(wrapped instanceof OPCError).toBe(true);
    expect(wrapped.message).toBe('string error');

    const native = wrapError(new Error('native'));
    expect(native.message).toBe('native');

    const existing = new ProviderError('x', 'y');
    expect(wrapError(existing)).toBe(existing);
  });

  it('formatErrorForUser returns clean message', () => {
    expect(formatErrorForUser(new RateLimitError())).toContain('Rate limit');
    expect(formatErrorForUser(new Error('raw'))).toBe('raw');
    expect(formatErrorForUser('string')).toBe('string');
  });
});
