import type { LocalModel, LocalProvider } from './scanner';

export type ModelCategory = 'chat' | 'reasoning' | 'embedding' | 'code';

export interface SelectedModel {
  name: string;
  providerName: LocalProvider['name'];
  baseUrl: string;
  category: ModelCategory;
  sizeB: number;
}

export interface ModelSelection {
  chat?: SelectedModel;
  reasoning?: SelectedModel;
  embedding?: SelectedModel;
  code?: SelectedModel;
}

const PATTERNS: Record<ModelCategory, RegExp[]> = {
  // Check embedding first — most specific, avoids false matches
  embedding: [
    /nomic-embed/i,
    /bge[-_]/i,
    /mxbai-embed/i,
    /all-minilm/i,
    /text-embedding/i,
    /[-_:]embed/i,
  ],
  // Reasoning models — specific names before broad "deepseek" match
  reasoning: [
    /deepseek-r1/i,
    /deepseek-r\d/i,
    /qwq/i,
    /\bo1[-_:]/i,
  ],
  // Code models
  code: [
    /codestral/i,
    /starcoder/i,
    /deepseek-coder/i,
    /[-_:]coder/i,
    /coder[-_:]/i,
    /\bcode[-_:]/i,
  ],
  // Chat — broad catch-all for conversational models
  chat: [
    /qwen/i,
    /llama/i,
    /mistral/i,
    /gemma/i,
    /phi/i,
    /yi[-_:]/i,
    /vicuna/i,
    /falcon/i,
    /internlm/i,
    /baichuan/i,
    /deepseek/i,
  ],
};

const CATEGORY_ORDER: ModelCategory[] = ['embedding', 'reasoning', 'code', 'chat'];

function classifyModel(name: string): ModelCategory | null {
  for (const category of CATEGORY_ORDER) {
    if (PATTERNS[category].some((re) => re.test(name))) {
      return category;
    }
  }
  return null;
}

function bestModel(
  candidates: { model: LocalModel; provider: LocalProvider }[],
): { model: LocalModel; provider: LocalProvider } {
  return candidates.reduce((best, current) =>
    current.model.sizeB > best.model.sizeB ? current : best,
  );
}

export function selectModels(providers: LocalProvider[]): ModelSelection {
  const buckets: Record<ModelCategory, { model: LocalModel; provider: LocalProvider }[]> = {
    chat: [],
    reasoning: [],
    embedding: [],
    code: [],
  };

  for (const provider of providers) {
    for (const model of provider.models) {
      const category = classifyModel(model.name);
      if (category) {
        buckets[category].push({ model, provider });
      }
    }
  }

  const selection: ModelSelection = {};

  for (const category of CATEGORY_ORDER) {
    const candidates = buckets[category];
    if (candidates.length === 0) continue;

    const { model, provider } = bestModel(candidates);
    selection[category] = {
      name: model.name,
      providerName: provider.name,
      baseUrl: provider.url,
      category,
      sizeB: model.sizeB,
    };
  }

  return selection;
}
