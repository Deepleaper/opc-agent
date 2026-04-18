import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export interface VoiceCallConfig {
  provider: 'twilio' | 'vonage' | 'webrtc' | 'sip';
  credentials?: Record<string, string>;
  sttProvider?: string;
  ttsProvider?: string;
}

interface ActiveCall {
  callId: string;
  from: string;
  to: string;
  status: 'ringing' | 'active' | 'ended';
  startedAt: number;
}

export class VoiceCallManager extends EventEmitter {
  private config: VoiceCallConfig;
  private calls = new Map<string, ActiveCall>();
  private audioListeners = new Map<string, ((audio: Buffer) => void)[]>();

  constructor(config: VoiceCallConfig) {
    super();
    this.config = config;
  }

  private ensureCredentials(): void {
    if (!this.config.credentials || Object.keys(this.config.credentials).length === 0) {
      throw new Error(
        `Voice call provider "${this.config.provider}" requires credentials. ` +
        `Please configure credentials for ${this.config.provider} in your VoiceCallConfig.`
      );
    }
  }

  async startCall(to: string): Promise<string> {
    this.ensureCredentials();
    const callId = randomUUID();
    const call: ActiveCall = {
      callId,
      from: 'self',
      to,
      status: 'ringing',
      startedAt: Date.now(),
    };
    this.calls.set(callId, call);
    // Simulate connection
    setTimeout(() => {
      const c = this.calls.get(callId);
      if (c && c.status === 'ringing') c.status = 'active';
    }, 100);
    return callId;
  }

  async endCall(callId: string): Promise<void> {
    const call = this.calls.get(callId);
    if (!call) throw new Error(`Call ${callId} not found`);
    call.status = 'ended';
    this.audioListeners.delete(callId);
  }

  onIncoming(callback: (callId: string, from: string) => void): void {
    this.on('incoming', callback);
  }

  simulateIncoming(from: string): string {
    const callId = randomUUID();
    const call: ActiveCall = { callId, from, to: 'self', status: 'ringing', startedAt: Date.now() };
    this.calls.set(callId, call);
    this.emit('incoming', callId, from);
    return callId;
  }

  async sendAudio(callId: string, audio: Buffer): Promise<void> {
    const call = this.calls.get(callId);
    if (!call) throw new Error(`Call ${callId} not found`);
    if (call.status !== 'active') throw new Error(`Call ${callId} is not active`);
    // Stub: would send audio to provider
  }

  onAudio(callId: string, callback: (audio: Buffer) => void): void {
    const listeners = this.audioListeners.get(callId) || [];
    listeners.push(callback);
    this.audioListeners.set(callId, listeners);
  }

  getCallStatus(callId: string): 'ringing' | 'active' | 'ended' {
    const call = this.calls.get(callId);
    if (!call) throw new Error(`Call ${callId} not found`);
    return call.status;
  }

  listActiveCalls(): Array<{ callId: string; from: string; startedAt: number }> {
    return Array.from(this.calls.values())
      .filter(c => c.status !== 'ended')
      .map(({ callId, from, startedAt }) => ({ callId, from, startedAt }));
  }
}
