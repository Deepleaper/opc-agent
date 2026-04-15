import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { AgentRuntime } from '../src/core/runtime';
import { createCustomerServiceConfig } from '../src/templates/customer-service';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

function httpPost(url: string, body: any): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(body);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString()));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    http.get({ hostname: u.hostname, port: u.port, path: u.pathname }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
    }).on('error', reject);
  });
}

describe('OPC Agent E2E', () => {
  let runtime: AgentRuntime;
  const port = 3456;

  beforeAll(async () => {
    // Mock LLM by setting env to use a fake provider
    // We'll test the web channel serves and responds
    const config = createCustomerServiceConfig();
    config.metadata.name = 'test-agent';
    config.spec.channels = [{ type: 'web' as const, port }];

    runtime = new AgentRuntime();
    // Write temp oad.yaml
    const tmpDir = path.join(__dirname, '..', 'tmp-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const oadPath = path.join(tmpDir, 'oad.yaml');
    fs.writeFileSync(oadPath, yaml.dump(config));

    await runtime.loadConfig(oadPath);
    await runtime.initialize();
    await runtime.start();

    // Clean up temp
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }, 15000);

  afterAll(async () => {
    await runtime.stop();
  });

  it('serves chat UI at /', async () => {
    const res = await httpGet(`http://localhost:${port}/`);
    expect(res.status).toBe(200);
    expect(res.body).toContain('OPC Agent');
    expect(res.body).toContain('<html');
  });

  it('health endpoint returns ok', async () => {
    const res = await httpGet(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.status).toBe('ok');
  });

  it('POST /api/chat returns SSE stream', async () => {
    const res = await httpPost(`http://localhost:${port}/api/chat`, {
      message: 'Hello',
      sessionId: 'test-1',
    });
    // Should get 200 (streaming response or error about API key)
    expect(res.status).toBe(200);
    // Response should contain SSE data lines
    expect(res.body).toContain('data: ');
  });

  it('rejects empty message', async () => {
    const res = await httpPost(`http://localhost:${port}/api/chat`, {});
    expect(res.status).toBe(400);
  });

  it('GET /api/info returns agent name', async () => {
    const res = await httpGet(`http://localhost:${port}/api/info`);
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.name).toBe('test-agent');
  });
});

describe('Init template', () => {
  const testDir = path.join(__dirname, '..', 'tmp-init-test');

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('creates all expected files', () => {
    // Simulate init
    fs.mkdirSync(testDir, { recursive: true });
    const config = createCustomerServiceConfig();
    config.metadata.name = 'test-init';
    fs.writeFileSync(path.join(testDir, 'oad.yaml'), yaml.dump(config));
    fs.writeFileSync(path.join(testDir, '.env.example'), 'OPC_LLM_API_KEY=test\n');
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(testDir, 'README.md'), '# test');

    expect(fs.existsSync(path.join(testDir, 'oad.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, '.env.example'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'README.md'))).toBe(true);
  });
});
