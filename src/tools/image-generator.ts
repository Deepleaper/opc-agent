/**
 * Image Generator — multi-backend image generation tool.
 * Supports DALL·E (OpenAI), Stable Diffusion (local), and Replicate.
 */

export interface ImageGenConfig {
  provider?: 'dalle' | 'stable-diffusion' | 'replicate';
  openaiApiKey?: string;
  replicateApiKey?: string;
  sdApiUrl?: string;
  defaultModel?: string;
  defaultSize?: string;
}

export interface ImageGenResult {
  success: boolean;
  url?: string;
  base64?: string;
  error?: string;
  provider: string;
}

export class ImageGenerator {
  private config: ImageGenConfig;

  constructor(config?: ImageGenConfig) {
    this.config = {
      provider: config?.provider,
      openaiApiKey: config?.openaiApiKey || process.env.OPENAI_API_KEY,
      replicateApiKey: config?.replicateApiKey || process.env.REPLICATE_API_TOKEN,
      sdApiUrl: config?.sdApiUrl || process.env.SD_API_URL,
      defaultModel: config?.defaultModel || 'dall-e-3',
      defaultSize: config?.defaultSize || '1024x1024',
    };
  }

  /** Auto-detect best available provider */
  detectProvider(): string | null {
    if (this.config.openaiApiKey) return 'dalle';
    if (this.config.sdApiUrl) return 'stable-diffusion';
    if (this.config.replicateApiKey) return 'replicate';
    return null;
  }

  /** Get configuration status for the settings UI */
  getStatus(): { configured: boolean; providers: { name: string; configured: boolean }[] } {
    return {
      configured: !!this.detectProvider(),
      providers: [
        { name: 'dalle', configured: !!this.config.openaiApiKey },
        { name: 'stable-diffusion', configured: !!this.config.sdApiUrl },
        { name: 'replicate', configured: !!this.config.replicateApiKey },
      ],
    };
  }

  async generate(prompt: string, options?: { provider?: string; size?: string; model?: string }): Promise<ImageGenResult> {
    const provider = options?.provider || this.config.provider || this.detectProvider();
    if (!provider) {
      return { success: false, error: 'No image generation provider configured. Please set OPENAI_API_KEY, SD_API_URL, or REPLICATE_API_TOKEN.', provider: 'none' };
    }

    switch (provider) {
      case 'dalle': return this.generateDalle(prompt, options);
      case 'stable-diffusion': return this.generateSD(prompt, options);
      case 'replicate': return this.generateReplicate(prompt, options);
      default: return { success: false, error: `Unknown provider: ${provider}`, provider };
    }
  }

  private async generateDalle(prompt: string, options?: { size?: string; model?: string }): Promise<ImageGenResult> {
    const apiKey = this.config.openaiApiKey;
    if (!apiKey) return { success: false, error: 'OPENAI_API_KEY not configured', provider: 'dalle' };

    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options?.model || this.config.defaultModel || 'dall-e-3',
          prompt,
          size: options?.size || this.config.defaultSize || '1024x1024',
          n: 1,
        }),
      });
      const data = await res.json() as { data?: Array<{ url: string }>; error?: { message: string } };
      if (data.error) return { success: false, error: data.error.message, provider: 'dalle' };
      const url = data.data?.[0]?.url;
      return url ? { success: true, url, provider: 'dalle' } : { success: false, error: 'No image returned', provider: 'dalle' };
    } catch (err) {
      return { success: false, error: (err as Error).message, provider: 'dalle' };
    }
  }

  private async generateSD(prompt: string, options?: { size?: string }): Promise<ImageGenResult> {
    const apiUrl = this.config.sdApiUrl;
    if (!apiUrl) return { success: false, error: 'SD_API_URL not configured', provider: 'stable-diffusion' };

    try {
      const [w, h] = (options?.size || '1024x1024').split('x').map(Number);
      const res = await fetch(`${apiUrl}/sdapi/v1/txt2img`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, width: w || 1024, height: h || 1024 }),
      });
      const data = await res.json() as { images?: string[] };
      if (data.images?.length) {
        return { success: true, base64: data.images[0], provider: 'stable-diffusion' };
      }
      return { success: false, error: 'No image generated', provider: 'stable-diffusion' };
    } catch (err) {
      return { success: false, error: (err as Error).message, provider: 'stable-diffusion' };
    }
  }

  private async generateReplicate(prompt: string, _options?: { model?: string }): Promise<ImageGenResult> {
    const apiKey = this.config.replicateApiKey;
    if (!apiKey) return { success: false, error: 'REPLICATE_API_TOKEN not configured', provider: 'replicate' };

    try {
      const res = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
          input: { prompt },
        }),
      });
      const prediction = await res.json() as { id: string; urls?: { get: string }; error?: string };
      if (prediction.error) return { success: false, error: prediction.error, provider: 'replicate' };

      // Poll for completion (max 60s)
      const getUrl = prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await fetch(getUrl, { headers: { 'Authorization': `Token ${apiKey}` } });
        const result = await poll.json() as { status: string; output?: string[]; error?: string };
        if (result.status === 'succeeded' && result.output?.length) {
          return { success: true, url: result.output[0], provider: 'replicate' };
        }
        if (result.status === 'failed') {
          return { success: false, error: result.error || 'Generation failed', provider: 'replicate' };
        }
      }
      return { success: false, error: 'Timeout waiting for image generation', provider: 'replicate' };
    } catch (err) {
      return { success: false, error: (err as Error).message, provider: 'replicate' };
    }
  }
}
