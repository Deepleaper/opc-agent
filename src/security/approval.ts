import { randomUUID } from 'crypto';

export type ApprovalPolicy = 'always' | 'dangerous' | 'never';

export interface ApprovalRequest {
  id: string;
  type: 'shell' | 'file_write' | 'file_delete' | 'network' | 'plugin';
  command: string;
  description: string;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'denied';
  approvedBy?: string;
}

export class ApprovalManager {
  private policy: ApprovalPolicy;
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  private allowlist: Set<string> = new Set();
  private blocklist: Set<string> = new Set();

  private static readonly DANGEROUS_PATTERNS = [
    /rm\s+-rf/i, /del\s+\/s/i, /format\s+/i,
    /DROP\s+TABLE/i, /DELETE\s+FROM/i,
    /curl.*\|.*sh/i, /wget.*\|.*sh/i,
    /chmod\s+777/i, /sudo\s+/i,
    /npm\s+publish/i,
  ];

  constructor(policy: ApprovalPolicy = 'dangerous') {
    this.policy = policy;
  }

  getPolicy(): ApprovalPolicy {
    return this.policy;
  }

  setPolicy(policy: ApprovalPolicy): void {
    this.policy = policy;
  }

  needsApproval(type: string, command: string): boolean {
    // Blocklist always needs approval (effectively blocked)
    if (this.isBlocked(command)) return true;
    // Allowlist never needs approval
    if (this.isAllowed(command)) return false;

    if (this.policy === 'never') return false;
    if (this.policy === 'always') return true;
    // 'dangerous'
    return this.isDangerous(type, command);
  }

  private isDangerous(_type: string, command: string): boolean {
    return ApprovalManager.DANGEROUS_PATTERNS.some(p => p.test(command));
  }

  private isAllowed(command: string): boolean {
    for (const pattern of this.allowlist) {
      if (command.includes(pattern)) return true;
    }
    return false;
  }

  private isBlocked(command: string): boolean {
    for (const pattern of this.blocklist) {
      if (command.includes(pattern)) return true;
    }
    return false;
  }

  requestApproval(type: ApprovalRequest['type'], command: string, description: string): ApprovalRequest {
    const request: ApprovalRequest = {
      id: randomUUID(),
      type,
      command,
      description,
      requestedAt: new Date(),
      status: 'pending',
    };
    this.pendingApprovals.set(request.id, request);
    return request;
  }

  approve(id: string, approver: string): void {
    const req = this.pendingApprovals.get(id);
    if (!req) throw new Error(`Approval request ${id} not found`);
    if (req.status !== 'pending') throw new Error(`Request ${id} is already ${req.status}`);
    req.status = 'approved';
    req.approvedBy = approver;
  }

  deny(id: string, approver: string): void {
    const req = this.pendingApprovals.get(id);
    if (!req) throw new Error(`Approval request ${id} not found`);
    if (req.status !== 'pending') throw new Error(`Request ${id} is already ${req.status}`);
    req.status = 'denied';
    req.approvedBy = approver;
  }

  getRequest(id: string): ApprovalRequest | undefined {
    return this.pendingApprovals.get(id);
  }

  addToAllowlist(pattern: string): void {
    this.allowlist.add(pattern);
  }

  removeFromAllowlist(pattern: string): void {
    this.allowlist.delete(pattern);
  }

  addToBlocklist(pattern: string): void {
    this.blocklist.add(pattern);
  }

  removeFromBlocklist(pattern: string): void {
    this.blocklist.delete(pattern);
  }

  getPending(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values()).filter(r => r.status === 'pending');
  }

  getAllowlist(): string[] {
    return Array.from(this.allowlist);
  }

  getBlocklist(): string[] {
    return Array.from(this.blocklist);
  }
}
