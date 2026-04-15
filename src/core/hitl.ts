import { EventEmitter } from 'events';
import { Logger } from './logger';

// ── HITL Types ──────────────────────────────────────────────

export interface ApprovalRequest {
  id: string;
  action: string;
  description: string;
  context?: Record<string, unknown>;
  timeoutMs: number;
  defaultAction: 'approve' | 'deny';
  createdAt: number;
}

export interface ApprovalResponse {
  requestId: string;
  decision: 'approve' | 'deny';
  respondedBy?: string;
  respondedAt: number;
  timedOut: boolean;
}

export type ApprovalHandler = (request: ApprovalRequest) => Promise<ApprovalResponse>;

export interface HITLConfig {
  /** Actions that always require approval */
  requireApproval: string[];
  /** Default timeout in ms */
  defaultTimeoutMs: number;
  /** Default action on timeout */
  defaultAction: 'approve' | 'deny';
}

// ── HITL Manager ────────────────────────────────────────────

export class HITLManager extends EventEmitter {
  private config: HITLConfig;
  private handler: ApprovalHandler | null = null;
  private pending: Map<string, { request: ApprovalRequest; resolve: (r: ApprovalResponse) => void }> = new Map();
  private logger = new Logger('hitl');

  constructor(config?: Partial<HITLConfig>) {
    super();
    this.config = {
      requireApproval: config?.requireApproval ?? [],
      defaultTimeoutMs: config?.defaultTimeoutMs ?? 60000,
      defaultAction: config?.defaultAction ?? 'deny',
    };
  }

  setHandler(handler: ApprovalHandler): void {
    this.handler = handler;
  }

  needsApproval(action: string): boolean {
    if (this.config.requireApproval.includes('*')) return true;
    return this.config.requireApproval.includes(action);
  }

  async requestApproval(action: string, description: string, context?: Record<string, unknown>): Promise<ApprovalResponse> {
    const request: ApprovalRequest = {
      id: `hitl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      action,
      description,
      context,
      timeoutMs: this.config.defaultTimeoutMs,
      defaultAction: this.config.defaultAction,
      createdAt: Date.now(),
    };

    this.emit('approval:requested', request);
    this.logger.info('Approval requested', { id: request.id, action });

    if (this.handler) {
      try {
        const response = await Promise.race([
          this.handler(request),
          this.createTimeout(request),
        ]);
        this.emit('approval:responded', response);
        return response;
      } catch {
        return this.timeoutResponse(request);
      }
    }

    // No handler: wait for manual response via respond()
    return new Promise<ApprovalResponse>((resolve) => {
      this.pending.set(request.id, { request, resolve });

      setTimeout(() => {
        if (this.pending.has(request.id)) {
          this.pending.delete(request.id);
          const response = this.timeoutResponse(request);
          this.emit('approval:timeout', response);
          resolve(response);
        }
      }, request.timeoutMs);
    });
  }

  respond(requestId: string, decision: 'approve' | 'deny', respondedBy?: string): boolean {
    const entry = this.pending.get(requestId);
    if (!entry) return false;

    this.pending.delete(requestId);
    const response: ApprovalResponse = {
      requestId,
      decision,
      respondedBy,
      respondedAt: Date.now(),
      timedOut: false,
    };
    entry.resolve(response);
    this.emit('approval:responded', response);
    return true;
  }

  getPending(): ApprovalRequest[] {
    return Array.from(this.pending.values()).map(e => e.request);
  }

  private createTimeout(request: ApprovalRequest): Promise<ApprovalResponse> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.timeoutResponse(request)), request.timeoutMs);
    });
  }

  private timeoutResponse(request: ApprovalRequest): ApprovalResponse {
    return {
      requestId: request.id,
      decision: request.defaultAction,
      respondedAt: Date.now(),
      timedOut: true,
    };
  }
}
