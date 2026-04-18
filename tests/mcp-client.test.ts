import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPClient } from '../src/tools/mcp-client';

describe('MCPClient', () => {
  it('starts with no process', () => {
    const client = new MCPClient();
    expect((client as any).process).toBeNull();
  });

  it('starts with empty buffer', () => {
    const client = new MCPClient();
    expect((client as any).buffer).toBe('');
  });

  it('starts not connected', () => {
    const client = new MCPClient();
    expect((client as any).connected).toBe(false);
  });

  it('nextId starts at 1', () => {
    const client = new MCPClient();
    expect((client as any).nextId).toBe(1);
  });

  it('pending map starts empty', () => {
    const client = new MCPClient();
    expect((client as any).pending.size).toBe(0);
  });

  it('config starts null', () => {
    const client = new MCPClient();
    expect((client as any).config).toBeNull();
  });

  it('processBuffer handles complete JSON line', () => {
    const client = new MCPClient();
    const resolve = vi.fn();
    const reject = vi.fn();
    (client as any).pending.set(1, { resolve, reject });
    (client as any).buffer = '{"id":1,"result":{"tools":[]}}\n';
    (client as any).processBuffer();
    expect(resolve).toHaveBeenCalledWith({ tools: [] });
    expect((client as any).pending.size).toBe(0);
  });

  it('processBuffer handles error response', () => {
    const client = new MCPClient();
    const resolve = vi.fn();
    const reject = vi.fn();
    (client as any).pending.set(2, { resolve, reject });
    (client as any).buffer = '{"id":2,"error":{"message":"not found"}}\n';
    (client as any).processBuffer();
    expect(reject).toHaveBeenCalled();
    expect(reject.mock.calls[0][0].message).toBe('not found');
  });

  it('processBuffer handles partial message (no newline)', () => {
    const client = new MCPClient();
    const resolve = vi.fn();
    (client as any).pending.set(1, { resolve, reject: vi.fn() });
    (client as any).buffer = '{"id":1,"result":';
    (client as any).processBuffer();
    expect(resolve).not.toHaveBeenCalled();
    // Partial stays in buffer
    expect((client as any).buffer).toBe('{"id":1,"result":');
  });

  it('processBuffer handles multiple responses in one chunk', () => {
    const client = new MCPClient();
    const r1 = vi.fn(), r2 = vi.fn();
    (client as any).pending.set(1, { resolve: r1, reject: vi.fn() });
    (client as any).pending.set(2, { resolve: r2, reject: vi.fn() });
    (client as any).buffer = '{"id":1,"result":"a"}\n{"id":2,"result":"b"}\n';
    (client as any).processBuffer();
    expect(r1).toHaveBeenCalledWith('a');
    expect(r2).toHaveBeenCalledWith('b');
  });

  it('processBuffer ignores non-JSON lines', () => {
    const client = new MCPClient();
    (client as any).buffer = 'not json at all\n';
    // Should not throw
    (client as any).processBuffer();
  });

  it('processBuffer ignores responses without matching id', () => {
    const client = new MCPClient();
    (client as any).buffer = '{"id":999,"result":"orphan"}\n';
    // Should not throw
    (client as any).processBuffer();
  });
});
