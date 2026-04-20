/**
 * Voice processing module — STT (Speech-to-Text) and TTS (Text-to-Speech)
 *
 * STT providers:
 * 1. Edge STT (free, via edge-stt or Whisper local)
 * 2. Volcano Engine / Doubao STT (best Chinese, ~¥0.01/req)
 * 3. OpenAI Whisper API ($0.006/min)
 * 4. Local Whisper (free, needs model download)
 *
 * TTS providers:
 * 1. edge-tts (free, Microsoft voices, excellent Chinese)
 * 2. Volcano Engine TTS (Doubao voices)
 * 3. OpenAI TTS ($0.015/1K chars)
 *
 * Default: Whisper API for STT + edge-tts for TTS (best quality/cost ratio)
 */

import { execSync, exec as execCb } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

export interface VoiceConfig {
  sttProvider: 'whisper-api' | 'whisper-local' | 'volcano' | 'none';
  ttsProvider: 'edge-tts' | 'volcano' | 'openai-tts' | 'none';
  /** OpenAI API key for Whisper */
  openaiApiKey?: string;
  /** OpenAI base URL */
  openaiBaseUrl?: string;
  /** Volcano Engine credentials */
  volcanoAppId?: string;
  volcanoToken?: string;
  /** Whisper model for local inference */
  whisperModel?: string;
  /** TTS voice name */
  ttsVoice?: string;
  /** TTS language */
  ttsLang?: string;
  /** Temp directory for audio files */
  tempDir?: string;
  /** Ollama base URL for local Whisper */
  ollamaUrl?: string;
}

const DEFAULT_CONFIG: VoiceConfig = {
  sttProvider: 'whisper-api',
  ttsProvider: 'edge-tts',
  ttsVoice: 'zh-CN-XiaoxiaoNeural',
  ttsLang: 'zh-CN',
  tempDir: '.opc/voice-tmp',
};

export class VoiceProcessor {
  private config: VoiceConfig;

  constructor(config?: Partial<VoiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    const dir = this.config.tempDir || '.opc/voice-tmp';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  /**
   * Convert speech audio to text (STT)
   * @param audioPath Path to audio file (.ogg, .mp3, .wav, .m4a)
   * @returns Transcribed text
   */
  async speechToText(audioPath: string): Promise<string> {
    switch (this.config.sttProvider) {
      case 'whisper-api':
        return this.whisperApiSTT(audioPath);
      case 'whisper-local':
        return this.whisperLocalSTT(audioPath);
      case 'volcano':
        return this.volcanoSTT(audioPath);
      default:
        throw new Error(`STT not configured. Set voice.sttProvider in config.`);
    }
  }

  /**
   * Convert text to speech audio (TTS)
   * @param text Text to convert
   * @returns Path to generated audio file (.mp3)
   */
  async textToSpeech(text: string): Promise<string> {
    switch (this.config.ttsProvider) {
      case 'edge-tts':
        return this.edgeTTS(text);
      case 'openai-tts':
        return this.openaiTTS(text);
      case 'volcano':
        return this.volcanoTTS(text);
      default:
        throw new Error(`TTS not configured. Set voice.ttsProvider in config.`);
    }
  }

  /** Check if voice processing is available */
  isSTTAvailable(): boolean {
    if (this.config.sttProvider === 'none') return false;
    if (this.config.sttProvider === 'whisper-api') {
      return !!(this.config.openaiApiKey || process.env.OPENAI_API_KEY);
    }
    if (this.config.sttProvider === 'whisper-local') {
      return this.checkOllamaWhisper();
    }
    return true;
  }

  isTTSAvailable(): boolean {
    if (this.config.ttsProvider === 'none') return false;
    if (this.config.ttsProvider === 'edge-tts') return this.checkEdgeTTS();
    return true;
  }

  // ─── STT Providers ───

  private async whisperApiSTT(audioPath: string): Promise<string> {
    const apiKey = this.config.openaiApiKey || process.env.OPENAI_API_KEY;
    const baseUrl = this.config.openaiBaseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    if (!apiKey) throw new Error('OpenAI API key required for Whisper STT');

    // Use multipart/form-data with fetch
    const fileBuffer = fs.readFileSync(audioPath);
    const fileName = path.basename(audioPath);

    // Build multipart body manually
    const boundary = '----OPCVoice' + Date.now();
    const parts: Buffer[] = [];

    // file part
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: audio/ogg\r\n\r\n`));
    parts.push(fileBuffer);
    parts.push(Buffer.from('\r\n'));

    // model part
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`));

