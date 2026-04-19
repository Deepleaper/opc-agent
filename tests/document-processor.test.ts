import { describe, it, expect } from 'vitest';
import { DocumentProcessor } from '../src/tools/document-processor';

describe('DocumentProcessor', () => {
  const processor = new DocumentProcessor();

  it('should process plain text', async () => {
    const text = 'Hello world. This is a test document.\n\nSecond paragraph here.';
    const buffer = Buffer.from(text, 'utf-8');
    const doc = await processor.process(buffer, 'test.txt');

    expect(doc.filename).toBe('test.txt');
    expect(doc.format).toBe('txt');
    expect(doc.chunks.length).toBeGreaterThan(0);
    expect(doc.chunks[0].content).toContain('Hello world');
    expect(doc.chunks[0].metadata.source).toBe('test.txt');
  });

  it('should process markdown with headings', async () => {
    const md = `# Title\n\nFirst section content.\n\n## Section Two\n\nSecond section content.\n\n## Section Three\n\nThird section.`;
    const buffer = Buffer.from(md, 'utf-8');
    const doc = await processor.process(buffer, 'test.md');

    expect(doc.format).toBe('md');
    expect(doc.chunks.length).toBeGreaterThan(0);
  });

  it('should process CSV', async () => {
    const csv = 'Name,Age,City\nAlice,30,Beijing\nBob,25,Shanghai';
    const buffer = Buffer.from(csv, 'utf-8');
    const doc = await processor.process(buffer, 'data.csv');

    expect(doc.format).toBe('csv');
    expect(doc.chunks.length).toBeGreaterThan(0);
    expect(doc.chunks[0].content).toContain('Alice');
  });

  it('should process JSON array', async () => {
    const json = JSON.stringify([{ name: 'Alice', role: 'engineer' }, { name: 'Bob', role: 'designer' }]);
    const buffer = Buffer.from(json, 'utf-8');
    const doc = await processor.process(buffer, 'data.json');

    expect(doc.format).toBe('json');
    expect(doc.chunks[0].content).toContain('Alice');
  });

  it('should chunk large text properly', async () => {
    const bigText = Array(200).fill('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.').join('\n\n');
    const buffer = Buffer.from(bigText, 'utf-8');
    const doc = await processor.process(buffer, 'big.txt');

    expect(doc.chunks.length).toBeGreaterThan(1);
    for (const chunk of doc.chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(5000); // some tolerance
      expect(chunk.metadata.totalChunks).toBe(doc.chunks.length);
    }
  });

  it('should reject files over 50MB', async () => {
    const bigBuffer = Buffer.alloc(51 * 1024 * 1024);
    await expect(processor.process(bigBuffer, 'huge.txt')).rejects.toThrow('too large');
  });

  it('should handle empty content', async () => {
    const buffer = Buffer.from('', 'utf-8');
    const doc = await processor.process(buffer, 'empty.txt');
    expect(doc.chunks.length).toBe(0);
  });
});
