import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

vi.mock('http');

import { scanLocalProviders, scanEngineStatuses, selectModels } from '../../src/discovery';

// ── Mock helpers ──────────────────────────────────────────────

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
      req.setTimeout = vi.fn();

      if (fakeResponse) {
        Promise.resolve().then(() => {
          const res = new EventEmitter() as any;
          res.statusCode = fakeResponse.statusCode;
          res.resume = vi.fn();
          callback(res);
          res.emit('data', Buffer.from(fakeResponse.body));
          res.emit('end');
        });
      } else {
        Promise.resolve().then(() => {
          req.emit('error', new Error('ECONNREFUSED'));
        });
      }
      return req;
    },
  );
}

// Mirrors the .env generation logic in cli.ts init action
function buildEnvContent(discovery: ReturnType<typeof selectModels>): string {
  const chatModel = discovery.chat ?? discovery.code ?? discovery.reasoning;
  const hasLocal = Object.keys(discovery).length > 0;

  if (hasLocal && chatModel) {
    return [
      `# Auto-configured by opc init (local model detected)`,
      `OPC_LLM_API_KEY=local`,
      `OPC_LLM_BASE_URL=${chatModel.baseUrl}/v1`,
      `OPC_LLM_MODEL=${chatModel.name}`,
      discovery.embedding ? `OPC_EMBEDDING_MODEL=${discovery.embedding.name}` : null,
      discovery.reasoning ? `OPC_REASONING_MODEL=${discovery.reasoning.name}` : null,
    ]
      .filter(Boolean)
      .join('\n') + '\n';
  }
  return `OPC_LLM_API_KEY=your-api-key-here\nOPC_LLM_BASE_URL=https://api.openai.com/v1\nOPC_LLM_MODEL=gpt-4o-mini\n`;
}

// ── Tests ─────────────────────────────────────────────────────

