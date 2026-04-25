import * as http from 'http';

export interface LocalModel {
  name: string;
  sizeB: number; // parameter count in billions, 0 if unknown
}

export interface LocalProvider {
  name: 'ollama' | 'lm-studio' | 'llama.cpp' | 'vllm' | 'jan';
  url: string;
  models: LocalModel[];
}

interface ProbeTarget {
  name: LocalProvider['name'];
  port: number;
  path: string;
  isOllama: boolean;
}

const PROBE_TARGETS: ProbeTarget[] = [
  { name: 'ollama',    port: 11434, path: '/api/tags',   isOllama: true  },
  { name: 'lm-studio', port: 1234,  path: '/v1/models',  isOllama: false },
  { name: 'vllm',      port: 8000,  path: '/v1/models',  isOllama: false },
  { name: 'llama.cpp', port: 8080,  path: '/v1/models',  isOllama: false },
  { name: 'jan',       port: 1337,  path: '/v1/models',  isOllama: false },
];

const PROBE_TIMEOUT_MS = 2000;

function extractSizeB(name: string): number {
  // Matches patterns like "14b", "7b", "70b", "671b", "0.5b" in model names
  const m = name.match(/:(\d+(?:\.\d+)?)b\b/i) ?? name.match(/[-_](\d+(?:\.\d+)?)b\b/i);
  return m ? parseFloat(m[1]) : 0;
}

function httpGet(port: number, path: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'GET', headers: { Accept: 'application/json' } },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          res.resume();
          resolve(null);
          return;
        }
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString()));
        res.on('end', () => resolve(data));
      },
    );
    req.on('error', () => resolve(null));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

function parseOllamaModels(body: string): LocalModel[] {
  try {
    const parsed = JSON.parse(body) as { models?: { name: string }[] };
    return (parsed.models ?? []).map((m) => {
      // Ollama model names must include tag for API calls (e.g. "qwen2.5:7b" not "qwen2.5")
      const name = m.name.includes(':') ? m.name : `${m.name}:latest`;
      return { name, sizeB: extractSizeB(name) };
    });
  } catch {
    return [];
  }
}

function parseOpenAIModels(body: string): LocalModel[] {
  try {
    const parsed = JSON.parse(body) as { data?: { id: string }[] };
    return (parsed.data ?? []).map((m) => ({ name: m.id, sizeB: extractSizeB(m.id) }));
  } catch {
    return [];
  }
}

export interface EngineStatus {
  name: LocalProvider['name'];
  url: string;
  reachable: boolean;
  models: LocalModel[];
}

async function probeEngineStatus(target: ProbeTarget): Promise<EngineStatus> {
  const body = await httpGet(target.port, target.path, PROBE_TIMEOUT_MS);
  const url = `http://localhost:${target.port}`;
  if (body === null) return { name: target.name, url, reachable: false, models: [] };
  const models = target.isOllama ? parseOllamaModels(body) : parseOpenAIModels(body);
  return { name: target.name, url, reachable: true, models };
}

export async function scanEngineStatuses(): Promise<EngineStatus[]> {
  return Promise.all(PROBE_TARGETS.map(probeEngineStatus));
}

export async function scanLocalProviders(): Promise<LocalProvider[]> {
  const statuses = await scanEngineStatuses();
  return statuses
    .filter((s) => s.reachable && s.models.length > 0)
    .map((s) => ({ name: s.name, url: s.url, models: s.models }));
}
