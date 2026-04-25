import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import { EventEmitter } from 'events';

// We import the module AFTER setting up mocks so vi.mock hoisting applies.
vi.mock('http');

import { scanLocalProviders } from '../../src/discovery/scanner';

// ── Helpers ──────────────────────────────────────────────────

interface FakeResponse {
  statusCode: number;
  body: string;
}

function mockHttpRequest(responses: Map<number, FakeResponse>): void {
  const mockedHttp = vi.mocked(http);

  (mockedHttp.request as any).mockImplementation(
    (opts: { port: number }, callback: (res: any) => void) => {
      const fakeResponse = responses.get(opts.port);
      const req = new EventEmitter() as any;
      req.end = vi.fn();
      req.destroy = vi.fn(() => req.emit('error', new Error('destroyed')));
      req.setTimeout = vi.fn((ms: number, cb: () => void) => {
        // Don't auto-timeout in tests unless explicitly triggered
      });

      if (fakeResponse) {
        // Simulate async response via microtask
        Promise.resolve().then(() => {
          const res = new EventEmitter() as any;
          res.statusCode = fakeResponse.statusCode;
          res.resume = vi.fn();
          callback(res);
          res.emit('data', Buffer.from(fakeResponse.body));
          res.emit('end');
        });
      } else {
        // No response → simulate ECONNREFUSED
        Promise.resolve().then(() => {
          req.emit('error', new Error('ECONNREFUSED'));
        });
      }

      return req;
    },
  );
}

// ── Tests ─────────────────────────────────────────────────────

describe('scanLocalProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array when nothing is reachable', async () => {
    mockHttpRequest(new Map()); // no responses
    const result = await scanLocalProviders();
    expect(result).toEqual([]);
  });

  it('detects Ollama on port 11434 and parses model list', async () => {
    const ollamaBody = JSON.stringify({
      models: [
        { name: 'qwen3:14b' },
        { name: 'llama3.1:8b' },
        { name: 'nomic-embed-text:latest' },
      ],
    });
    mockHttpRequest(new Map([[11434, { statusCode: 200, body: ollamaBody }]]));

    const result = await scanLocalProviders();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('ollama');
    expect(result[0].url).toBe('http://localhost:11434');
    expect(result[0].models).toHaveLength(3);
    expect(result[0].models[0]).toEqual({ name: 'qwen3:14b', sizeB: 14 });
    expect(result[0].models[1]).toEqual({ name: 'llama3.1:8b', sizeB: 8 });
  });

  it('parses model size from Ollama model names', async () => {
    const body = JSON.stringify({
      models: [
        { name: 'deepseek-r1:671b' },
        { name: 'qwq:32b' },
        { name: 'phi3:3.8b' },
        { name: 'gemma3:latest' }, // no size → sizeB: 0
      ],
    });
    mockHttpRequest(new Map([[11434, { statusCode: 200, body }]]));

    const result = await scanLocalProviders();
    const models = result[0].models;

    expect(models.find((m) => m.name === 'deepseek-r1:671b')?.sizeB).toBe(671);
    expect(models.find((m) => m.name === 'qwq:32b')?.sizeB).toBe(32);
    expect(models.find((m) => m.name === 'phi3:3.8b')?.sizeB).toBe(3.8);
    expect(models.find((m) => m.name === 'gemma3:latest')?.sizeB).toBe(0);
  });

  it('detects LM Studio on port 1234 using OpenAI-compatible format', async () => {
    const body = JSON.stringify({
      data: [{ id: 'mistral-7b-instruct' }, { id: 'llama3-8b' }],
    });
    mockHttpRequest(new Map([[1234, { statusCode: 200, body }]]));

    const result = await scanLocalProviders();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('lm-studio');
    expect(result[0].models[0].name).toBe('mistral-7b-instruct');
  });

  it('detects multiple providers simultaneously', async () => {
    const ollamaBody = JSON.stringify({ models: [{ name: 'qwen3:14b' }] });
    const lmStudioBody = JSON.stringify({ data: [{ id: 'mistral-7b' }] });

    mockHttpRequest(
      new Map([
        [11434, { statusCode: 200, body: ollamaBody }],
        [1234, { statusCode: 200, body: lmStudioBody }],
      ]),
    );

    const result = await scanLocalProviders();

    expect(result).toHaveLength(2);
    const names = result.map((p) => p.name);
    expect(names).toContain('ollama');
    expect(names).toContain('lm-studio');
  });

  it('skips providers that return a 4xx error', async () => {
    const body = JSON.stringify({ models: [] });
    mockHttpRequest(new Map([[11434, { statusCode: 404, body }]]));

    const result = await scanLocalProviders();
    expect(result).toEqual([]);
  });

  it('skips providers that return an empty model list', async () => {
    const body = JSON.stringify({ models: [] });
    mockHttpRequest(new Map([[11434, { statusCode: 200, body }]]));

    const result = await scanLocalProviders();
    // Empty model list → treated as not configured
    expect(result).toEqual([]);
  });

  it('skips providers that return malformed JSON', async () => {
    mockHttpRequest(new Map([[11434, { statusCode: 200, body: 'not json' }]]));

    const result = await scanLocalProviders();
    expect(result).toEqual([]);
  });
});
