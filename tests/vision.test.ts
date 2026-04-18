import { describe, it, expect } from 'vitest';
import { VisionManager, detectMimeType } from '../src/core/vision';
import type { ImageInput, VisionResult } from '../src/core/vision';

describe('VisionManager', () => {
  it('should create VisionManager with defaults', () => {
    const vm = new VisionManager();
    expect(vm).toBeDefined();
  });

  it('should create VisionManager with custom config', () => {
    const vm = new VisionManager({ model: 'gpt-4o-mini', maxImageSize: 5 * 1024 * 1024 });
    expect(vm).toBeDefined();
  });

  it('should detect PNG mime type', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    expect(detectMimeType(buf)).toBe('image/png');
  });

  it('should detect JPEG mime type', () => {
    const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
    expect(detectMimeType(buf)).toBe('image/jpeg');
  });

  it('should detect GIF mime type', () => {
    const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(detectMimeType(buf)).toBe('image/gif');
  });

  it('should detect WebP mime type', () => {
    const buf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);
    expect(detectMimeType(buf)).toBe('image/webp');
  });

  it('should return octet-stream for unknown', () => {
    const buf = Buffer.from([0x00, 0x01, 0x02]);
    expect(detectMimeType(buf)).toBe('application/octet-stream');
  });

  it('should prepare multimodal message with URL images', () => {
    const vm = new VisionManager();
    const images: ImageInput[] = [{ type: 'url', data: 'https://example.com/img.png' }];
    const msgs = vm.prepareMessage(images, 'Describe this');
    expect(msgs).toHaveLength(1);
    expect((msgs[0] as any).content).toHaveLength(2);
    expect((msgs[0] as any).content[0].type).toBe('text');
    expect((msgs[0] as any).content[1].type).toBe('image_url');
  });

  it('should throw on analyze without API key', async () => {
    const vm = new VisionManager({ apiKey: '' });
    const input: ImageInput = { type: 'url', data: 'https://example.com/img.png' };
    await expect(vm.analyze(input)).rejects.toThrow('Vision API key not configured');
  });

  it('should throw on compareImages with less than 2 images', async () => {
    const vm = new VisionManager({ apiKey: 'test' });
    await expect(vm.compareImages([{ type: 'url', data: 'https://example.com/1.png' }])).rejects.toThrow('at least 2');
  });
});
