/**
 * OPC Agent Traces — Structured logging for agent actions.
 * 
 * Collects traces that can be fed to DeepBrain's learn() API.
 * Inspired by OpenTelemetry spans.
 */

export interface Span {
  traceId: string;
  spanId: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
  status: 'ok' | 'error' | 'unset';
}

export interface SpanEvent {
  name: string;
  timestamp: Date;
  attributes?: Record<string, string | number | boolean>;
}

export interface TraceExporter {
  export(spans: Span[]): Promise<void>;
}

/** In-memory buffer that holds spans until flushed */
export class TraceCollector {
  private spans: Span[] = [];
  private exporters: TraceExporter[] = [];
  private maxBufferSize: number;

  constructor(maxBufferSize = 100) {
    this.maxBufferSize = maxBufferSize;
  }

  addExporter(exporter: TraceExporter): void {
    this.exporters.push(exporter);
  }

  startSpan(name: string, attributes: Record<string, string | number | boolean> = {}): Span {
    const span: Span = {
      traceId: crypto.randomUUID(),
      spanId: crypto.randomUUID().slice(0, 16),
      name,
      startTime: new Date(),
      attributes,
      events: [],
      status: 'unset',
    };
    this.spans.push(span);
    
    if (this.spans.length >= this.maxBufferSize) {
      this.flush().catch(() => {}); // Best effort
    }
    
    return span;
  }

  endSpan(span: Span, status: 'ok' | 'error' = 'ok'): void {
    span.endTime = new Date();
    span.status = status;
  }

  addEvent(span: Span, name: string, attributes?: Record<string, string | number | boolean>): void {
    span.events.push({ name, timestamp: new Date(), attributes });
  }

  async flush(): Promise<number> {
    const toExport = [...this.spans];
    this.spans = [];
    
    for (const exporter of this.exporters) {
      await exporter.export(toExport);
    }
    
    return toExport.length;
  }

  getBufferedSpans(): readonly Span[] {
    return this.spans;
  }

  get bufferedCount(): number {
    return this.spans.length;
  }
}

/** Console exporter for development */
export class ConsoleExporter implements TraceExporter {
  async export(spans: Span[]): Promise<void> {
    for (const span of spans) {
      const duration = span.endTime 
        ? `${span.endTime.getTime() - span.startTime.getTime()}ms`
        : 'ongoing';
      console.log(`[TRACE] ${span.name} (${duration}) [${span.status}]`);
    }
  }
}

/** DeepBrain exporter — sends traces to DeepBrain learn() */
export class DeepBrainExporter implements TraceExporter {
  private learnEndpoint: string;

  constructor(deepbrainUrl: string = 'http://localhost:3333') {
    this.learnEndpoint = `${deepbrainUrl}/api/learn`;
  }

  async export(spans: Span[]): Promise<void> {
    for (const span of spans) {
      try {
        await fetch(this.learnEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: span.name,
            result: span.status === 'ok' ? 'success' : 'error',
            context: {
              ...span.attributes,
              duration: span.endTime ? span.endTime.getTime() - span.startTime.getTime() : null,
              events: span.events.map(e => e.name),
            },
          }),
        });
      } catch {
        // Best effort — don't break agent if brain is down
      }
    }
  }
}
