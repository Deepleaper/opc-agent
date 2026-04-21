import { describe, it, expect } from 'vitest';
import { ModelRouter } from '../../src/providers/router';
import { OllamaProvider } from '../../src/providers/ollama';
import { AgentKitsProvider } from '../../src/providers/agentkits';
import { OpenAICompatProvider } from '../../src/providers/openai-compat';
import type { ModelConfig } from '../../src/core/types';

function makeConfig(
  strategy: ModelConfig['strategy'],
  override?: ModelConfig['override'],
): ModelConfig {
  return {
    provider: 'agentkits',
    strategy,
    apiKey: 'test-key',
    override,
    local: { provider: 'ollama', model: 'auto', embeddingModel: 'auto' },
    fallback: 'ollama',
  };
}

const ALL_SCENES = ['task', 'l1', 'l2', 'l3', 'l4', 'embedding'] as const;

describe('ModelRouter — 3 strategies × 6 scenes', () => {
  // ── strategy: free — all scenes must use local Ollama ────────────────────
  describe('strategy=free', () => {
    const router = new ModelRouter(makeConfig('free'));

    for (const scene of ALL_SCENES) {
      it(`scene=${scene} → OllamaProvider`, () => {
        expect(router.getProvider(scene)).toBeInstanceOf(OllamaProvider);
      });
    }
  });

  // ── strategy: experience — local for l1/l4/embedding, cloud for l2/l3/task
  describe('strategy=experience', () => {
    const router = new ModelRouter(makeConfig('experience'));

    it('scene=embedding → OllamaProvider', () => {
      expect(router.getProvider('embedding')).toBeInstanceOf(OllamaProvider);
    });
    it('scene=l1 → OllamaProvider', () => {
      expect(router.getProvider('l1')).toBeInstanceOf(OllamaProvider);
    });
    it('scene=l4 → OllamaProvider', () => {
      expect(router.getProvider('l4')).toBeInstanceOf(OllamaProvider);
    });
    it('scene=task → AgentKitsProvider', () => {
      expect(router.getProvider('task')).toBeInstanceOf(AgentKitsProvider);
    });
    it('scene=l2 → AgentKitsProvider', () => {
      expect(router.getProvider('l2')).toBeInstanceOf(AgentKitsProvider);
    });
    it('scene=l3 → AgentKitsProvider', () => {
      expect(router.getProvider('l3')).toBeInstanceOf(AgentKitsProvider);
    });
  });

  // ── strategy: cost — same routing as experience (no override)
  describe('strategy=cost', () => {
    const router = new ModelRouter(makeConfig('cost'));

    it('scene=embedding → OllamaProvider', () => {
      expect(router.getProvider('embedding')).toBeInstanceOf(OllamaProvider);
    });
    it('scene=l1 → OllamaProvider', () => {
      expect(router.getProvider('l1')).toBeInstanceOf(OllamaProvider);
    });
    it('scene=l4 → OllamaProvider', () => {
      expect(router.getProvider('l4')).toBeInstanceOf(OllamaProvider);
    });
    it('scene=task → AgentKitsProvider', () => {
      expect(router.getProvider('task')).toBeInstanceOf(AgentKitsProvider);
    });
    it('scene=l2 → AgentKitsProvider', () => {
      expect(router.getProvider('l2')).toBeInstanceOf(AgentKitsProvider);
    });
    it('scene=l3 → AgentKitsProvider', () => {
      expect(router.getProvider('l3')).toBeInstanceOf(AgentKitsProvider);
    });
  });

  // ── override provider — cloud scenes use OpenAICompatProvider ────────────
  describe('override set', () => {
    const override = { provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o' };
    const router = new ModelRouter(makeConfig('experience', override));

    it('scene=task → OpenAICompatProvider (override)', () => {
      expect(router.getProvider('task')).toBeInstanceOf(OpenAICompatProvider);
    });
    it('scene=l2 → OpenAICompatProvider (override)', () => {
      expect(router.getProvider('l2')).toBeInstanceOf(OpenAICompatProvider);
    });
    it('scene=l1 → OllamaProvider even with override', () => {
      expect(router.getProvider('l1')).toBeInstanceOf(OllamaProvider);
    });
    it('scene=embedding → OllamaProvider even with override', () => {
      expect(router.getProvider('embedding')).toBeInstanceOf(OllamaProvider);
    });
  });
});
