import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { APIServer } from '../src/core/api-server';

function createMockAgent(overrides: any = {}) {
  return {
    name: 'test-agent',
    state: 'running',
    config: { model: 'test-model', name: 'test-agent' },
    chat: async (msg: string) => `echo: ${msg}`,
    ...overrides,
  };
}

async function request(port: number, method: string, path: string, body?: any, headers?: Record<string, string>) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

describe('APIServer', () => {
  let server: APIServer;
  const port = 19876;

  beforeAll(async () => {
    server = new APIServer({ port, host: '127.0.0.1', agent: createMockAgent() });
    await server.start();
  });
  afterAll(async () => { await server.stop(); });

  it('GET /health returns ok', async () => {
    const res = await request(port, 'GET', '/health');
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.status).toBe('ok');
  });

  it('GET /v1/models lists models', async () => {
    const res = await request(port, 'GET', '/v1/models');
    const data: any = await res.json();
    expect(data.object).toBe('list');
    expect(data.data[0].id).toBe('test-model');
  });

  it('GET /v1/agent/status returns agent info', async () => {
    const res = await request(port, 'GET', '/v1/agent/status');
    const data: any = await res.json();
    expect(data.name).toBe('test-agent');
    expect(data.state).toBe('running');
  });

  it('POST /v1/chat/completions non-streaming', async () => {
    const res = await request(port, 'POST', '/v1/chat/completions', {
      model: 'test-model',
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.choices[0].message.content).toBe('echo: hello');
    expect(data.choices[0].finish_reason).toBe('stop');
    expect(data.id).toMatch(/^chatcmpl-/);
    expect(data.object).toBe('chat.completion');
  });

  it('POST /v1/chat/completions streaming', async () => {
    const res = await request(port, 'POST', '/v1/chat/completions', {
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    const text = await res.text();
    expect(text).toContain('data: ');
    expect(text).toContain('[DONE]');
    // Parse SSE chunks
    const chunks = text.split('\n').filter(l => l.startsWith('data: ') && !l.includes('[DONE]'));
    expect(chunks.length).toBeGreaterThan(0);
    const first = JSON.parse(chunks[0].slice(6));
    expect(first.object).toBe('chat.completion.chunk');
  });

  it('POST /v1/chat/completions rejects missing messages', async () => {
    const res = await request(port, 'POST', '/v1/chat/completions', { model: 'x' });
    expect(res.status).toBe(400);
    const data: any = await res.json();
    expect(data.error.type).toBe('invalid_request_error');
  });

  it('POST /v1/chat/completions rejects invalid JSON', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('OPTIONS returns CORS headers', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/v1/models`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('unknown route returns 404', async () => {
    const res = await request(port, 'GET', '/v1/unknown');
    expect(res.status).toBe(404);
    const data: any = await res.json();
    expect(data.error.code).toBe(404);
  });

  it('POST /v1/embeddings returns 501 without embed provider', async () => {
    const res = await request(port, 'POST', '/v1/embeddings', { input: 'hello' });
    expect(res.status).toBe(501);
  });

  it('POST /v1/embeddings rejects missing input', async () => {
    const res = await request(port, 'POST', '/v1/embeddings', { model: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('APIServer with auth', () => {
  let server: APIServer;
  const port = 19877;

  beforeAll(async () => {
    server = new APIServer({ port, host: '127.0.0.1', apiKey: 'secret-key', agent: createMockAgent() });
    await server.start();
  });
  afterAll(async () => { await server.stop(); });

  it('rejects unauthenticated requests', async () => {
    const res = await request(port, 'GET', '/v1/models');
    expect(res.status).toBe(401);
  });

  it('accepts valid Bearer token', async () => {
    const res = await request(port, 'GET', '/v1/models', undefined, { Authorization: 'Bearer secret-key' });
    expect(res.status).toBe(200);
  });

  it('health check works without auth', async () => {
    const res = await request(port, 'GET', '/health');
    expect(res.status).toBe(200);
  });
});
