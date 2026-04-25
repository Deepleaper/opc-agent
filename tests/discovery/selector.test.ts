import { describe, it, expect } from 'vitest';
import { selectModels } from '../../src/discovery/selector';
import type { LocalProvider } from '../../src/discovery/scanner';

// ── Fixture helpers ───────────────────────────────────────────

function ollamaProvider(models: { name: string; sizeB?: number }[]): LocalProvider {
  return {
    name: 'ollama',
    url: 'http://localhost:11434',
    models: models.map((m) => ({ name: m.name, sizeB: m.sizeB ?? 0 })),
  };
}

// ── Tests ─────────────────────────────────────────────────────

describe('selectModels', () => {
  it('returns empty selection when no providers given', () => {
    const result = selectModels([]);
    expect(result).toEqual({});
  });

  it('classifies Qwen as a chat model', () => {
    const provider = ollamaProvider([{ name: 'qwen3:14b', sizeB: 14 }]);
    const result = selectModels([provider]);
    expect(result.chat?.name).toBe('qwen3:14b');
    expect(result.chat?.category).toBe('chat');
  });

  it('classifies Llama as a chat model', () => {
    const provider = ollamaProvider([{ name: 'llama3.1:8b', sizeB: 8 }]);
    const result = selectModels([provider]);
    expect(result.chat?.name).toBe('llama3.1:8b');
  });

  it('classifies deepseek-r1 as reasoning', () => {
    const provider = ollamaProvider([{ name: 'deepseek-r1:32b', sizeB: 32 }]);
    const result = selectModels([provider]);
    expect(result.reasoning?.name).toBe('deepseek-r1:32b');
    expect(result.reasoning?.category).toBe('reasoning');
    // Should NOT also appear as chat
    expect(result.chat).toBeUndefined();
  });

  it('classifies qwq as reasoning', () => {
    const provider = ollamaProvider([{ name: 'qwq:32b', sizeB: 32 }]);
    const result = selectModels([provider]);
    expect(result.reasoning?.name).toBe('qwq:32b');
  });

  it('classifies nomic-embed-text as embedding', () => {
    const provider = ollamaProvider([{ name: 'nomic-embed-text:latest', sizeB: 0 }]);
    const result = selectModels([provider]);
    expect(result.embedding?.name).toBe('nomic-embed-text:latest');
    expect(result.embedding?.category).toBe('embedding');
  });

  it('classifies bge models as embedding', () => {
    const provider = ollamaProvider([{ name: 'bge-m3:latest', sizeB: 0 }]);
    const result = selectModels([provider]);
    expect(result.embedding?.name).toBe('bge-m3:latest');
  });

  it('classifies codestral as code', () => {
    const provider = ollamaProvider([{ name: 'codestral:22b', sizeB: 22 }]);
    const result = selectModels([provider]);
    expect(result.code?.name).toBe('codestral:22b');
    expect(result.code?.category).toBe('code');
  });

  it('classifies deepseek-coder as code, not chat', () => {
    const provider = ollamaProvider([{ name: 'deepseek-coder:6.7b', sizeB: 6.7 }]);
    const result = selectModels([provider]);
    expect(result.code?.name).toBe('deepseek-coder:6.7b');
    expect(result.chat).toBeUndefined();
  });

  it('selects largest model within the same category', () => {
    const provider = ollamaProvider([
      { name: 'qwen3:7b', sizeB: 7 },
      { name: 'qwen3:14b', sizeB: 14 },
      { name: 'qwen3:3b', sizeB: 3 },
    ]);
    const result = selectModels([provider]);
    expect(result.chat?.name).toBe('qwen3:14b');
  });

  it('correctly fills all four categories when all are present', () => {
    const provider = ollamaProvider([
      { name: 'qwen3:14b', sizeB: 14 },
      { name: 'deepseek-r1:32b', sizeB: 32 },
      { name: 'nomic-embed-text:latest', sizeB: 0 },
      { name: 'codestral:22b', sizeB: 22 },
    ]);
    const result = selectModels([provider]);
    expect(result.chat?.name).toBe('qwen3:14b');
    expect(result.reasoning?.name).toBe('deepseek-r1:32b');
    expect(result.embedding?.name).toBe('nomic-embed-text:latest');
    expect(result.code?.name).toBe('codestral:22b');
  });

  it('picks best model across multiple providers', () => {
    const ollama = ollamaProvider([{ name: 'llama3:8b', sizeB: 8 }]);
    const lmStudio: LocalProvider = {
      name: 'lm-studio',
      url: 'http://localhost:1234',
      models: [{ name: 'mistral-7b', sizeB: 7 }],
    };
    const result = selectModels([ollama, lmStudio]);
    // llama3:8b wins over mistral-7b (8 > 7)
    expect(result.chat?.name).toBe('llama3:8b');
    expect(result.chat?.providerName).toBe('ollama');
  });

  it('includes provider URL in selected model', () => {
    const provider = ollamaProvider([{ name: 'qwen3:14b', sizeB: 14 }]);
    const result = selectModels([provider]);
    expect(result.chat?.baseUrl).toBe('http://localhost:11434');
  });

  it('models with unknown size (0) still get selected when the only option', () => {
    const provider = ollamaProvider([{ name: 'gemma3:latest', sizeB: 0 }]);
    const result = selectModels([provider]);
    expect(result.chat?.name).toBe('gemma3:latest');
  });

  it('unrecognized model names are ignored', () => {
    const provider = ollamaProvider([{ name: 'unknown-xyz-model:v1', sizeB: 5 }]);
    const result = selectModels([provider]);
    expect(result.chat).toBeUndefined();
    expect(result.reasoning).toBeUndefined();
    expect(result.embedding).toBeUndefined();
    expect(result.code).toBeUndefined();
  });
});
