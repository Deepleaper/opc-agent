// v2 provider router — dual-track (local/cloud) routing by scene and strategy
import type { ModelConfig, ModelProvider } from '../core/types';
import { OllamaProvider } from './ollama';
import { AgentKitsProvider } from './agentkits';
import { OpenAICompatProvider } from './openai-compat';

export type Scene = 'task' | 'l1' | 'l2' | 'l3' | 'l4' | 'embedding';
export type Strategy = 'experience' | 'cost' | 'free';

export class ModelRouter {
  constructor(private config: ModelConfig) {}

  getProvider(scene: Scene): ModelProvider {
    const strategy = this.config.strategy;
    if (scene === 'embedding') return this.getOllama();
    if (strategy === 'free') return this.getOllama();
    if (scene === 'l1' || scene === 'l4') return this.getOllama(); // local track
    if (scene === 'l2' || scene === 'l3') return this.getCloud(); // cloud track
    if (scene === 'task') return this.getCloud();
    return this.getOllama();
  }

  private getOllama(): ModelProvider {
    const { local } = this.config;
    return new OllamaProvider({
      model: local?.model === 'auto' ? undefined : local?.model,
      embeddingModel: local?.embeddingModel === 'auto' ? undefined : local?.embeddingModel,
    });
  }

  private getCloud(): ModelProvider {
    if (this.config.override) {
      return new OpenAICompatProvider({
        apiKey: this.config.override.apiKey,
        provider: this.config.override.provider,
        defaultModel: this.config.override.model,
      });
    }
    return new AgentKitsProvider({
      apiKey: this.config.apiKey,
      strategy: this.config.strategy === 'free' ? 'experience' : this.config.strategy,
    });
  }
}
