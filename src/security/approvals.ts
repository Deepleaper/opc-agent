/**
 * Approvals Module - v1.0.0
 * Policy-based exec approval system with queue, expiry, history, and callbacks.
 */

import { randomUUID } from 'crypto';

export type ExecApprovalPolicy = 'always' | 'elevated-only' | 'never' | 'allowlist';

export interface ExecApprovalRequest {
  id: string;
  command: string;
  elevated: boolean;
  requestedAt: number;
  expiresAt: number;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  approvedBy?: string;
  reason?: string;
}

export interface ExecApprovalHistory {
  request: ExecApprovalRequest;
  resolvedAt: number;
}

export type ApprovalRequestCallback = (request: ExecApprovalRequest) => void;

export class ExecApprovalManager {
  private policy: ExecApprovalPolicy;
  private pending: Map<string, ExecApprovalRequest> = new Map();
  private history: ExecApprovalHistory[] = [];
  private allowedCommands: Set<string> = new Set();
  private expiryMs: number;
  private onRequestCallback?: ApprovalRequestCallback;
  private expiryTimer?: ReturnType<typeof setInterval>;

  constructor(options: {
    policy?: ExecApprovalPolicy;
    expiryMs?: number;
    allowedCommands?: string[];
    onRequest?: ApprovalRequestCallback;
  } = {}) {
    this.policy = options.policy ?? 'elevated-only';
    this.expiryMs = options.expiryMs ?? 300_000; // 5 min default
    this.onRequestCallback = options.onRequest;
    if (options.allowedCommands) {
      for (const cmd of options.allowedCommands) this.allowedCommands.add(cmd);
    }
    this.expiryTimer = setInterval(() => this.expirePending(), 10_000);
    if (this.expiryTimer.unref) this.expiryTimer.unref();
  }

  getPolicy(): ExecApprovalPolicy { return this.policy; }
  setPolicy(p: ExecApprovalPolicy): void { this.policy = p; }

  addAllowedCommand(cmd: string): void { this.allowedCommands.add(cmd); }
  removeAllowedCommand(cmd: string): void { this.allowedCommands.delete(cmd); }
  getAllowedCommands(): string[] { return [...this.allowedCommands]; }

  needsApproval(command: string, elevated: boolean): boolean {
    switch (this.policy) {
      case 'never': return false;
      case 'always': return true;
      case 'elevated-only': return elevated;
      case 'allowlist': return !this.isAllowed(command);
    }
  }

  private isAllowed(command: string): boolean {
    for (const allowed of this.allowedCommands) {
      if (command.startsWith(allowed) || command === allowed) return true;
    }
    return false;
  }

  request(command: string, elevated: boolean = false): ExecApprovalRequest {
    const now = Date.now();
    const req: ExecApprovalRequest = {
      id: randomUUID(),
      command,
      elevated,
      requestedAt: now,
      expiresAt: now + this.expiryMs,
      status: 'pending',
    };
    this.pending.set(req.id, req);
    this.onRequestCallback?.(req);
    return req;
  }

  approve(id: string, approver: string): ExecApprovalRequest {
    const req = this.pending.get(id);
    if (!req) throw new Error(`Request ${id} not found`);
    if (req.status !== 'pending') throw new Error(`Request ${id} already ${req.status}`);
    req.status = 'approved';
    req.approvedBy = approver;
    this.pending.delete(id);
    this.history.push({ request: req, resolvedAt: Date.now() });
    return req;
  }

  deny(id: string, approver: string, reason?: string): ExecApprovalRequest {
    const req = this.pending.get(id);
    if (!req) throw new Error(`Request ${id} not found`);
    if (req.status !== 'pending') throw new Error(`Request ${id} already ${req.status}`);
    req.status = 'denied';
    req.approvedBy = approver;
    req.reason = reason;
    this.pending.delete(id);
    this.history.push({ request: req, resolvedAt: Date.now() });
    return req;
  }

  getPending(): ExecApprovalRequest[] {
    return [...this.pending.values()];
  }

  getHistory(): ExecApprovalHistory[] {
    return [...this.history];
  }

  getRequest(id: string): ExecApprovalRequest | undefined {
    return this.pending.get(id) ?? this.history.find(h => h.request.id === id)?.request;
  }

  private expirePending(): void {
    const now = Date.now();
    for (const [id, req] of this.pending) {
      if (now >= req.expiresAt) {
        req.status = 'expired';
        this.pending.delete(id);
        this.history.push({ request: req, resolvedAt: now });
      }
    }
  }

  /** Force expire check (for testing) */
  checkExpiry(): void { this.expirePending(); }

  destroy(): void {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
  }
}
