import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Tracer,
  ConsoleExporter,
  FileExporter,
  generateTraceId,
  generateSpanId,
} from '../src/telemetry';
import { BaseAgent } from '../src/core/agent';

describe('Telemetry', () => {
  let tracer: Tracer;

  beforeEach(() => {
    tracer = new Tracer({ maxSpans: 100 });
  });

  it('startSpan creates span with correct fields', () => {
    const span = tracer.startSpan('test-op', {
      attributes: { foo: 'bar' },
      kind: 'server',
    });
    expect(span.name).toBe('test-op');
    expect(span.kind).toBe('server');
    expect(span.status).toBe('unset');
    expect(span.traceId).toHaveLength(32);
    expect(span.spanId).toHaveLength(16);
    expect(span.attributes.foo).toBe('bar');
    expect(span.events).toEqual([]);
    expect(span.startTime).toBeGreaterThan(0);
    expect(span.endTime).toBeUndefined();
  });

  it('endSpan sets endTime and status', () => {
    const span = tracer.startSpan('op');
    tracer.endSpan(span, 'ok');
    expect(span.endTime).toBeGreaterThanOrEqual(span.startTime);
    expect(span.status).toBe('ok');
  });

  it('endSpan defaults to ok status', () => {
    const span = tracer.startSpan('op');
    tracer.endSpan(span);
    expect(span.status).toBe('ok');
  });

  it('addEvent adds to span events', () => {
    const span = tracer.startSpan('op');
    tracer.addEvent(span, 'checkpoint', { key: 'val' });
    expect(span.events).toHaveLength(1);
    expect(span.events[0].name).toBe('checkpoint');
    expect(span.events[0].attributes?.key).toBe('val');
    expect(span.events[0].timestamp).toBeGreaterThan(0);
  });

  it('getSpans with filters', () => {
    const s1 = tracer.startSpan('alpha', { attributes: {} });
    const s2 = tracer.startSpan('beta', { attributes: {} });
    tracer.endSpan(s1);
    tracer.endSpan(s2);

    expect(tracer.getSpans({ name: 'alpha' })).toHaveLength(1);
    expect(tracer.getSpans({ traceId: s1.traceId })).toHaveLength(1);
    expect(tracer.getSpans({ limit: 1 })).toHaveLength(1);
  });

  it('getTrace returns all spans for traceId', () => {
    const parent = tracer.startSpan('root');
    const child = tracer.startSpan('child', { parent });
    tracer.endSpan(child);
    tracer.endSpan(parent);

    const trace = tracer.getTrace(parent.traceId);
    expect(trace).toHaveLength(2);
    expect(trace[0].spanId).toBe(parent.spanId);
    expect(trace[1].parentSpanId).toBe(parent.spanId);
  });

  it('getStats returns correct stats', () => {
    const s1 = tracer.startSpan('op1');
    tracer.endSpan(s1, 'ok');
    const s2 = tracer.startSpan('op2');
    tracer.endSpan(s2, 'error');

    const stats = tracer.getStats();
    expect(stats.totalSpans).toBe(2);
    expect(stats.totalTraces).toBe(2);
    expect(stats.errorRate).toBe(0.5);
    expect(stats.spansByName).toEqual({ op1: 1, op2: 1 });
    expect(stats.p50Latency).toBeGreaterThanOrEqual(0);
    expect(stats.p95Latency).toBeGreaterThanOrEqual(0);
    expect(stats.p99Latency).toBeGreaterThanOrEqual(0);
  });

  it('increment/gauge/histogram add metrics', () => {
    tracer.increment('requests', 1, { method: 'GET' });
    tracer.gauge('connections', 5);
    tracer.histogram('latency', 42.5, { route: '/api' });

    const metrics = tracer.getMetrics();
    expect(metrics).toHaveLength(3);
    expect(metrics[0]).toMatchObject({ name: 'requests', type: 'counter', value: 1 });
    expect(metrics[1]).toMatchObject({ name: 'connections', type: 'gauge', value: 5 });
    expect(metrics[2]).toMatchObject({ name: 'latency', type: 'histogram', value: 42.5 });
  });

  it('maxSpans eviction', () => {
    const t = new Tracer({ maxSpans: 5 });
    for (let i = 0; i < 10; i++) {
      t.startSpan(`span-${i}`);
    }
    const spans = t.getSpans();
    expect(spans.length).toBe(5);
    // oldest evicted, newest 5 kept (span-5 through span-9)
    const names = spans.map(s => s.name).sort();
    expect(names).toEqual(['span-5', 'span-6', 'span-7', 'span-8', 'span-9']);
  });

  it('ConsoleExporter exports to console', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exporter = new ConsoleExporter();
    const span = tracer.startSpan('test');
    tracer.endSpan(span);
    await exporter.export([span]);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toContain('[TRACE]');
    consoleSpy.mockRestore();
  });

  it('FileExporter exports to file', async () => {
    const fs = require('fs');
    const tmpFile = require('path').join(require('os').tmpdir(), `opc-test-${Date.now()}.ndjson`);
    const exporter = new FileExporter(tmpFile);
    const span = tracer.startSpan('file-test');
    tracer.endSpan(span);
    await exporter.export([span]);
    const content = fs.readFileSync(tmpFile, 'utf-8');
    expect(content).toContain('file-test');
    fs.unlinkSync(tmpFile);
  });

  it('generateTraceId returns 32 hex chars', () => {
    const id = generateTraceId();
    expect(id).toHaveLength(32);
    expect(/^[0-9a-f]{32}$/.test(id)).toBe(true);
  });

  it('generateSpanId returns 16 hex chars', () => {
    const id = generateSpanId();
    expect(id).toHaveLength(16);
    expect(/^[0-9a-f]{16}$/.test(id)).toBe(true);
  });

  it('exportOTLP produces OTel-compatible format', () => {
    const span = tracer.startSpan('otlp-test', { attributes: { key: 'val' } });
    tracer.endSpan(span);
    const otlp = tracer.exportOTLP() as any;
    expect(otlp.resourceSpans).toHaveLength(1);
    expect(otlp.resourceSpans[0].scopeSpans[0].spans).toHaveLength(1);
    const s = otlp.resourceSpans[0].scopeSpans[0].spans[0];
    expect(s.name).toBe('otlp-test');
    expect(s.traceId).toBe(span.traceId);
  });

  it('clear removes all spans and metrics', () => {
    tracer.startSpan('x');
    tracer.increment('m');
    tracer.clear();
    expect(tracer.getSpans()).toHaveLength(0);
    expect(tracer.getMetrics()).toHaveLength(0);
  });

  it('agent integration: tracer on BaseAgent', () => {
    const t = new Tracer();
    const agent = new BaseAgent({ name: 'test', tracer: t });
    expect(agent.getTracer()).toBe(t);
  });

  it('agent integration: setTracer works', () => {
    const agent = new BaseAgent({ name: 'test' });
    expect(agent.getTracer()).toBeUndefined();
    const t = new Tracer();
    agent.setTracer(t);
    expect(agent.getTracer()).toBe(t);
  });
});
