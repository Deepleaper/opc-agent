// AG-UI Protocol Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AGUIEventEmitter,
  AGUIServer,
  AGUIClient,
  AGUI_EVENT_TYPES,
  isValidEventType,
} from '../src/protocols/agui';
import type { AGUIEvent, AGUIRunRequest } from '../src/protocols/agui';

// ─── Mock ServerResponse ─────────────────────────────────────

function createMockRes() {
  const chunks: string[] = [];
  return {
    chunks,
    writeHead: vi.fn(),
    write: vi.fn((data: string) => { chunks.push(data); return true; }),
    end: vi.fn(),
  };
}

function parseSSEChunks(chunks: string[]): AGUIEvent[] {
  return chunks
    .filter(c => c.startsWith('data: '))
    .map(c => JSON.parse(c.slice(6).trim()));
}

// ─── Tests ───────────────────────────────────────────────────

describe('AG-UI Protocol', () => {
  describe('isValidEventType', () => {
    it('should validate known event types', () => {
      expect(isValidEventType('TEXT_MESSAGE_START')).toBe(true);
      expect(isValidEventType('RUN_FINISHED')).toBe(true);
      expect(isValidEventType('CUSTOM')).toBe(true);
    });

    it('should reject unknown event types', () => {
      expect(isValidEventType('UNKNOWN')).toBe(false);
      expect(isValidEventType('')).toBe(false);
    });

    it('should have all 15 event types', () => {
      expect(AGUI_EVENT_TYPES.length).toBe(15);
    });
  });

  describe('AGUIEventEmitter', () => {
    let res: ReturnType<typeof createMockRes>;
    let emitter: AGUIEventEmitter;

    beforeEach(() => {
      res = createMockRes();
      emitter = new AGUIEventEmitter(res as any);
    });

    it('should emit SSE-formatted events', () => {
      emitter.emit({ type: 'RUN_STARTED', runId: 'r1', timestamp: '2025-01-01T00:00:00Z' });
      expect(res.chunks.length).toBe(1);
      expect(res.chunks[0]).toMatch(/^data: \{.*\}\n\n$/);
      const parsed = JSON.parse(res.chunks[0].slice(6));
      expect(parsed.type).toBe('RUN_STARTED');
      expect(parsed.runId).toBe('r1');
    });

    it('should emit textStart/textContent/textEnd flow', () => {
      emitter.textStart('msg1');
      emitter.textContent('msg1', 'Hello');
      emitter.textContent('msg1', ' world');
      emitter.textEnd('msg1');
      const events = parseSSEChunks(res.chunks);
      expect(events.length).toBe(4);
      expect(events[0].type).toBe('TEXT_MESSAGE_START');
      expect(events[0].messageId).toBe('msg1');
      expect((events[0] as any).role).toBe('assistant');
      expect(events[1].type).toBe('TEXT_MESSAGE_CONTENT');
      expect((events[1] as any).delta).toBe('Hello');
      expect(events[2].type).toBe('TEXT_MESSAGE_CONTENT');
      expect((events[2] as any).delta).toBe(' world');
      expect(events[3].type).toBe('TEXT_MESSAGE_END');
    });

    it('should emit tool call flow', () => {
      emitter.toolCallStart('tc1', 'search');
      emitter.toolCallArgs('tc1', '{"q":"test"}');
      emitter.toolCallEnd('tc1');
      const events = parseSSEChunks(res.chunks);
      expect(events.length).toBe(3);
      expect(events[0].type).toBe('TOOL_CALL_START');
      expect((events[0] as any).toolCallName).toBe('search');
      expect(events[1].type).toBe('TOOL_CALL_ARGS');
      expect(events[2].type).toBe('TOOL_CALL_END');
    });

    it('should emit runStarted/runFinished', () => {
      emitter.runStarted('r1', 'thread1');
      emitter.runFinished('r1');
      const events = parseSSEChunks(res.chunks);
      expect(events[0].type).toBe('RUN_STARTED');
      expect((events[0] as any).threadId).toBe('thread1');
      expect(events[1].type).toBe('RUN_FINISHED');
    });

    it('should emit runError', () => {
      emitter.runError('r1', 'Something went wrong', 'INTERNAL');
      const events = parseSSEChunks(res.chunks);
      expect(events[0].type).toBe('RUN_ERROR');
      expect((events[0] as any).message).toBe('Something went wrong');
      expect((events[0] as any).code).toBe('INTERNAL');
    });

    it('should emit stateSnapshot', () => {
      emitter.stateSnapshot({ count: 42 });
      const events = parseSSEChunks(res.chunks);
      expect(events[0].type).toBe('STATE_SNAPSHOT');
      expect((events[0] as any).snapshot.count).toBe(42);
    });

    it('should emit stateDelta', () => {
      emitter.stateDelta([{ op: 'replace', path: '/count', value: 43 }]);
      const events = parseSSEChunks(res.chunks);
      expect(events[0].type).toBe('STATE_DELTA');
      expect((events[0] as any).delta[0].op).toBe('replace');
    });

    it('should not emit after close', () => {
      emitter.close();
      emitter.textStart('msg1');
      expect(res.chunks.length).toBe(0);
      expect(res.end).toHaveBeenCalled();
    });

    it('should include timestamp on convenience methods', () => {
      emitter.textStart('msg1');
      const events = parseSSEChunks(res.chunks);
      expect(events[0].timestamp).toBeDefined();
      expect(typeof events[0].timestamp).toBe('string');
    });

    it('should emit step events', () => {
      emitter.stepStarted('s1', 'process');
      emitter.stepFinished('s1');
      const events = parseSSEChunks(res.chunks);
      expect(events[0].type).toBe('STEP_STARTED');
      expect((events[0] as any).stepName).toBe('process');
      expect(events[1].type).toBe('STEP_FINISHED');
    });

    it('should emit custom events', () => {
      emitter.custom('my_event', { foo: 'bar' });
      const events = parseSSEChunks(res.chunks);
      expect(events[0].type).toBe('CUSTOM');
      expect((events[0] as any).name).toBe('my_event');
      expect((events[0] as any).value.foo).toBe('bar');
    });

    it('should emit messagesSnapshot', () => {
      emitter.messagesSnapshot([{ id: 'm1', role: 'user', content: 'hi' }]);
      const events = parseSSEChunks(res.chunks);
      expect(events[0].type).toBe('MESSAGES_SNAPSHOT');
      expect((events[0] as any).messages[0].content).toBe('hi');
    });
  });

  describe('AGUIServer', () => {
    it('should construct with default path', () => {
      const mockAgent = { handleMessage: vi.fn(), handleMessageStream: vi.fn() };
      const server = new AGUIServer(mockAgent as any);
      expect(server).toBeDefined();
    });

    it('should handle run request with mock agent', async () => {
      const mockAgent = {
        handleMessage: vi.fn().mockResolvedValue({ content: 'Hello!' }),
        handleMessageStream: async function* () { yield 'Hel'; yield 'lo!'; },
      };
      const server = new AGUIServer(mockAgent as any);
      const res = createMockRes();

      // Simulate request
      const body = JSON.stringify({
        messages: [{ id: 'msg1', role: 'user', content: 'Hi' }],
      });
      const req = {
        [Symbol.asyncIterator]: async function* () { yield body; },
      };

      await server.handleRun(req as any, res as any);

      expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream',
      }));

      const events = parseSSEChunks(res.chunks);
      const types = events.map(e => e.type);
      expect(types).toContain('RUN_STARTED');
      expect(types).toContain('TEXT_MESSAGE_START');
      expect(types).toContain('TEXT_MESSAGE_CONTENT');
      expect(types).toContain('TEXT_MESSAGE_END');
      expect(types).toContain('RUN_FINISHED');
    });

    it('should return 400 for invalid JSON', async () => {
      const mockAgent = { handleMessage: vi.fn() };
      const server = new AGUIServer(mockAgent as any);
      const res = createMockRes();
      const req = { [Symbol.asyncIterator]: async function* () { yield 'not json'; } };

      await server.handleRun(req as any, res as any);
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    });

    it('should return 400 for missing messages', async () => {
      const mockAgent = { handleMessage: vi.fn() };
      const server = new AGUIServer(mockAgent as any);
      const res = createMockRes();
      const req = { [Symbol.asyncIterator]: async function* () { yield '{}'; } };

      await server.handleRun(req as any, res as any);
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    });
  });

  describe('AGUIClient', () => {
    it('should construct with endpoint', () => {
      const client = new AGUIClient('http://localhost:3000/agui');
      expect(client).toBeDefined();
    });

    it('should abort cleanly', () => {
      const client = new AGUIClient('http://localhost:3000/agui');
      // Should not throw when no active request
      client.abort();
    });
  });

  describe('Protocol list includes agui', () => {
    it('should have agui in AGUI_EVENT_TYPES constants', () => {
      expect(AGUI_EVENT_TYPES).toContain('TEXT_MESSAGE_START');
      expect(AGUI_EVENT_TYPES).toContain('RUN_STARTED');
      expect(AGUI_EVENT_TYPES).toContain('TOOL_CALL_START');
    });
  });
});
