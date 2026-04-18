import { describe, it, expect, vi } from 'vitest';
import { ContextCompressor } from '../src/memory/context-compressor';
import type { Message } from '../src/core/types';

function makeMsg(role: 'user' | 'assistant' | 'system', content: string, id?: string): Message {
  return { id: id ?? `msg-${Math.random()}`, role, content, timestamp: Date.now() };
}

function makeMessages(count: number, contentLen = 200): Message[] {
  return Array.from({ length: count }, (_, i) =>
    makeMsg(i % 2 === 0 ? 'user' : 'assistant', 'A'.repeat(contentLen), `msg-${i}`)
  );
}

describe('ContextCompressor', () => {
  describe('estimateTokens', () => {
    it('should estimate English text tokens (~1 per 4 chars)', () => {
      const c = new ContextCompressor();
      const tokens = c.estimateTokens('Hello World'); // 11 chars => ~3
      expect(tokens).toBeGreaterThanOrEqual(2);
      expect(tokens).toBeLessThanOrEqual(4);
    });

    it('should estimate Chinese text tokens (~1 per 2 chars)', () => {
      const c = new ContextCompressor();
      const tokens = c.estimateTokens('你好世界测试'); // 6 CJK chars => ~3
      expect(tokens).toBeGreaterThanOrEqual(2);
      expect(tokens).toBeLessThanOrEqual(4);
    });

    it('should handle mixed language text', () => {
      const c = new ContextCompressor();
      const tokens = c.estimateTokens('Hello 你好');
      expect(tokens).toBeGreaterThan(0);
    });

    it('should return 0 for empty string', () => {
      const c = new ContextCompressor();
      expect(c.estimateTokens('')).toBe(0);
    });

    it('should handle long text proportionally', () => {
      const c = new ContextCompressor();
      const short = c.estimateTokens('test');
      const long = c.estimateTokens('test'.repeat(100));
      expect(long).toBeGreaterThan(short * 50);
    });
  });

  describe('compress - no brain', () => {
    it('should not compress when under threshold', async () => {
      const c = new ContextCompressor({ maxTokens: 8000, compressThreshold: 0.8 });
      const msgs = makeMessages(3, 50); // small
      const result = await c.compress(msgs);
      expect(result.messages).toHaveLength(3);
      expect(result.savedTokens).toBe(0);
      expect(result.learnedCount).toBe(0);
    });

    it('should compress when over threshold', async () => {
      const c = new ContextCompressor({ maxTokens: 100, compressThreshold: 0.5, preserveRecent: 2 });
      const msgs = makeMessages(10, 200);
      const result = await c.compress(msgs);
      expect(result.messages.length).toBeLessThan(10);
      expect(result.savedTokens).toBeGreaterThan(0);
      expect(result.summary).toBeTruthy();
    });

    it('should preserve recent messages', async () => {
      const c = new ContextCompressor({ maxTokens: 100, compressThreshold: 0.5, preserveRecent: 3 });
      const msgs = makeMessages(10, 200);
      const result = await c.compress(msgs);
      // Last 3 + 1 compression message = 4
      expect(result.messages).toHaveLength(4);
      expect(result.messages[1].id).toBe('msg-7');
      expect(result.messages[2].id).toBe('msg-8');
      expect(result.messages[3].id).toBe('msg-9');
    });

    it('should add system compression message', async () => {
      const c = new ContextCompressor({ maxTokens: 100, compressThreshold: 0.5, preserveRecent: 2 });
      const msgs = makeMessages(10, 200);
      const result = await c.compress(msgs);
      expect(result.messages[0].role).toBe('system');
      expect(result.messages[0].content).toContain('Context compressed');
    });

    it('should handle preserveRecent >= message count', async () => {
      const c = new ContextCompressor({ maxTokens: 10, compressThreshold: 0.5, preserveRecent: 20 });
      const msgs = makeMessages(5, 200);
      const result = await c.compress(msgs);
      expect(result.messages).toHaveLength(5); // can't compress, all are "recent"
    });
  });

  describe('compress - with brain', () => {
    it('should learn insights to brain', async () => {
      const brain = { learn: vi.fn().mockResolvedValue(undefined) };
      const c = new ContextCompressor({ maxTokens: 100, compressThreshold: 0.5, preserveRecent: 2 });
      const msgs = [
        makeMsg('user', 'I decided to use TypeScript for the project'),
        makeMsg('assistant', 'Great decision! TypeScript provides type safety.'.repeat(5)),
        makeMsg('user', 'I prefer functional programming'),
        ...makeMessages(4, 200),
      ];
      const result = await c.compress(msgs, { brain });
      expect(result.learnedCount).toBeGreaterThan(0);
      expect(brain.learn).toHaveBeenCalled();
    });

    it('should include brain reference in compression message', async () => {
      const brain = { learn: vi.fn().mockResolvedValue(undefined) };
      const c = new ContextCompressor({ maxTokens: 100, compressThreshold: 0.5, preserveRecent: 1 });
      const msgs = makeMessages(10, 200);
      const result = await c.compress(msgs, { brain });
      expect(result.messages[0].content).toContain('Brain');
      expect(result.messages[0].content).toContain('recall()');
    });

    it('should handle brain.learn failure gracefully', async () => {
      const brain = { learn: vi.fn().mockRejectedValue(new Error('fail')) };
      const c = new ContextCompressor({ maxTokens: 100, compressThreshold: 0.5, preserveRecent: 2 });
      const msgs = [
        makeMsg('user', 'We decided to use Rust'),
        ...makeMessages(8, 200),
      ];
      const result = await c.compress(msgs, { brain });
      expect(result.learnedCount).toBe(0); // all failed
      expect(result.messages.length).toBeLessThan(10);
    });
  });

  describe('restore', () => {
    it('should call brain.recall and return strings', async () => {
      const brain = { recall: vi.fn().mockResolvedValue(['fact1', 'fact2']) };
      const c = new ContextCompressor();
      const results = await c.restore('test query', brain);
      expect(results).toEqual(['fact1', 'fact2']);
      expect(brain.recall).toHaveBeenCalledWith('test query');
    });

    it('should handle object results from recall', async () => {
      const brain = { recall: vi.fn().mockResolvedValue([{ content: 'data' }]) };
      const c = new ContextCompressor();
      const results = await c.restore('query', brain);
      expect(results).toEqual(['data']);
    });

    it('should return empty array when no brain', async () => {
      const c = new ContextCompressor();
      const results = await c.restore('query', null);
      expect(results).toEqual([]);
    });

    it('should handle recall failure', async () => {
      const brain = { recall: vi.fn().mockRejectedValue(new Error('fail')) };
      const c = new ContextCompressor();
      const results = await c.restore('query', brain);
      expect(results).toEqual([]);
    });
  });

  describe('config override', () => {
    it('should allow per-call config override', async () => {
      const c = new ContextCompressor({ maxTokens: 100000 }); // high default
      const msgs = makeMessages(10, 200);
      // Override with low threshold
      const result = await c.compress(msgs, { maxTokens: 100, compressThreshold: 0.5, preserveRecent: 2 });
      expect(result.messages.length).toBeLessThan(10);
    });
  });
});
