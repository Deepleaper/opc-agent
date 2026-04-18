import { describe, it, expect } from 'vitest';
import { ExecApprovalManager } from '../src/security/approvals';

describe('ExecApprovalManager', () => {
  it('should default to elevated-only policy', () => {
    const mgr = new ExecApprovalManager();
    expect(mgr.getPolicy()).toBe('elevated-only');
    mgr.destroy();
  });

  it('should require approval for elevated commands in elevated-only mode', () => {
    const mgr = new ExecApprovalManager({ policy: 'elevated-only' });
    expect(mgr.needsApproval('ls', true)).toBe(true);
    expect(mgr.needsApproval('ls', false)).toBe(false);
    mgr.destroy();
  });

  it('should always require approval in always mode', () => {
    const mgr = new ExecApprovalManager({ policy: 'always' });
    expect(mgr.needsApproval('ls', false)).toBe(true);
    mgr.destroy();
  });

  it('should never require approval in never mode', () => {
    const mgr = new ExecApprovalManager({ policy: 'never' });
    expect(mgr.needsApproval('rm -rf /', true)).toBe(false);
    mgr.destroy();
  });

  it('should skip approval for allowlisted commands', () => {
    const mgr = new ExecApprovalManager({ policy: 'allowlist', allowedCommands: ['git ', 'npm test'] });
    expect(mgr.needsApproval('git pull', false)).toBe(false);
    expect(mgr.needsApproval('rm -rf /', false)).toBe(true);
    mgr.destroy();
  });

  it('should create and approve requests', () => {
    const mgr = new ExecApprovalManager();
    const req = mgr.request('sudo reboot', true);
    expect(req.status).toBe('pending');
    expect(mgr.getPending()).toHaveLength(1);
    const approved = mgr.approve(req.id, 'admin');
    expect(approved.status).toBe('approved');
    expect(mgr.getPending()).toHaveLength(0);
    expect(mgr.getHistory()).toHaveLength(1);
    mgr.destroy();
  });

  it('should deny requests', () => {
    const mgr = new ExecApprovalManager();
    const req = mgr.request('rm -rf /', true);
    const denied = mgr.deny(req.id, 'admin', 'too dangerous');
    expect(denied.status).toBe('denied');
    expect(denied.reason).toBe('too dangerous');
    mgr.destroy();
  });

  it('should throw on double approve', () => {
    const mgr = new ExecApprovalManager();
    const req = mgr.request('test', false);
    mgr.approve(req.id, 'admin');
    expect(() => mgr.approve(req.id, 'admin')).toThrow();
    mgr.destroy();
  });

  it('should expire pending requests', () => {
    const mgr = new ExecApprovalManager({ expiryMs: 1 });
    const req = mgr.request('test', false);
    // Wait a tick then check
    return new Promise<void>(resolve => {
      setTimeout(() => {
        mgr.checkExpiry();
        expect(mgr.getPending()).toHaveLength(0);
        const found = mgr.getRequest(req.id);
        expect(found?.status).toBe('expired');
        mgr.destroy();
        resolve();
      }, 10);
    });
  });

  it('should fire onRequest callback', () => {
    let called = false;
    const mgr = new ExecApprovalManager({ onRequest: () => { called = true; } });
    mgr.request('test', false);
    expect(called).toBe(true);
    mgr.destroy();
  });
});
