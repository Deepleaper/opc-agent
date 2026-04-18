/**
 * Elevated Permissions Module - v1.0.0
 * Elevation mode management with allowed commands, auto-revoke, and audit log.
 */

export type ElevationMode = 'off' | 'ask' | 'on';

export interface ElevationAuditEntry {
  timestamp: number;
  action: 'elevate' | 'revoke' | 'execute' | 'deny';
  command?: string;
  reason?: string;
}

export class ElevatedManager {
  private mode: ElevationMode;
  private elevated: boolean = false;
  private allowedCommands: RegExp[] = [];
  private auditLog: ElevationAuditEntry[] = [];
  private revokeTimer?: ReturnType<typeof setTimeout>;
  private autoRevokeMs: number;

  constructor(options: {
    mode?: ElevationMode;
    allowedCommands?: (string | RegExp)[];
    autoRevokeMs?: number;
  } = {}) {
    this.mode = options.mode ?? 'ask';
    this.autoRevokeMs = options.autoRevokeMs ?? 600_000; // 10 min
    if (options.allowedCommands) {
      for (const cmd of options.allowedCommands) {
        this.allowedCommands.push(cmd instanceof RegExp ? cmd : new RegExp(`^${cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
      }
    }
  }

  getMode(): ElevationMode { return this.mode; }
  setMode(mode: ElevationMode): void { this.mode = mode; }
  isElevated(): boolean { return this.elevated; }

  addAllowedCommand(pattern: string | RegExp): void {
    this.allowedCommands.push(pattern instanceof RegExp ? pattern : new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  }

  isCommandAllowed(command: string): boolean {
    return this.allowedCommands.some(r => r.test(command));
  }

  elevate(reason?: string): boolean {
    if (this.mode === 'off') return false;
    this.elevated = true;
    this.auditLog.push({ timestamp: Date.now(), action: 'elevate', reason });
    this.startAutoRevoke();
    return true;
  }

  revoke(reason?: string): void {
    this.elevated = false;
    this.clearAutoRevoke();
    this.auditLog.push({ timestamp: Date.now(), action: 'revoke', reason });
  }

  canExecute(command: string): { allowed: boolean; needsElevation: boolean } {
    if (this.isCommandAllowed(command)) return { allowed: true, needsElevation: false };
    if (this.mode === 'off') return { allowed: true, needsElevation: false };
    if (this.mode === 'on') {
      if (!this.elevated) this.elevate('auto-on mode');
      this.auditLog.push({ timestamp: Date.now(), action: 'execute', command });
      return { allowed: true, needsElevation: false };
    }
    // ask mode
    if (this.elevated) {
      this.auditLog.push({ timestamp: Date.now(), action: 'execute', command });
      return { allowed: true, needsElevation: false };
    }
    return { allowed: false, needsElevation: true };
  }

  getAuditLog(): ElevationAuditEntry[] {
    return [...this.auditLog];
  }

  clearAuditLog(): void {
    this.auditLog = [];
  }

  private startAutoRevoke(): void {
    this.clearAutoRevoke();
    this.revokeTimer = setTimeout(() => {
      this.revoke('auto-revoke timer');
    }, this.autoRevokeMs);
    if (this.revokeTimer.unref) this.revokeTimer.unref();
  }

  private clearAutoRevoke(): void {
    if (this.revokeTimer) {
      clearTimeout(this.revokeTimer);
      this.revokeTimer = undefined;
    }
  }

  destroy(): void {
    this.clearAutoRevoke();
  }
}
