/**
 * OPC Agent Telemetry — Lightweight OTel-compatible tracing & metrics.
 * Zero external dependencies. Produces OTLP-compatible JSON.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';

// ─── Types ───────────────────────────────────────────────────

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: 'internal' | 'client' | 'server';
  startTime: number;    // epoch ms
  endTime?: number;
  status: 'ok' | 'error' | 'unset';
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

export interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number;
  timestamp: number;
  labels: Record<string, string>;
}

export interface TraceExporter {
  export(spans: Span[]): Promise<void>;
}

// ─── ID Generation ───────────────────────────────────────────

export function generateTraceId(): string {
  return crypto.randomBytes(16).toString('hex'); // 32 hex chars
}

export function generateSpanId(): string {
  return crypto.randomBytes(8).toString('hex'); // 16 hex chars
}

// ─── Tracer ──────────────────────────────────────────────────

export class Tracer {
  private spans: Span[] = [];
  private metrics: Metric[] = [];
  private maxSpans: number;
  private maxMetrics: number;
  private exporters: TraceExporter[] = [];

  constructor(options?: { maxSpans?: number; maxMetrics?: number }) {
    this.maxSpans = options?.maxSpans || 10000;
    this.maxMetrics = options?.maxMetrics || 50000;
  }

  startSpan(name: string, options?: {
    parent?: Span;
    attributes?: Record<string, string | number | boolean>;
    kind?: Span['kind'];
  }): Span {
    const span: Span = {
      traceId: options?.parent?.traceId || generateTraceId(),
      spanId: generateSpanId(),
      parentSpanId: options?.parent?.spanId,
      name,
      kind: options?.kind || 'internal',
      startTime: Date.now(),
      status: 'unset',
      attributes: options?.attributes ? { ...options.attributes } : {},
      events: [],
    };
    this.spans.push(span);

    // Evict oldest spans if over limit
    if (this.spans.length > this.maxSpans) {
      const excess = this.spans.length - this.maxSpans;
      this.spans.splice(0, excess);
    }

    return span;
  }

  endSpan(span: Span, status?: Span['status']): void {
    span.endTime = Date.now();
    span.status = status || 'ok';

    // Notify exporters
    for (const exporter of this.exporters) {
      exporter.export([span]).catch(() => {});
    }
  }

  addEvent(span: Span, name: string, attributes?: Record<string, string | number | boolean>): void {
    span.events.push({ name, timestamp: Date.now(), attributes });
  }

  // ─── Metrics ─────────────────────────────────────────────

  increment(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    this.addMetric(name, 'counter', value, labels);
  }

  gauge(name: string, value: number, labels: Record<string, string> = {}): void {
    this.addMetric(name, 'gauge', value, labels);
  }

  histogram(name: string, value: number, labels: Record<string, string> = {}): void {
    this.addMetric(name, 'histogram', value, labels);
  }

  private addMetric(name: string, type: Metric['type'], value: number, labels: Record<string, string>): void {
    this.metrics.push({ name, type, value, timestamp: Date.now(), labels });
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.splice(0, this.metrics.length - this.maxMetrics);
    }
  }

  // ─── Query ───────────────────────────────────────────────

  getSpans(options?: { limit?: number; traceId?: string; name?: string; since?: number }): Span[] {
    let result = [...this.spans];

    if (options?.traceId) result = result.filter(s => s.traceId === options.traceId);
    if (options?.name) result = result.filter(s => s.name === options.name);
    if (options?.since) result = result.filter(s => s.startTime >= options.since!);

    // Most recent first
    result.sort((a, b) => b.startTime - a.startTime);

    if (options?.limit) result = result.slice(0, options.limit);
    return result;
  }

  getMetrics(options?: { name?: string; since?: number }): Metric[] {
    let result = [...this.metrics];
    if (options?.name) result = result.filter(m => m.name === options.name);
    if (options?.since) result = result.filter(m => m.timestamp >= options.since!);
    return result;
  }

  getTrace(traceId: string): Span[] {
    return this.spans.filter(s => s.traceId === traceId).sort((a, b) => a.startTime - b.startTime);
  }

  // ─── Export (OTLP-compatible) ────────────────────────────

  addExporter(exporter: TraceExporter): void {
    this.exporters.push(exporter);
  }

  exportOTLP(): object {
    // OTLP JSON format: https://opentelemetry.io/docs/specs/otlp/
    const spansByResource = this.spans.filter(s => s.endTime != null);

    return {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'opc-agent' } },
          ],
        },
        scopeSpans: [{
          scope: { name: 'opc-telemetry', version: '1.0.0' },
          spans: spansByResource.map(s => ({
            traceId: s.traceId,
            spanId: s.spanId,
            parentSpanId: s.parentSpanId || '',
            name: s.name,
            kind: s.kind === 'server' ? 2 : s.kind === 'client' ? 3 : 1,
            startTimeUnixNano: String(s.startTime * 1_000_000),
            endTimeUnixNano: String((s.endTime || s.startTime) * 1_000_000),
            attributes: Object.entries(s.attributes).map(([key, value]) => ({
              key,
              value: typeof value === 'string' ? { stringValue: value }
                : typeof value === 'number' ? (Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value })
                : { boolValue: value },
            })),
            events: s.events.map(e => ({
              timeUnixNano: String(e.timestamp * 1_000_000),
              name: e.name,
              attributes: e.attributes ? Object.entries(e.attributes).map(([key, value]) => ({
                key,
                value: typeof value === 'string' ? { stringValue: value }
                  : typeof value === 'number' ? { intValue: String(value) }
                  : { boolValue: value },
              })) : [],
            })),
            status: {
              code: s.status === 'ok' ? 1 : s.status === 'error' ? 2 : 0,
            },
          })),
        }],
      }],
    };
  }

  // ─── Stats ───────────────────────────────────────────────

  getStats(): {
    totalSpans: number;
    totalTraces: number;
    avgDuration: number;
    errorRate: number;
    spansByName: Record<string, number>;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
  } {
    const completed = this.spans.filter(s => s.endTime != null);
    const durations = completed.map(s => s.endTime! - s.startTime).sort((a, b) => a - b);
    const traceIds = new Set(this.spans.map(s => s.traceId));
    const errors = completed.filter(s => s.status === 'error').length;

    const spansByName: Record<string, number> = {};
    for (const s of this.spans) {
      spansByName[s.name] = (spansByName[s.name] || 0) + 1;
    }

    const percentile = (arr: number[], p: number): number => {
      if (arr.length === 0) return 0;
      const idx = Math.ceil(arr.length * p / 100) - 1;
      return arr[Math.max(0, idx)];
    };

    return {
      totalSpans: this.spans.length,
      totalTraces: traceIds.size,
      avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      errorRate: completed.length > 0 ? errors / completed.length : 0,
      spansByName,
      p50Latency: percentile(durations, 50),
      p95Latency: percentile(durations, 95),
      p99Latency: percentile(durations, 99),
    };
  }

  clear(): void {
    this.spans = [];
    this.metrics = [];
  }
}

// ─── Exporters ───────────────────────────────────────────────

export class ConsoleExporter implements TraceExporter {
  async export(spans: Span[]): Promise<void> {
    for (const span of spans) {
      const duration = span.endTime ? `${span.endTime - span.startTime}ms` : 'ongoing';
      console.log(`[TRACE] ${span.name} (${duration}) [${span.status}] trace=${span.traceId.slice(0, 8)}`);
    }
  }
}

export class FileExporter implements TraceExporter {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async export(spans: Span[]): Promise<void> {
    const lines = spans.map(s => JSON.stringify(s)).join('\n') + '\n';
    fs.appendFileSync(this.filePath, lines);
  }
}

export class OTLPHttpExporter implements TraceExporter {
  private endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint.replace(/\/$/, '');
  }

  async export(spans: Span[]): Promise<void> {
    const body = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'opc-agent' } },
          ],
        },
        scopeSpans: [{
          scope: { name: 'opc-telemetry', version: '1.0.0' },
          spans: spans.filter(s => s.endTime).map(s => ({
            traceId: s.traceId,
            spanId: s.spanId,
            parentSpanId: s.parentSpanId || '',
            name: s.name,
            kind: s.kind === 'server' ? 2 : s.kind === 'client' ? 3 : 1,
            startTimeUnixNano: String(s.startTime * 1_000_000),
            endTimeUnixNano: String((s.endTime || s.startTime) * 1_000_000),
            attributes: Object.entries(s.attributes).map(([key, value]) => ({
              key,
              value: typeof value === 'string' ? { stringValue: value }
                : typeof value === 'number' ? { intValue: String(value) }
                : { boolValue: value },
            })),
            status: { code: s.status === 'ok' ? 1 : s.status === 'error' ? 2 : 0 },
          })),
        }],
      }],
    };

    try {
      await fetch(`${this.endpoint}/v1/traces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      // Best effort
    }
  }
}
