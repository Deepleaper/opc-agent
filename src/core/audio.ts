/**
 * Audio Processor - v1.0.0
 * Audio transcription/synthesis wrappers with format detection, duration, split.
 */

export type AudioFormat = 'wav' | 'mp3' | 'ogg' | 'flac' | 'webm' | 'aac' | 'unknown';

export interface TranscribeOptions {
  language?: string;
  model?: string;
  provider?: string;
}

export interface SynthesizeOptions {
  voice?: string;
  speed?: number;
  format?: AudioFormat;
  provider?: string;
}

export interface TranscribeResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: { start: number; end: number; text: string }[];
}

export interface SynthesizeResult {
  audio: Buffer;
  format: AudioFormat;
  duration?: number;
}

export type TranscribeFunction = (audio: Buffer, options?: TranscribeOptions) => Promise<TranscribeResult>;
export type SynthesizeFunction = (text: string, options?: SynthesizeOptions) => Promise<SynthesizeResult>;

const FORMAT_SIGNATURES: [Buffer, AudioFormat][] = [
  [Buffer.from('RIFF'), 'wav'],
  [Buffer.from([0xff, 0xfb]), 'mp3'],
  [Buffer.from([0xff, 0xf3]), 'mp3'],
  [Buffer.from([0xff, 0xf2]), 'mp3'],
  [Buffer.from([0x49, 0x44, 0x33]), 'mp3'], // ID3
  [Buffer.from('OggS'), 'ogg'],
  [Buffer.from('fLaC'), 'flac'],
  [Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), 'webm'],
];

export class AudioProcessor {
  private transcribeFn?: TranscribeFunction;
  private synthesizeFn?: SynthesizeFunction;

  constructor(options?: { transcribe?: TranscribeFunction; synthesize?: SynthesizeFunction }) {
    this.transcribeFn = options?.transcribe;
    this.synthesizeFn = options?.synthesize;
  }

  /** Detect audio format from buffer header */
  static detectFormat(audio: Buffer): AudioFormat {
    for (const [sig, fmt] of FORMAT_SIGNATURES) {
      if (audio.length >= sig.length && audio.subarray(0, sig.length).equals(sig)) return fmt;
    }
    return 'unknown';
  }

  /** Estimate duration in seconds for WAV files (for others returns undefined) */
  static estimateDuration(audio: Buffer): number | undefined {
    const fmt = AudioProcessor.detectFormat(audio);
    if (fmt === 'wav' && audio.length >= 44) {
      const sampleRate = audio.readUInt32LE(24);
      const byteRate = audio.readUInt32LE(28);
      if (byteRate > 0) {
        const dataSize = audio.length - 44;
        return dataSize / byteRate;
      }
    }
    return undefined;
  }

  /** Split audio buffer into chunks of roughly `chunkBytes` size */
  static split(audio: Buffer, chunkBytes: number): Buffer[] {
    if (chunkBytes <= 0) throw new Error('chunkBytes must be positive');
    const chunks: Buffer[] = [];
    for (let i = 0; i < audio.length; i += chunkBytes) {
      chunks.push(audio.subarray(i, Math.min(i + chunkBytes, audio.length)));
    }
    return chunks;
  }

  async transcribe(audio: Buffer, options?: TranscribeOptions): Promise<TranscribeResult> {
    if (!this.transcribeFn) throw new Error('No transcribe provider configured');
    return this.transcribeFn(audio, options);
  }

  async synthesize(text: string, options?: SynthesizeOptions): Promise<SynthesizeResult> {
    if (!this.synthesizeFn) throw new Error('No synthesize provider configured');
    return this.synthesizeFn(text, options);
  }
}