describe('opc init — discovery E2E scenarios', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  // ─── Case 1 ──────────────────────────────────────────────────
  it('Case 1: Ollama + multiple models → auto-select best + write local .env', async () => {
    const ollamaBody = JSON.stringify({
      models: [
        { name: 'qwen3:14b' },
        { name: 'qwen3:7b' },
        { name: 'deepseek-r1:32b' },
        { name: 'nomic-embed-text:latest' },
        { name: 'codestral:22b' },
      ],
    });
    mockHttpRequest(new Map([[11434, { statusCode: 200, body: ollamaBody }]]));

    const providers = await scanLocalProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe('ollama');
    expect(providers[0].models).toHaveLength(5);

    const discovery = selectModels(providers);

    // Best chat = qwen3:14b (largest qwen)
    expect(discovery.chat?.name).toBe('qwen3:14b');
    expect(discovery.chat?.providerName).toBe('ollama');
    expect(discovery.chat?.baseUrl).toBe('http://localhost:11434');

    // Reasoning = deepseek-r1:32b
    expect(discovery.reasoning?.name).toBe('deepseek-r1:32b');

    // Embedding = nomic-embed-text
    expect(discovery.embedding?.name).toBe('nomic-embed-text:latest');

    // Code = codestral:22b
    expect(discovery.code?.name).toBe('codestral:22b');

    // .env content is local — no API key required
    const envContent = buildEnvContent(discovery);
    expect(envContent).toContain('OPC_LLM_API_KEY=local');
    expect(envContent).toContain('OPC_LLM_BASE_URL=http://localhost:11434/v1');
    expect(envContent).toContain('OPC_LLM_MODEL=qwen3:14b');
    expect(envContent).toContain('OPC_EMBEDDING_MODEL=nomic-embed-text:latest');
    expect(envContent).toContain('OPC_REASONING_MODEL=deepseek-r1:32b');
    expect(envContent).not.toContain('your-api-key-here');

    // Verify actual file writing in a temp dir
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opc-e2e-case1-'));
    try {
      fs.writeFileSync(path.join(tmpDir, '.env'), envContent);
      const written = fs.readFileSync(path.join(tmpDir, '.env'), 'utf-8');
      expect(written).toBe(envContent);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── Case 2 ──────────────────────────────────────────────────
  it('Case 2: Ollama running but no models → detected as reachable-empty engine', async () => {
    const emptyBody = JSON.stringify({ models: [] });
    mockHttpRequest(new Map([[11434, { statusCode: 200, body: emptyBody }]]));

    // scanLocalProviders excludes empty providers
    const providers = await scanLocalProviders();
    expect(providers).toHaveLength(0);

    // scanEngineStatuses exposes the empty engine so the CLI can show the right message
    const statuses = await scanEngineStatuses();
    const ollamaStatus = statuses.find((s) => s.name === 'ollama');
    expect(ollamaStatus?.reachable).toBe(true);
    expect(ollamaStatus?.models).toHaveLength(0);

    // Determine emptyEngines list (mirrors cli.ts logic)
    const emptyEngines = statuses
      .filter((s) => s.reachable && s.models.length === 0)
      .map((s) => s.name);
    expect(emptyEngines).toContain('ollama');

    // No discovery → .env falls back to cloud placeholder
    const discovery = selectModels(providers);
    const envContent = buildEnvContent(discovery);
    expect(envContent).toContain('your-api-key-here');
    expect(envContent).not.toContain('OPC_LLM_API_KEY=local');
  });

  // ─── Case 3 ──────────────────────────────────────────────────
  it('Case 3: No local engine reachable → suggest install Ollama or add API key', async () => {
    mockHttpRequest(new Map()); // all ports refuse connection

    const providers = await scanLocalProviders();
    expect(providers).toHaveLength(0);

    const statuses = await scanEngineStatuses();
    const reachable = statuses.filter((s) => s.reachable);
    expect(reachable).toHaveLength(0);

    const emptyEngines = statuses
      .filter((s) => s.reachable && s.models.length === 0)
      .map((s) => s.name);
    expect(emptyEngines).toHaveLength(0);

    // No discovery → cloud fallback .env
    const discovery = selectModels(providers);
    const envContent = buildEnvContent(discovery);
    expect(envContent).toBe(
      'OPC_LLM_API_KEY=your-api-key-here\nOPC_LLM_BASE_URL=https://api.openai.com/v1\nOPC_LLM_MODEL=gpt-4o-mini\n',
    );
  });

  // ─── Case 4 ──────────────────────────────────────────────────
  it('Case 4: Ollama + LM Studio running simultaneously → merged discovery, best model wins', async () => {
    const ollamaBody = JSON.stringify({
      models: [{ name: 'llama3.1:8b' }, { name: 'nomic-embed-text:latest' }],
    });
    const lmStudioBody = JSON.stringify({
      data: [{ id: 'mistral-7b-instruct' }, { id: 'codestral-22b' }],
    });
    mockHttpRequest(
      new Map([
        [11434, { statusCode: 200, body: ollamaBody }],
        [1234, { statusCode: 200, body: lmStudioBody }],
      ]),
    );

    const providers = await scanLocalProviders();
    expect(providers).toHaveLength(2);
    const providerNames = providers.map((p) => p.name);
    expect(providerNames).toContain('ollama');
    expect(providerNames).toContain('lm-studio');

    const discovery = selectModels(providers);

    // Chat: llama3.1:8b (8B) beats mistral-7b-instruct (7B)
    expect(discovery.chat?.name).toBe('llama3.1:8b');
    expect(discovery.chat?.providerName).toBe('ollama');

    // Embedding from Ollama
    expect(discovery.embedding?.name).toBe('nomic-embed-text:latest');

    // Code from LM Studio (codestral-22b)
    expect(discovery.code?.name).toBe('codestral-22b');
    expect(discovery.code?.providerName).toBe('lm-studio');

    const envContent = buildEnvContent(discovery);
    expect(envContent).toContain('OPC_LLM_API_KEY=local');
    expect(envContent).toContain('OPC_LLM_MODEL=llama3.1:8b');
  });

  // ─── Case 5 ──────────────────────────────────────────────────
  it('Case 5: opc chat — configured model not available → warn and switch to alternative', async () => {
    // Ollama is running, but the configured model (llama3:70b) is gone;
    // only qwen3:14b and a code model remain.
    const ollamaBody = JSON.stringify({
      models: [{ name: 'qwen3:14b' }, { name: 'deepseek-coder:6.7b' }],
    });
    mockHttpRequest(new Map([[11434, { statusCode: 200, body: ollamaBody }]]));

    const configuredModel = 'llama3:70b';
    const providers = await scanLocalProviders();

    // Mirrors warnIfLocalModelUnavailable logic from cli.ts
    expect(providers.length).toBeGreaterThan(0);

    const allModels = providers.flatMap((p) => p.models.map((m) => m.name));
    const isPresent = allModels.some(
      (n) => n === configuredModel || n.startsWith(configuredModel + ':'),
    );
    expect(isPresent).toBe(false); // configured model is gone

    // Auto-switch: selectModels picks best available alternative
    const selection = selectModels(providers);
    const fallback = selection.chat ?? selection.code ?? selection.reasoning;

    expect(fallback).toBeDefined();
    expect(fallback!.name).toBe('qwen3:14b'); // best chat model available
    expect(fallback!.providerName).toBe('ollama');

    // The code model is also discoverable
    expect(selection.code?.name).toBe('deepseek-coder:6.7b');
  });
});
