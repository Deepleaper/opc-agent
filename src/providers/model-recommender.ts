// v2 model recommender — RAM-based Ollama model selection + cost/experience strategy picker
import * as os from 'os';
import type { ModelConfig, ModelInfo } from '../core/types';

export interface RecommendOptions {
  config: ModelConfig;
  available: ModelInfo[];
  taskType?: 'chat' | 'embed' | 'code' | 'vision';
}

export interface OllamaRecommendation {
  chatModel: string;
  embedModel: string;
  ramGB: number;
  tier: 'nano' | 'small' | 'medium' | 'large';
}

export function recommendModel(opts: RecommendOptions): ModelInfo | null {
  const { available, config } = opts;
  if (available.length === 0) return null;

  if (config.strategy === 'free') {
    return available.find(m => m.isLocal) ?? available[0];
  }

  if (config.strategy === 'cost') {
    const sorted = [...available].sort((a, b) => {
      const costA = a.costPerMToken?.input ?? (a.isLocal ? 0 : Infinity);
      const costB = b.costPerMToken?.input ?? (b.isLocal ? 0 : Infinity);
      return costA - costB;
    });
    return sorted[0];
  }

  // experience: prefer cloud, highest quality first
  return available[0];
}

export function recommendOllamaModel(): OllamaRecommendation {
  const ramGB = os.totalmem() / (1024 ** 3);

  if (ramGB < 8) {
    return { chatModel: 'qwen2.5:1.5b', embedModel: 'nomic-embed-text', ramGB, tier: 'nano' };
  }
  if (ramGB < 16) {
    return { chatModel: 'llama3.2:3b', embedModel: 'nomic-embed-text', ramGB, tier: 'small' };
  }
  if (ramGB < 32) {
    return { chatModel: 'llama3.1:8b', embedModel: 'nomic-embed-text', ramGB, tier: 'medium' };
  }
  return { chatModel: 'llama3.3:70b', embedModel: 'nomic-embed-text', ramGB, tier: 'large' };
}
