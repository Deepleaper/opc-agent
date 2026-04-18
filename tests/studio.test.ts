import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { StudioServer } from '../src/studio/server';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import * as http from 'http';

const TEST_PORT = 14789;
const TEST_DIR = join(__dirname, '__studio_test_fixture__');
const STATIC_DIR = join(TEST_DIR, 'studio-ui');

function fetch(path: string, method = 'GET', body?: string): Promise<{ status: number; headers: any; body: string }> {
  return new Promise((resolve, reject) => {
    const opts: http.RequestOptions = {
      hostname: 'localhost',
      port: TEST_PORT,
      path,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('StudioServer', () => {
  let server: StudioServer;

  beforeAll(async () => {
    // Create test fixture
    mkdirSync(STATIC_DIR, { recursive: true });
    writeFileSync(join(STATIC_DIR, 'index.html'), '<html><body>OPC Studio</body></html>');
    writeFileSync(join(STATIC_DIR, 'app.js'), 'console.log("hello")');
    writeFileSync(join(STATIC_DIR, 'style.css'), 'body { margin: 0; }');
    writeFileSync(join(STATIC_DIR, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(join(STATIC_DIR, 'icon.svg'), '<svg></svg>');
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test-agent', version: '1.2.3', description: 'Test agent' }));

    server = new StudioServer({
      port: TEST_PORT,
      agentDir: TEST_DIR,
      staticDir: STATIC_DIR,
    });
    await server.start();
    // Give server time to bind
    await new Promise((r) => setTimeout(r, 200));
  });

  afterAll(async () => {
    await server.stop();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  // Test 1: Constructor defaults
  it('should have default config values', () => {
    const s = new StudioServer();
    const cfg = s.getConfig();
    expect(cfg.port).toBe(4000);
    expect(cfg.agentDir).toBe(process.cwd());
    expect(cfg.staticDir).toContain('studio-ui');
  });

  // Test 2: Constructor with custom port
  it('should accept custom config', () => {
    const s = new StudioServer({ port: 5555, agentDir: '/tmp/test' });
    const cfg = s.getConfig();
    expect(cfg.port).toBe(5555);
    expect(cfg.agentDir).toBe('/tmp/test');
  });

  // Test 3: /api/agent/info returns agent info
  it('GET /api/agent/info returns agent info', async () => {
    const res = await fetch('/api/agent/info');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.name).toBe('test-agent');
    expect(data.version).toBe('1.2.3');
    expect(data.status).toBe('running');
  });

  // Test 4: /api/tools/list returns tools
  it('GET /api/tools/list returns tools array', async () => {
    const res = await fetch('/api/tools/list');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toHaveProperty('tools');
    expect(Array.isArray(data.tools)).toBe(true);
  });

  // Test 5: /api/doctor/check runs
  it('GET /api/doctor/check returns result', async () => {
    const res = await fetch('/api/doctor/check');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toBeDefined();
  });

  // Test 6: unknown API returns 404
  it('GET /api/unknown returns 404', async () => {
    const res = await fetch('/api/nonexistent/route');
    expect(res.status).toBe(404);
    const data = JSON.parse(res.body);
    expect(data.error).toBe('Not found');
  });

  // Test 7: Static file serving - HTML
  it('serves index.html at root', async () => {
    const res = await fetch('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/html');
    expect(res.body).toContain('OPC Studio');
  });

  // Test 8: Static file serving - JS with correct MIME
  it('serves .js with correct MIME type', async () => {
    const res = await fetch('/app.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/javascript');
  });

  // Test 9: Static file serving - CSS with correct MIME
  it('serves .css with correct MIME type', async () => {
    const res = await fetch('/style.css');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/css');
  });

  // Test 10: CORS headers present on API responses
  it('API responses include CORS headers', async () => {
    const res = await fetch('/api/agent/info');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  // Test 11: SPA fallback for unknown static paths
  it('falls back to index.html for unknown paths', async () => {
    const res = await fetch('/some/deep/route');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/html');
    expect(res.body).toContain('OPC Studio');
  });

  // Test 12: /api/analytics/overview
  it('GET /api/analytics/overview returns analytics', async () => {
    const res = await fetch('/api/analytics/overview');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toHaveProperty('totalMessages');
    expect(data).toHaveProperty('totalSessions');
  });

  // Test 13: /api/security/approvals
  it('GET /api/security/approvals returns empty approvals', async () => {
    const res = await fetch('/api/security/approvals');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.approvals).toEqual([]);
  });

  // Test 14: /api/logs/recent returns lines array
  it('GET /api/logs/recent returns lines', async () => {
    const res = await fetch('/api/logs/recent');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(Array.isArray(data.lines)).toBe(true);
  });

  // Test 15: SVG MIME type
  it('serves .svg with correct MIME type', async () => {
    const res = await fetch('/icon.svg');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/svg+xml');
  });

  // Test 16: /api/modules returns module status
  it('GET /api/modules returns module status', async () => {
    const res = await fetch('/api/modules');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toHaveProperty('modules');
    expect(data.modules).toHaveLength(3);
    expect(data.modules[0]).toHaveProperty('name', 'DeepBrain');
    expect(data.modules[0]).toHaveProperty('running');
    expect(data.modules[0]).toHaveProperty('port', 4001);
    expect(data.modules[1]).toHaveProperty('name', 'AgentKits');
    expect(data.modules[2]).toHaveProperty('name', 'Workstation');
  });

  // Test 17: Proxy returns 502 when module not running
  it('proxy returns 502 with friendly message when module not running', async () => {
    const res = await fetch('/brain/');
    expect(res.status).toBe(502);
    expect(res.body).toContain('Module not running');
    expect(res.body).toContain('DeepBrain');
  });

  // Test 18: Proxy routes are configured for all modules
  it('proxy routes configured for all modules', async () => {
    const brainRes = await fetch('/brain/');
    const kitsRes = await fetch('/kits/');
    const wsRes = await fetch('/workstation/');
    // All should get 502 (not 200/SPA fallback) since no modules running
    expect(brainRes.status).toBe(502);
    expect(kitsRes.status).toBe(502);
    expect(wsRes.status).toBe(502);
  });

  // Test 19: Module nav items in real index.html
  it('real index.html contains module nav items', () => {
    const realHtml = readFileSync(join(__dirname, '../src/studio-ui/index.html'), 'utf-8');
    expect(realHtml).toContain('data-page="brain-module"');
    expect(realHtml).toContain('data-page="kits-module"');
    expect(realHtml).toContain('data-page="workstation-module"');
    expect(realHtml).toContain('data-page="modules"');
  });

  // Test 20: Iframe src correct in real index.html
  it('real index.html contains correct iframe srcs', () => {
    const realHtml = readFileSync(join(__dirname, '../src/studio-ui/index.html'), 'utf-8');
    expect(realHtml).toContain('src="/brain/"');
    expect(realHtml).toContain('src="/kits/"');
    expect(realHtml).toContain('src="/workstation/"');
  });
});
