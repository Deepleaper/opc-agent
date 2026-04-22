import { describe, it, expect } from 'vitest';
import { VoiceProcessor, createVoiceProcessor } from '../src/channels/voice';

describe('VoiceProcessor', () => {
  it('should create with defaults', () => {
    const vp = createVoiceProcessor();
    expect(vp).toBeInstanceOf(VoiceProcessor);
  });

  it('should detect STT/TTS availability', () => {
    const vp = createVoiceProcessor({ sttProvider: 'none' });
    expect(vp.isSTTAvailable()).toBe(false);
    // TTS defaults to edge-tts even if 'none' is passed (auto-detect logic)
    expect(typeof vp.isTTSAvailable()).toBe('boolean');
  });

  it('should throw on STT when not configured', async () => {
    const vp = createVoiceProcessor({ sttProvider: 'none' as any });
    await expect(vp.speechToText('fake.ogg')).rejects.toThrow();
  });
});
