import { describe, it, expect, beforeEach } from 'vitest';
import { HITLManager } from '../src/core/hitl';

describe('HITLManager', () => {
  let hitl: HITLManager;

  beforeEach(() => {
    hitl = new HITLManager({
      requireApproval: ['delete', 'deploy'],
      defaultTimeoutMs: 500,
      defaultAction: 'deny',
    });
  });

  it('should check if action needs approval', () => {
    expect(hitl.needsApproval('delete')).toBe(true);
    expect(hitl.needsApproval('read')).toBe(false);
  });

  it('should approve via handler', async () => {
    hitl.setHandler(async (req) => ({
      requestId: req.id,
      decision: 'approve',
      respondedAt: Date.now(),
      timedOut: false,
    }));

    const response = await hitl.requestApproval('delete', 'Delete record #123');
    expect(response.decision).toBe('approve');
    expect(response.timedOut).toBe(false);
  });

  it('should deny via handler', async () => {
    hitl.setHandler(async (req) => ({
      requestId: req.id,
      decision: 'deny',
      respondedAt: Date.now(),
      timedOut: false,
    }));

    const response = await hitl.requestApproval('deploy', 'Deploy to production');
    expect(response.decision).toBe('deny');
  });

  it('should timeout with default action', async () => {
    // No handler, no manual response → timeout
    const response = await hitl.requestApproval('delete', 'Test timeout');
    expect(response.timedOut).toBe(true);
    expect(response.decision).toBe('deny'); // default action
  });

  it('should handle manual respond', async () => {
    const promise = hitl.requestApproval('delete', 'Manual test');
    const pending = hitl.getPending();
    expect(pending).toHaveLength(1);
    
    hitl.respond(pending[0].id, 'approve', 'admin');
    const response = await promise;
    expect(response.decision).toBe('approve');
    expect(response.respondedBy).toBe('admin');
  });

  it('should return false for unknown respond', () => {
    expect(hitl.respond('unknown-id', 'approve')).toBe(false);
  });

  it('should match wildcard approval', () => {
    const wildcard = new HITLManager({ requireApproval: ['*'] });
    expect(wildcard.needsApproval('anything')).toBe(true);
  });
});
