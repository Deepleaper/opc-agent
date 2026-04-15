import { BaseChannel } from './index';
import type { Message } from '../core/types';
import { Logger } from '../core/logger';

// ── Voice Channel Types ─────────────────────────────────────

export interface STTProvider {
  name: string;
  transcribe(audio: Buffer, options?: STTOptions): Promise<string>;
}

export interface TTSProvider {
  name: string;
  synthesize(text: string, options?: TTSOptions): Promise<Buffer>;
}

export interface STTOptions {
  language?: string;
  model?: string;
}

export interface TTSOptions {
  voice?: string;
  speed?: number;
  language?: string;
}

export interface VoiceChannelConfig {
  sttProvider?: STTProvider;
  ttsProvider?: TTSProvider;
  sampleRate?: number;
  language?: string;
}

// ── Voice Channel ───────────────────────────────────────────

export class VoiceChannel extends BaseChannel {
  type = 'voice';
  private config: VoiceChannelConfig;
  private logger = new Logger('voice-channel');
  private running = false;

  constructor(config?: VoiceChannelConfig) {
    super();
    this.config = config ?? {};
  }

  async start(): Promise<void> {
    this.running = true;
    this.logger.info('Voice channel started', {
      stt: this.config.sttProvider?.name ?? 'none',
      tts: this.config.ttsProvider?.name ?? 'none',
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    this.logger.info('Voice channel stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Process audio input: STT → Agent → TTS */
  async processAudio(audio: Buffer): Promise<{ text: string; response: string; audioResponse?: Buffer }> {
    if (!this.handler) throw new Error('No message handler set');

    // STT
    let text: string;
    if (this.config.sttProvider) {
      text = await this.config.sttProvider.transcribe(audio, { language: this.config.language });
    } else {
      text = audio.toString('utf-8'); // Fallback: treat as text
    }

    this.logger.debug('STT result', { text });

    // Create message and send to agent
    const message: Message = {
      id: `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      metadata: { channel: 'voice' },
    };

    const response = await this.handler(message);

    // TTS
    let audioResponse: Buffer | undefined;
    if (this.config.ttsProvider) {
      audioResponse = await this.config.ttsProvider.synthesize(response.content, { language: this.config.language });
    }

    return { text, response: response.content, audioResponse };
  }

  setSTTProvider(provider: STTProvider): void {
    this.config.sttProvider = provider;
  }

  setTTSProvider(provider: TTSProvider): void {
    this.config.ttsProvider = provider;
  }
}
