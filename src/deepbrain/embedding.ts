const OLLAMA_BASE = 'http://localhost:11434';
const PREFERRED_MODELS = ['nomic-embed-text', 'bge-m3'];
const LRU_MAX = 100;

class LruCache {
  private map = new Map<string, number[]>();

  constructor(private maxSize: number) {}

  get(key: string): number[] | null {
    const val = this.map.get(key);
    if (val === undefined) return null;
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: string, value: number[]): void {
    if (this.map.has(key)) this.map.delete(key);
    if (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, value);
  }
}

const cache = new LruCache(LRU_MAX);
let detectedModel: string | null | undefined = undefined; // undefined = not yet checked

async function detectModel(): Promise<string | null> {
  if (detectedModel !== undefined) return detectedModel;
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!res.ok) { detectedModel = null; return null; }
    const data = await res.json() as { models?: Array<{ name: string }> };
    const names = (data.models ?? []).map((m) => m.name);
    for (const preferred of PREFERRED_MODELS) {
      if (names.some((n) => n === preferred || n.startsWith(preferred + ':'))) {
        detectedModel = preferred;
        return detectedModel;
      }
    }
    detectedModel = names[0] ?? null;
    return detectedModel;
  } catch {
    detectedModel = null;
    return null;
  }
}

export class Embedder {
  private model: string | null | undefined;

  constructor(model?: string) {
    this.model = model ?? undefined;
  }

  async embed(text: string): Promise<number[] | null> {
    if (this.model === undefined) {
      this.model = await detectModel();
    }
    if (!this.model) return null;

    const key = `${this.model}\x00${text}`;
    const cached = cache.get(key);
    if (cached) return cached;

    try {
      const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, input: text }),
      });
      if (!res.ok) return null;
      const data = await res.json() as { embeddings?: number[][] };
      const vec = data.embeddings?.[0];
      if (!vec || vec.length === 0) return null;
      cache.set(key, vec);
      return vec;
    } catch {
      return null;
    }
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
