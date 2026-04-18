import { BaseChannel } from './index';
import type { Message } from '../core/types';
import { Logger } from '../core/logger';
import * as https from 'https';

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

export interface VoiceConfig {
  sttProvider: 'whisper' | 'web-speech' | 'deepgram';
  ttsProvider: 'edge-tts' | 'openai-tts' | 'elevenlabs';
  sttApiKey?: string;
  ttsApiKey?: string;
  voice?: string;
  language?: string;
}

// ── Whisper STT Provider ────────────────────────────────────

export class WhisperSTTProvider implements STTProvider {
  name = 'whisper';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(audio: Buffer, options?: STTOptions): Promise<string> {
    const FormData = (await import('form-data' as string).catch(() => null));

    // Build multipart form data manually
    const boundary = '----OPCBoundary' + Date.now().toString(36);
    const parts: Buffer[] = [];

    // file field
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`));
    parts.push(audio);
    parts.push(Buffer.from('\r\n'));

    // model field
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`));

    // language field
    if (options?.language) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${options.language}\r\n`));
    }

    parts.push(Buffer.from(`--${boundary}--\r\n`));
    const body = Buffer.concat(parts);

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.openai.com',
        path: '/v1/audio/transcriptions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString());
            resolve(data.text ?? '');
          } catch (e) {
            reject(new Error('Failed to parse Whisper response'));
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

// ── Deepgram STT Provider ───────────────────────────────────

export class DeepgramSTTProvider implements STTProvider {
  name = 'deepgram';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(audio: Buffer, options?: STTOptions): Promise<string> {
    const lang = options?.language ?? 'en';
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.deepgram.com',
        path: `/v1/listen?language=${lang}&model=nova-2`,
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'audio/wav',
          'Content-Length': audio.length,
        },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString());
            const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
            resolve(transcript);
          } catch {
            reject(new Error('Failed to parse Deepgram response'));
          }
        });
      });
      req.on('error', reject);
      req.write(audio);
      req.end();
    });
  }
}

// ── Edge TTS Provider (free, no API key) ────────────────────

export class EdgeTTSProvider implements TTSProvider {
  name = 'edge-tts';
  private defaultVoice: string;

  constructor(voice?: string) {
    this.defaultVoice = voice ?? 'en-US-AriaNeural';
  }

  async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
    const WebSocket = (await import('ws' as string).catch(() => null))?.default;
    if (!WebSocket) {
      throw new Error('ws package required for Edge TTS. Install with: npm i ws');
    }

    const voice = options?.voice ?? this.defaultVoice;
    const requestId = [...Array(32)].map(() => Math.random().toString(16)[2]).join('');
    const timestamp = new Date().toISOString();

    const endpoint = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${requestId}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(endpoint, {
        headers: {
          'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const audioChunks: Buffer[] = [];
      let headerSent = false;

      ws.on('open', () => {
        // Send config
        ws.send(`Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);

        // Send SSML
        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'>${escapeXml(text)}</voice></speak>`;
        ws.send(`X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}\r\nPath:ssml\r\n\r\n${ssml}`);
      });

      ws.on('message', (data: Buffer | string) => {
        if (typeof data === 'string' || (Buffer.isBuffer(data) && data.toString().includes('Path:turn.end'))) {
          if (typeof data === 'string' && data.includes('Path:turn.end')) {
            ws.close();
            resolve(Buffer.concat(audioChunks));
          }
        } else if (Buffer.isBuffer(data)) {
          // Binary message — extract audio after header
          const headerEnd = data.indexOf(Buffer.from('\r\n\r\n'));
          if (headerEnd !== -1) {
            audioChunks.push(data.slice(headerEnd + 4));
          }
        }
      });

      ws.on('error', (err: Error) => {
        reject(new Error(`Edge TTS WebSocket error: ${err.message}`));
      });

      ws.on('close', () => {
        if (audioChunks.length > 0) {
          resolve(Buffer.concat(audioChunks));
        }
      });

      // Timeout
      setTimeout(() => {
        ws.close();
        if (audioChunks.length > 0) {
          resolve(Buffer.concat(audioChunks));
        } else {
          reject(new Error('Edge TTS timeout'));
        }
      }, 30000);
    });
  }
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ── OpenAI TTS Provider ─────────────────────────────────────

