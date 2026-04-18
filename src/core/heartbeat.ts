export interface HeartbeatConfig {
  interval: number;
  checkFn: () => Promise<string>;
}

export class HeartbeatManager {
  private config: HeartbeatConfig;
  private timer: ReturnType<typeof setInterval> | null = null;
  private callbacks: ((status: string) => void)[] = [];
  private lastBeat: { timestamp: number; status: string } | null = null;

  constructor(config: HeartbeatConfig) {
    if (!config.interval || config.interval < 100) {
      throw new Error('HeartbeatManager requires interval >= 100ms');
    }
    if (typeof config.checkFn !== 'function') {
      throw new Error('HeartbeatManager requires checkFn');
    }
    this.config = config;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      try {
        const status = await this.config.checkFn();
        this.lastBeat = { timestamp: Date.now(), status };
        for (const cb of this.callbacks) cb(status);
      } catch (err: any) {
        const status = `error: ${err.message}`;
        this.lastBeat = { timestamp: Date.now(), status };
        for (const cb of this.callbacks) cb(status);
      }
    }, this.config.interval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  onBeat(callback: (status: string) => void): void {
    this.callbacks.push(callback);
  }

  getLastBeat(): { timestamp: number; status: string } | null {
    return this.lastBeat;
  }
}
