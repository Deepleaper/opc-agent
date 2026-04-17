import { describe, it, expect, vi } from 'vitest';
import { StreamingManager, StreamableResponse } from '../src/core/streaming';
import type { StreamChunk } from '../src/core/streaming';

describe('StreamableResponse', () => {
  it('should collect chunks and build text', () => {
    const stream = new StreamableResponse('test-1');
    stream.push({ id: '0', type: 'text', data: 'Hello ', timestamp: Date.now() });
    stream.push({ id: '1', type: 'text', data: 'World', timestamp: Date.now() });
    expect(stream.getText()).toBe('Hello World');
    expect(stream.length).toBe(2);
  });

  it('should emit chunk events', () => {
    const stream = new StreamableResponse('test-2');
    const received: StreamChunk[] = [];
    stream.on('chunk', (c: StreamChunk) => received.push(c));
    stream.push({ id: '0', type: 'text', data: 'hi', timestamp: Date.now() });
    expect(received.length).toBe(1);
  });

  it('should emit end event', () => {
    const stream = new StreamableResponse('test-3');
    let ended = false;
    stream.on('end', () => { ended = true; });
    stream.end();
    expect(ended).toBe(true);
    expect(stream.isEnded).toBe(true);
  });

  it('should apply backpressure at highWaterMark', () => {
    const stream = new StreamableResponse('test-4', { highWaterMark: 2 });
    const chunk = (): StreamChunk => ({ id: 'c', type: 'text', data: 'x', timestamp: Date.now() });
    stream.push(chunk()); // 1 — ok
    const ok = stream.push(chunk()); // 2 — triggers backpressure
    expect(ok).toBe(false);
    expect(stream.isPaused).toBe(true);
  });

  it('should flush buffer on resume', () => {
    const stream = new StreamableResponse('test-5', { highWaterMark: 1 });
    const received: StreamChunk[] = [];
    stream.on('chunk', (c: StreamChunk) => received.push(c));
    stream.push({ id: '0', type: 'text', data: 'a', timestamp: Date.now() });
    // Now paused — next chunk goes to buffer
    stream.push({ id: '1', type: 'text', data: 'b', timestamp: Date.now() });
    expect(received.length).toBe(1);
    stream.resume();
    expect(received.length).toBe(2);
    expect(stream.isPaused).toBe(false);
  });

  it('should reject pushes after end', () => {
    const stream = new StreamableResponse('test-6');
    stream.end();
    const ok = stream.push({ id: '0', type: 'text', data: 'late', timestamp: Date.now() });
    expect(ok).toBe(false);
    expect(stream.length).toBe(0);
  });
});

describe('StreamingManager', () => {
  it('should create and manage streams', () => {
    const mgr = new StreamingManager();
    const stream = mgr.createStream();
    expect(stream.id).toMatch(/^stream_/);
    expect(mgr.activeCount).toBe(1);
  });

  it('should write chunks and end stream', () => {
    const mgr = new StreamingManager();
    const stream = mgr.createStream();
    mgr.writeChunk(stream.id, 'hello');
    mgr.writeChunk(stream.id, ' world');
    mgr.endStream(stream.id);
    expect(stream.getText()).toBe('hello world');
    expect(stream.isEnded).toBe(true);
  });

  it('should return false for unknown stream writes', () => {
    const mgr = new StreamingManager();
    expect(mgr.writeChunk('nonexistent', 'data')).toBe(false);
  });

  it('should format SSE correctly', () => {
    const chunk: StreamChunk = { id: 'c1', type: 'text', data: 'hi', timestamp: 123 };
    const sse = StreamingManager.formatSSE(chunk);
    expect(sse).toContain('event: text');
    expect(sse).toContain('id: c1');
    expect(sse).toContain('"data":"hi"');
  });

  it('should pipe to SSE response', () => {
    const mgr = new StreamingManager();
    const stream = mgr.createStream();
    const written: string[] = [];
    const mockRes = {
      write: (d: string) => { written.push(d); return true; },
      end: vi.fn(),
      setHeader: vi.fn(),
    };
    StreamingManager.pipeSSE(stream, mockRes, { heartbeatInterval: 100_000 });
    mgr.writeChunk(stream.id, 'data');
    mgr.endStream(stream.id);
    expect(written.length).toBeGreaterThan(0);
    expect(mockRes.end).toHaveBeenCalled();
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
  });
});
