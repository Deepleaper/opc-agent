import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────────

export interface StreamChunk {
  id: string;
  type: 'text' | 'tool_call' | 'error' | 'done';
  data: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface StreamOptions {
  /** High-water mark for backpressure (default 64 chunks). */
  highWaterMark?: number;
  /** Heartbeat interval in ms to keep connection alive (default 15000). */
  heartbeatInterval?: number;
}

// ─── StreamableResponse ──────────────────────────────────────

export class StreamableResponse extends EventEmitter {
  readonly id: string;
  private chunks: StreamChunk[] = [];
  private ended = false;
  private paused = false;
  private buffer: StreamChunk[] = [];
  private highWaterMark: number;

  constructor(id: string, options?: StreamOptions) {
    super();
    this.id = id;
    this.highWaterMark = options?.highWaterMark ?? 64;
  }

  /** Push a chunk. Returns false if backpressure threshold reached. */
  push(chunk: StreamChunk): boolean {
    if (this.ended) return false;

    this.chunks.push(chunk);

    if (this.paused) {
      this.buffer.push(chunk);
      return this.buffer.length < this.highWaterMark;
    }

    this.emit('chunk', chunk);

    if (this.chunks.length >= this.highWaterMark) {
      this.paused = true;
      this.emit('backpressure');
      return false;
    }
    return true;
  }

  /** Resume after backpressure — flush buffered chunks. */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    const buffered = this.buffer.splice(0);
    for (const chunk of buffered) {
      this.emit('chunk', chunk);
    }
    this.emit('drain');
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    if (this.paused) this.resume();
    this.emit('end');
  }

  getChunks(): StreamChunk[] {
    return [...this.chunks];
  }

  /** Collect all text chunks into a single string. */
  getText(): string {
    return this.chunks
      .filter((c) => c.type === 'text')
      .map((c) => c.data)
      .join('');
  }

  get isEnded(): boolean {
    return this.ended;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get length(): number {
    return this.chunks.length;
  }
}

// ─── StreamingManager ────────────────────────────────────────

export class StreamingManager {
  private streams: Map<string, StreamableResponse> = new Map();
  private counter = 0;

  /** Create a new stream. */
  createStream(options?: StreamOptions): StreamableResponse {
    const id = `stream_${++this.counter}_${Date.now()}`;
    const stream = new StreamableResponse(id, options);
    this.streams.set(id, stream);
    stream.on('end', () => {
      // Keep ended streams for a bit for late consumers, then clean up
      setTimeout(() => this.streams.delete(id), 30_000);
    });
    return stream;
  }

  /** Write a text chunk to a stream. */
  writeChunk(streamId: string, data: string, metadata?: Record<string, unknown>): boolean {
    const stream = this.streams.get(streamId);
    if (!stream) return false;
    return stream.push({
      id: `chunk_${stream.length}`,
      type: 'text',
      data,
      timestamp: Date.now(),
      metadata,
    });
  }

  /** End a stream. */
  endStream(streamId: string): void {
    const stream = this.streams.get(streamId);
    if (!stream) return;
    stream.push({
      id: `chunk_${stream.length}`,
      type: 'done',
      data: '',
      timestamp: Date.now(),
    });
    stream.end();
  }

  /** Get an existing stream. */
  getStream(streamId: string): StreamableResponse | undefined {
    return this.streams.get(streamId);
  }

  /** Format a chunk as an SSE event string. */
  static formatSSE(chunk: StreamChunk): string {
    const lines: string[] = [];
    lines.push(`event: ${chunk.type}`);
    lines.push(`id: ${chunk.id}`);
    const payload = JSON.stringify({ data: chunk.data, metadata: chunk.metadata });
    lines.push(`data: ${payload}`);
    lines.push('');
    return lines.join('\n') + '\n';
  }

  /** Pipe a stream to an SSE-compatible HTTP response (Express-style). */
  static pipeSSE(
    stream: StreamableResponse,
    res: { write(data: string): boolean; end(): void; setHeader?(name: string, value: string): void },
    options?: StreamOptions,
  ): void {
    res.setHeader?.('Content-Type', 'text/event-stream');
    res.setHeader?.('Cache-Control', 'no-cache');
    res.setHeader?.('Connection', 'keep-alive');

    const heartbeatMs = options?.heartbeatInterval ?? 15_000;
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, heartbeatMs);

    stream.on('chunk', (chunk: StreamChunk) => {
      const ok = res.write(StreamingManager.formatSSE(chunk));
      if (!ok && stream.isPaused === false) {
        // Downstream can't keep up — will resume on drain from stream
      }
    });

    stream.on('end', () => {
      clearInterval(heartbeat);
      res.end();
    });
  }

  get activeCount(): number {
    let count = 0;
    for (const s of this.streams.values()) {
      if (!s.isEnded) count++;
    }
    return count;
  }
}
