import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageGenerator } from '../src/tools/image-generator';

describe('ImageGenerator', () => {
  describe('detectProvider', () => {
    it('returns null when no keys configured', () => {
      const gen = new ImageGenerator({});
      expect(gen.detectProvider()).toBeNull();
    });

    it('detects dalle when openai key set', () => {
      const gen = new ImageGenerator({ openaiApiKey: 'sk-test' });
      expect(gen.detectProvider()).toBe('dalle');
    });

    it('detects stable-diffusion when SD URL set', () => {
      const gen = new ImageGenerator({ sdApiUrl: 'http://localhost:7860' });
      expect(gen.detectProvider()).toBe('stable-diffusion');
    });

    it('detects replicate when token set', () => {
      const gen = new ImageGenerator({ replicateApiKey: 'r8_test' });
      expect(gen.detectProvider()).toBe('replicate');
    });

    it('prefers dalle over others', () => {
      const gen = new ImageGenerator({ openaiApiKey: 'sk-test', sdApiUrl: 'http://localhost:7860' });
      expect(gen.detectProvider()).toBe('dalle');
    });
  });

  describe('getStatus', () => {
    it('returns provider status', () => {
      const gen = new ImageGenerator({ openaiApiKey: 'sk-test' });
      const status = gen.getStatus();
      expect(status.configured).toBe(true);
      expect(status.providers).toHaveLength(3);
      expect(status.providers.find(p => p.name === 'dalle')?.configured).toBe(true);
    });

    it('shows unconfigured when no keys', () => {
      const gen = new ImageGenerator({});
      const status = gen.getStatus();
      expect(status.configured).toBe(false);
    });
  });

  describe('generate', () => {
    it('returns error when no provider configured', async () => {
      const gen = new ImageGenerator({});
      const result = await gen.generate('a cat');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No image generation provider configured');
    });

    it('returns error for unknown provider', async () => {
      const gen = new ImageGenerator({});
      const result = await gen.generate('a cat', { provider: 'unknown' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown provider');
    });

    it('returns error when dalle key missing', async () => {
      const gen = new ImageGenerator({});
      const result = await gen.generate('a cat', { provider: 'dalle' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('OPENAI_API_KEY');
    });

    it('returns error when SD URL missing', async () => {
      const gen = new ImageGenerator({});
      const result = await gen.generate('a cat', { provider: 'stable-diffusion' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('SD_API_URL');
    });

    it('returns error when replicate key missing', async () => {
      const gen = new ImageGenerator({});
      const result = await gen.generate('a cat', { provider: 'replicate' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('REPLICATE_API_TOKEN');
    });
  });
});
