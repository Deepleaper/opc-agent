import { describe, it, expect } from 'vitest';
import { VoiceCallManager } from '../src/channels/voice-call';

describe('VoiceCallManager', () => {
  it('should create with config', () => {
    const mgr = new VoiceCallManager({ provider: 'twilio', credentials: { sid: 'x', token: 'y' } });
    expect(mgr).toBeInstanceOf(VoiceCallManager);
  });

  it('should throw without credentials on startCall', async () => {
    const mgr = new VoiceCallManager({ provider: 'twilio' });
    await expect(mgr.startCall('+1234')).rejects.toThrow('credentials');
  });

  it('should start and end a call', async () => {
    const mgr = new VoiceCallManager({ provider: 'webrtc', credentials: { key: 'val' } });
    const callId = await mgr.startCall('+1234');
    expect(callId).toBeTruthy();
    expect(mgr.getCallStatus(callId)).toBe('ringing');
    await mgr.endCall(callId);
    expect(mgr.getCallStatus(callId)).toBe('ended');
  });

  it('should handle incoming calls', async () => {
    const mgr = new VoiceCallManager({ provider: 'sip', credentials: { key: 'val' } });
    const result = await new Promise<{ callId: string; from: string }>((resolve) => {
      mgr.onIncoming((callId, from) => resolve({ callId, from }));
      mgr.simulateIncoming('+5678');
    });
    expect(result.callId).toBeTruthy();
    expect(result.from).toBe('+5678');
  });

  it('should list active calls', async () => {
    const mgr = new VoiceCallManager({ provider: 'twilio', credentials: { sid: 'x', token: 'y' } });
    const id1 = await mgr.startCall('+111');
    const id2 = await mgr.startCall('+222');
    expect(mgr.listActiveCalls().length).toBe(2);
    await mgr.endCall(id1);
    expect(mgr.listActiveCalls().length).toBe(1);
  });

  it('should throw on unknown callId', () => {
    const mgr = new VoiceCallManager({ provider: 'twilio', credentials: { sid: 'x' } });
    expect(() => mgr.getCallStatus('unknown')).toThrow('not found');
  });
});
