import { describe, it, expect } from 'vitest';
import { Sandbox } from '../src/core/sandbox';

describe('Security Sandbox', () => {
  it('should create sandbox with trust level', () => {
    const sb = new Sandbox({ trustLevel: 'sandbox', agentDir: '/tmp/agent' });
    expect(sb.trustLevel).toBe('sandbox');
  });

  it('should restrict shell in sandbox mode', () => {
    const sb = new Sandbox({ trustLevel: 'sandbox', agentDir: '/tmp/agent' });
    expect(sb.checkShellAccess()).toBe(false);
  });

  it('should allow shell in certified mode', () => {
    const sb = new Sandbox({ trustLevel: 'certified', agentDir: '/tmp/agent' });
    expect(sb.checkShellAccess()).toBe(true);
  });

  it('should restrict network in sandbox mode', () => {
    const sb = new Sandbox({ trustLevel: 'sandbox', agentDir: '/tmp/agent' });
    expect(sb.checkNetworkAccess('https://api.openai.com')).toBe(false);
  });

  it('should allow network with allowlist', () => {
    const sb = new Sandbox({
      trustLevel: 'sandbox',
      agentDir: '/tmp/agent',
      networkAllowlist: ['api.openai.com'],
    });
    expect(sb.checkNetworkAccess('https://api.openai.com/v1/chat')).toBe(true);
    expect(sb.checkNetworkAccess('https://evil.com')).toBe(false);
  });

  it('should allow wildcard network in listed mode', () => {
    const sb = new Sandbox({ trustLevel: 'listed', agentDir: '/tmp/agent' });
    expect(sb.checkNetworkAccess('https://anything.com')).toBe(true);
  });

  it('should return restrictions snapshot', () => {
    const sb = new Sandbox({ trustLevel: 'verified', agentDir: '/tmp/agent' });
    const r = sb.getRestrictions();
    expect(r.shell).toBe(false);
    expect(r.network.allowed.length).toBeGreaterThan(0);
  });
});
