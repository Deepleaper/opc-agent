import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────

export interface ImageInput {
  type: 'base64' | 'url' | 'file';
  data: string;
  mimeType?: string;
}

export interface VisionResult {
  description: string;
  text_content?: string;
  objects?: string[];
}

// ─── MIME detection from magic bytes ─────────────────────────

const MAGIC_BYTES: Array<{ bytes: number[]; mime: string }> = [
  { bytes: [0x89, 0x50, 0x4E, 0x47], mime: 'image/png' },
  { bytes: [0xFF, 0xD8, 0xFF], mime: 'image/jpeg' },
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif' },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' }, // RIFF header (WebP)
];

export function detectMimeType(buffer: Buffer): string {
  for (const { bytes, mime } of MAGIC_BYTES) {
    if (bytes.every((b, i) => buffer[i] === b)) {
      return mime;
    }
  }
  return 'application/octet-stream';
}

// ─── VisionManager ───────────────────────────────────────────

export interface VisionManagerConfig {
  model?: string;
  apiKey?: string;
  baseURL?: string;
  maxImageSize?: number; // bytes, default 20MB
}

export class VisionManager {
  private config: VisionManagerConfig;

  constructor(config: VisionManagerConfig = {}) {
    this.config = {
      model: config.model ?? 'gpt-4o',
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY ?? '',
      baseURL: config.baseURL ?? 'https://api.openai.com/v1',
      maxImageSize: config.maxImageSize ?? 20 * 1024 * 1024,
    };
  }

  /**
   * Load image data as base64, detecting MIME type.
   */
  async loadImage(input: ImageInput): Promise<{ base64: string; mimeType: string }> {
    if (input.type === 'base64') {
      const buf = Buffer.from(input.data, 'base64');
      return { base64: input.data, mimeType: input.mimeType ?? detectMimeType(buf) };
    }
    if (input.type === 'file') {
      const buf = fs.readFileSync(input.data);
      if (buf.length > this.config.maxImageSize!) {
        throw new Error(`Image exceeds max size: ${buf.length} > ${this.config.maxImageSize}`);
      }
      return { base64: buf.toString('base64'), mimeType: input.mimeType ?? detectMimeType(buf) };
    }
    // URL — return as-is for API
    return { base64: '', mimeType: input.mimeType ?? 'image/jpeg' };
  }

  /**
   * Prepare messages in OpenAI multimodal format.
   */
  prepareMessage(images: ImageInput[], text: string): Array<Record<string, unknown>> {
    const content: Array<Record<string, unknown>> = [];
    if (text) {
      content.push({ type: 'text', text });
    }
    for (const img of images) {
      if (img.type === 'url') {
        content.push({
          type: 'image_url',
          image_url: { url: img.data },
        });
      } else {
        // base64 or file — will need to be loaded first
        const mime = img.mimeType ?? 'image/jpeg';
        const data = img.type === 'base64' ? img.data : fs.readFileSync(img.data).toString('base64');
        content.push({
          type: 'image_url',
          image_url: { url: `data:${mime};base64,${data}` },
        });
      }
    }
    return [{ role: 'user', content }];
  }

  /**
   * Analyze an image with optional prompt.
   */
  async analyze(image: ImageInput, prompt?: string): Promise<VisionResult> {
    const messages = this.prepareMessage([image], prompt ?? 'Describe this image in detail.');

    if (!this.config.apiKey) {
      throw new Error('Vision API key not configured. Set OPENAI_API_KEY or pass apiKey in config.');
    }

    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const text = data.choices?.[0]?.message?.content ?? '';

    return {
      description: text,
      text_content: undefined,
      objects: [],
    };
  }

  /**
   * Extract text (OCR) from an image.
   */
  async extractText(image: ImageInput): Promise<string> {
    const result = await this.analyze(image, 'Extract all visible text from this image. Return only the text, nothing else.');
    return result.description;
  }

  /**
   * Compare multiple images.
   */
  async compareImages(images: ImageInput[], prompt?: string): Promise<string> {
    if (images.length < 2) throw new Error('Need at least 2 images to compare');

    const messages = this.prepareMessage(images, prompt ?? 'Compare these images and describe the differences.');

    if (!this.config.apiKey) {
      throw new Error('Vision API key not configured.');
    }

    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content ?? '';
  }
}