    // language part (optimize for Chinese)
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nzh\r\n`));

    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);
    const url = `${baseUrl}/audio/transcriptions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Whisper API error (${response.status}): ${err}`);
    }

    const result = await response.json() as { text: string };
    return result.text?.trim() || '';
  }

  private async whisperLocalSTT(audioPath: string): Promise<string> {
    // Use Ollama's audio models or local whisper.cpp
    const ollamaUrl = this.config.ollamaUrl || 'http://localhost:11434';
    try {
      // Try whisper via Ollama (if audio model available)
      // Fallback: use whisper.cpp CLI
      const result = execSync(`whisper "${audioPath}" --language zh --output_format txt`, {
        encoding: 'utf-8',
        timeout: 30000,
      });
      return result.trim();
    } catch {
      throw new Error('Local Whisper not available. Install whisper.cpp or use whisper-api provider.');
    }
  }

  private async volcanoSTT(_audioPath: string): Promise<string> {
    // Volcano Engine STT (豆包同源)
    // TODO: Implement when credentials provided
    throw new Error('Volcano STT not yet implemented. Use whisper-api for now.');
  }

  // ─── TTS Providers ───

  private async edgeTTS(text: string): Promise<string> {
    const voice = this.config.ttsVoice || 'zh-CN-XiaoxiaoNeural';
    const outPath = path.join(this.config.tempDir || '.opc/voice-tmp', `tts-${Date.now()}.mp3`);

    // edge-tts is a Python package: pip install edge-tts
    return new Promise((resolve, reject) => {
      const escaped = text.replace(/"/g, '\\"').replace(/\n/g, ' ');
      execCb(`edge-tts --voice "${voice}" --text "${escaped}" --write-media "${outPath}"`, {
        timeout: 30000,
      }, (err) => {
        if (err) {
          reject(new Error(`edge-tts failed: ${err.message}. Install with: pip install edge-tts`));
        } else {
          resolve(outPath);
        }
      });
    });
  }

  private async openaiTTS(text: string): Promise<string> {
    const apiKey = this.config.openaiApiKey || process.env.OPENAI_API_KEY;
    const baseUrl = this.config.openaiBaseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    if (!apiKey) throw new Error('OpenAI API key required for TTS');

    const outPath = path.join(this.config.tempDir || '.opc/voice-tmp', `tts-${Date.now()}.mp3`);

    const response = await fetch(`${baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'nova',
        input: text,
      }),
    });

    if (!response.ok) throw new Error(`OpenAI TTS error: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outPath, buffer);
    return outPath;
  }

  private async volcanoTTS(_text: string): Promise<string> {
    throw new Error('Volcano TTS not yet implemented.');
  }

  // ─── Helpers ───

  private checkEdgeTTS(): boolean {
    try {
      execSync('edge-tts --version', { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  private checkOllamaWhisper(): boolean {
    try {
      execSync('whisper --help', { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /** Download a file from URL to local path */
  async downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Follow redirect
          this.downloadFile(res.headers.location!, destPath).then(resolve).catch(reject);
          return;
        }
        const ws = fs.createWriteStream(destPath);
        res.pipe(ws);
        ws.on('finish', () => { ws.close(); resolve(); });
        ws.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Download timeout')); });
    });
  }

  /** Cleanup temp files */
  cleanup(): void {
    const dir = this.config.tempDir || '.opc/voice-tmp';
    try {
      const files = fs.readdirSync(dir);
      const now = Date.now();
      for (const f of files) {
        const fp = path.join(dir, f);
        const stat = fs.statSync(fp);
        // Remove files older than 1 hour
        if (now - stat.mtimeMs > 3600000) {
          fs.unlinkSync(fp);
        }
      }
    } catch { /* ignore */ }
  }
}

export function createVoiceProcessor(config?: Partial<VoiceConfig>): VoiceProcessor {
  return new VoiceProcessor(config);
}
