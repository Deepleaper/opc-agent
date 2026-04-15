import { describe, it, expect } from 'vitest';
import { VoiceChannel } from '../src/channels/voice';
import type { STTProvider, TTSProvider } from '../src/channels/voice';

describe('VoiceChannel', () => {
  it('should start and stop', async () => {
    const channel = new VoiceChannel();
    await channel.start();
    expect(channel.isRunning()).toBe(true);
    await channel.stop();
    expect(channel.isRunning()).toBe(false);
  });

  it('should process audio with STT/TTS providers', async () => {
    const stt: STTProvider = {
      name: 'mock-stt',
      transcribe: async (audio) => audio.toString('utf-8'),
    };
    const tts: TTSProvider = {
      name: 'mock-tts',
      synthesize: async (text) => Buffer.from(`audio:${text}`),
    };

    const channel = new VoiceChannel({ sttProvider: stt, ttsProvider: tts });
    channel.onMessage(async (msg) => ({
      id: 'r1', role: 'assistant', content: `Reply: ${msg.content}`, timestamp: Date.now(),
    }));
    await channel.start();

    const result = await channel.processAudio(Buffer.from('hello'));
    expect(result.text).toBe('hello');
    expect(result.response).toBe('Reply: hello');
    expect(result.audioResponse?.toString()).toBe('audio:Reply: hello');
  });

  it('should work without providers (text fallback)', async () => {
    const channel = new VoiceChannel();
    channel.onMessage(async (msg) => ({
      id: 'r1', role: 'assistant', content: msg.content, timestamp: Date.now(),
    }));
    await channel.start();

    const result = await channel.processAudio(Buffer.from('test'));
    expect(result.text).toBe('test');
    expect(result.audioResponse).toBeUndefined();
  });

  it('should throw without handler', async () => {
    const channel = new VoiceChannel();
    await expect(channel.processAudio(Buffer.from('test'))).rejects.toThrow('No message handler');
  });

  it('should allow setting providers after construction', () => {
    const channel = new VoiceChannel();
    const stt: STTProvider = { name: 'stt', transcribe: async () => 'text' };
    const tts: TTSProvider = { name: 'tts', synthesize: async () => Buffer.from('audio') };
    channel.setSTTProvider(stt);
    channel.setTTSProvider(tts);
    expect(channel.type).toBe('voice');
  });
});
