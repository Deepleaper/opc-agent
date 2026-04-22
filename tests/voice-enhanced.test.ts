import { describe, it, expect } from 'vitest';
import { VoiceProcessor, createVoiceProcessor } from '../src/channels/voice';

describe('VoiceProcessor Enhanced', () => {
  it('should create with edge-tts config', () => {
    const vp = createVoiceProcessor({ ttsProvider: 'edge-tts', language: 'zh' });
    expect(vp).toBeInstanceOf(VoiceProcessor);
  });

  it('should create with whisper config', () => {
    const vp = createVoiceProcessor({ sttProvider: 'whisper-api', openaiApiKey: 'test-key' });
    expect(vp).toBeInstanceOf(VoiceProcessor);
    expect(vp.isSTTAvailable()).toBe(true);
  });

  it('should detect edge-tts availability', () => {
    const vp = createVoiceProcessor({ ttsProvider: 'edge-tts' });
    // edge-tts requires edge-tts binary, may or may not be available
    expect(typeof vp.isTTSAvailable()).toBe('boolean');
  });

  it('should detect azure unavailable without key', () => {
    const vp = createVoiceProcessor({ sttProvider: 'azure' });
    expect(vp.isSTTAvailable()).toBe(false);
  });

  it('should detect volcano unavailable without config', () => {
    const vp = createVoiceProcessor({ sttProvider: 'volcano' });
    expect(vp.isSTTAvailable()).toBe(false);
  });
});
