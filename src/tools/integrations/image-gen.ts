import type { MCPTool, MCPToolResult } from '../mcp';

export const ImageGenerationTool: MCPTool = {
  name: 'image-gen',
  description: 'Generate images via DALL-E or StableDiffusion API. Requires OPENAI_API_KEY or SD_API_URL env var.',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Image generation prompt' },
      provider: { type: 'string', enum: ['dalle', 'stable-diffusion'], description: 'Provider (auto-detects)' },
      size: { type: 'string', description: 'Image size (default: 1024x1024)' },
      model: { type: 'string', description: 'Model name (default: dall-e-3)' },
    },
    required: ['prompt'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const prompt = String(input.prompt ?? '');
    if (!prompt) return { content: 'Error: prompt required', isError: true };

    const provider = String(input.provider ?? '');

    try {
      if (provider === 'stable-diffusion' || process.env.SD_API_URL) {
        const url = process.env.SD_API_URL;
        if (!url) return { content: 'Error: SD_API_URL required', isError: true };
        const res = await fetch(`${url}/sdapi/v1/txt2img`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, width: 1024, height: 1024 }),
        });
        const data = await res.json() as { images?: string[] };
        return { content: `Generated ${data.images?.length ?? 0} image(s)`, metadata: { images: data.images } };
      }

      // Default: DALL-E
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return { content: 'Error: OPENAI_API_KEY or SD_API_URL required', isError: true };
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: String(input.model ?? 'dall-e-3'),
          prompt,
          size: String(input.size ?? '1024x1024'),
          n: 1,
        }),
      });
      const data = await res.json() as { data?: Array<{ url: string }> };
      const url = data.data?.[0]?.url;
      return { content: url ? `Image generated: ${url}` : 'Error generating image', metadata: { url } };
    } catch (err) {
      return { content: `Image gen error: ${(err as Error).message}`, isError: true };
    }
  },
};
