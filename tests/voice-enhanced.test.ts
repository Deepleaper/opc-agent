import { describe, it, expect, vi } from 'vitest';
import { VoiceChannel, createVoiceProviders, EdgeTTSProvider, WhisperSTTProvider, OpenAITTSProvider } from '../src/channels/voice';
import type { STTProvider, TTSProvider, VoiceConfig } from '../src/channels/voice';

describe('VoiceChannel Enhanced', () => {
  // ── VoiceConfig Parsing ───────────────────────────────────

  it('should parse VoiceConfig with edge-tts', () => {
    const config: VoiceConfig = {
      sttProvider: 'whisper',
      ttsProvider: 'edge-tts',
      voice: 'en-US-GuyNeural',
      language: 'en',
    };
    const { stt, tts } = createVoiceProviders(config);
    expect(stt).toBeUndefined(); // no API key
    expect(tts).toBeDefined();
    expect(tts!.name).toBe('edge-tts');
  });

  it('should parse VoiceConfig with whisper + openai-tts', () => {
    const config: VoiceConfig = {
      sttProvider: 'whisper',
      ttsProvider: 'openai-tts',
      sttApiKey: 'sk-test',
      ttsApiKey: 'sk-test',
      voice: 'nova',
    };
    const { stt, tts } = createVoiceProviders(config);
    expect(stt).toBeDefined();
    expect(stt!.name).toBe('whisper');
    expect(tts).toBeDefined();
    expect(tts!.name).toBe('openai-tts');
  });

  it('should return undefined for web-speech (node-only)', () => {
    const { stt } = createVoiceProviders({
      sttProvider: 'web-speech',
      ttsProvider: 'edge-tts',
    });
    expect(stt).toBeUndefined();
  });

  // ── Transcribe (mock) ─────────────────────────────────────

  it('should transcribe audio with mock STT provider', async () => {
    const mockSTT: STTProvider = {
      name: 'mock-stt',
      transcribe: vi.fn().mockResolvedValue('Hello world'),
    };
    const channel = new VoiceChannel({ sttProvider: mockSTT });
    const text = await channel.transcribe(Buffer.from('audio-data'));
    expect(text).toBe('Hello world');
    expect(mockSTT.transcribe).toHaveBeenCalled();
  });

  it('should throw if no STT provider for transcribe', async () => {
    const channel = new VoiceChannel();
    await expect(channel.transcribe(Buffer.from('audio'))).rejects.toThrow('No STT provider');
  });

  // ── Synthesize (mock) ─────────────────────────────────────

  it('should synthesize text with mock TTS provider', async () => {
    const mockTTS: TTSProvider = {
      name: 'mock-tts',
      synthesize: vi.fn().mockResolvedValue(Buffer.from('audio-output')),
    };
    const channel = new VoiceChannel({ ttsProvider: mockTTS });
    const audio = await channel.synthesize('Hello world');
    expect(audio).toEqual(Buffer.from('audio-output'));
    expect(mockTTS.synthesize).toHaveBeenCalledWith('Hello world', { voice: undefined });
  });

  it('should throw if no TTS provider for synthesize', async () => {
    const channel = new VoiceChannel();
    await expect(channel.synthesize('Hello')).rejects.toThrow('No TTS provider');
  });

  // ── Conversation Mode ─────────────────────────────────────

  it('should start and stop conversation mode', async () => {
    const channel = new VoiceChannel();
    await channel.startConversation(async (text) => `Echo: ${text}`);
    expect(channel.isConversationActive()).toBe(true);
    channel.stopConversation();
    expect(channel.isConversationActive()).toBe(false);
  });

  // ── processConversationTurn ───────────────────────────────

  it('should process a conversation turn', async () => {
    const mockSTT: STTProvider = {
      name: 'mock-stt',
      transcribe: vi.fn().mockResolvedValue('What time is it?'),
    };
    const mockTTS: TTSProvider = {
      name: 'mock-tts',
      synthesize: vi.fn().mockResolvedValue(Buffer.from('audio-response')),
    };
    const channel = new VoiceChannel({ sttProvider: mockSTT, ttsProvider: mockTTS });

    const result = await channel.processConversationTurn(
      Buffer.from('audio'),
      async (text) => `It is 3pm, you said: ${text}`,
    );

    expect(result.text).toBe('What time is it?');
    expect(result.response).toContain('3pm');
    expect(result.audioResponse).toBeDefined();
  });

  // ── processAudio with handler ─────────────────────────────

  it('should process audio end-to-end', async () => {
    const mockSTT: STTProvider = {
      name: 'mock-stt',
      transcribe: vi.fn().mockResolvedValue('Hello agent'),
    };
    const mockTTS: TTSProvider = {
      name: 'mock-tts',
      synthesize: vi.fn().mockResolvedValue(Buffer.from('tts-audio')),
    };
    const channel = new VoiceChannel({ sttProvider: mockSTT, ttsProvider: mockTTS });
    channel.onMessage(async (msg) => ({
      id: 'r1',
      role: 'assistant' as const,
      content: `Reply to: ${msg.content}`,
      timestamp: Date.now(),
    }));

    const result = await channel.processAudio(Buffer.from('raw-audio'));
    expect(result.text).toBe('Hello agent');
    expect(result.response).toBe('Reply to: Hello agent');
    expect(result.audioResponse).toBeDefined();
  });

  // ── Provider instances ────────────────────────────────────

  it('should create EdgeTTSProvider with default voice', () => {
    const provider = new EdgeTTSProvider();
    expect(provider.name).toBe('edge-tts');
  });

  it('should create EdgeTTSProvider with custom voice', () => {
    const provider = new EdgeTTSProvider('zh-CN-XiaoxiaoNeural');
    expect(provider.name).toBe('edge-tts');
  });

  // ── Channel lifecycle ─────────────────────────────────────

  it('should start and stop channel', async () => {
    const channel = new VoiceChannel();
    expect(channel.isRunning()).toBe(false);
    await channel.start();
    expect(channel.isRunning()).toBe(true);
    await channel.stop();
    expect(channel.isRunning()).toBe(false);
  });

  it('should set STT/TTS providers dynamically', () => {
    const channel = new VoiceChannel();
    const mockSTT: STTProvider = { name: 'test-stt', transcribe: vi.fn() };
    const mockTTS: TTSProvider = { name: 'test-tts', synthesize: vi.fn() };
    channel.setSTTProvider(mockSTT);
    channel.setTTSProvider(mockTTS);
    // No error means success
  });
});