export class OpenAITTSProvider implements TTSProvider {
  name = 'openai-tts';
  private apiKey: string;
  private defaultVoice: string;

  constructor(apiKey: string, voice?: string) {
    this.apiKey = apiKey;
    this.defaultVoice = voice ?? 'alloy';
  }

  async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
    const voice = options?.voice ?? this.defaultVoice;
    const body = JSON.stringify({
      model: 'tts-1',
      input: text,
      voice,
      speed: options?.speed ?? 1.0,
    });

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.openai.com',
        path: '/v1/audio/speech',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

// ── ElevenLabs TTS Provider ─────────────────────────────────

export class ElevenLabsTTSProvider implements TTSProvider {
  name = 'elevenlabs';
  private apiKey: string;
  private defaultVoice: string;

  constructor(apiKey: string, voice?: string) {
    this.apiKey = apiKey;
    this.defaultVoice = voice ?? '21m00Tcm4TlvDq8ikWAM'; // Rachel
  }

  async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
    const voiceId = options?.voice ?? this.defaultVoice;
    const body = JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
    });

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.elevenlabs.io',
        path: `/v1/text-to-speech/${voiceId}`,
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

// ── Voice Config Factory ────────────────────────────────────

export function createVoiceProviders(config: VoiceConfig): { stt?: STTProvider; tts?: TTSProvider } {
  let stt: STTProvider | undefined;
  let tts: TTSProvider | undefined;

  switch (config.sttProvider) {
    case 'whisper':
      if (config.sttApiKey) stt = new WhisperSTTProvider(config.sttApiKey);
      break;
    case 'deepgram':
      if (config.sttApiKey) stt = new DeepgramSTTProvider(config.sttApiKey);
      break;
    case 'web-speech':
      // Browser only — not available in Node.js
      break;
  }

  switch (config.ttsProvider) {
    case 'edge-tts':
      tts = new EdgeTTSProvider(config.voice);
      break;
    case 'openai-tts':
      if (config.ttsApiKey) tts = new OpenAITTSProvider(config.ttsApiKey, config.voice);
      break;
    case 'elevenlabs':
      if (config.ttsApiKey) tts = new ElevenLabsTTSProvider(config.ttsApiKey, config.voice);
      break;
  }

  return { stt, tts };
}

// ── Voice Channel ───────────────────────────────────────────

export class VoiceChannel extends BaseChannel {
  type = 'voice';
  private config: VoiceChannelConfig;
  private logger = new Logger('voice-channel');
  private running = false;
  private conversationActive = false;

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
    this.conversationActive = false;
    this.logger.info('Voice channel stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Transcribe audio to text */
  async transcribe(audio: Buffer, format?: string): Promise<string> {
    if (!this.config.sttProvider) {
      throw new Error('No STT provider configured');
    }
    return this.config.sttProvider.transcribe(audio, { language: this.config.language });
  }

  /** Synthesize text to audio */
  async synthesize(text: string, voice?: string): Promise<Buffer> {
    if (!this.config.ttsProvider) {
      throw new Error('No TTS provider configured');
    }
    return this.config.ttsProvider.synthesize(text, { voice });
  }

  /** Start real-time conversation mode */
  async startConversation(onMessage: (text: string) => Promise<string>): Promise<void> {
    if (!this.running) await this.start();
    this.conversationActive = true;
    this.logger.info('Conversation mode started');

    // In a real implementation, this would set up a microphone stream.
    // For now, expose the conversation loop for programmatic use.
    this.emit('conversation:started');
  }

  /** Process a single turn in conversation mode */
  async processConversationTurn(
    audio: Buffer,
    onMessage: (text: string) => Promise<string>,
  ): Promise<{ text: string; response: string; audioResponse?: Buffer }> {
    const text = await this.transcribe(audio);
    const response = await onMessage(text);
    let audioResponse: Buffer | undefined;
    if (this.config.ttsProvider) {
      audioResponse = await this.synthesize(response);
    }
    return { text, response, audioResponse };
  }

  stopConversation(): void {
    this.conversationActive = false;
    this.emit('conversation:stopped');
  }

  isConversationActive(): boolean {
    return this.conversationActive;
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
