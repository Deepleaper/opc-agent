import { describe, it, expect } from 'vitest';
import { AudioProcessor } from '../src/core/audio';

describe('AudioProcessor', () => {
  it('should detect WAV format', () => {
    const wav = Buffer.from('RIFF\x00\x00\x00\x00WAVEfmt ');
    expect(AudioProcessor.detectFormat(wav)).toBe('wav');
  });

  it('should detect MP3 format (ID3)', () => {
    const mp3 = Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00');
    expect(AudioProcessor.detectFormat(mp3)).toBe('mp3');
  });

  it('should return unknown for unrecognized format', () => {
    const unknown = Buffer.from('NOTAFORMAT');
    expect(AudioProcessor.detectFormat(unknown)).toBe('unknown');
  });

  it('should split buffer into chunks', () => {
    const buf = Buffer.alloc(100, 0x42);
    const chunks = AudioProcessor.split(buf, 30);
    expect(chunks).toHaveLength(4);
    expect(chunks[0].length).toBe(30);
    expect(chunks[3].length).toBe(10);
  });

  it('should throw without provider on transcribe', async () => {
    const proc = new AudioProcessor();
    await expect(proc.transcribe(Buffer.alloc(0))).rejects.toThrow('No transcribe provider');
  });

  it('should call transcribe provider', async () => {
    const proc = new AudioProcessor({
      transcribe: async () => ({ text: 'hello world' }),
    });
    const result = await proc.transcribe(Buffer.alloc(10));
    expect(result.text).toBe('hello world');
  });
});
