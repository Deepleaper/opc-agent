import { describe, it, expect } from 'vitest';
import { ElevatedManager } from '../src/security/elevated';

describe('ElevatedManager', () => {
  it('should default to ask mode', () => {
    const mgr = new ElevatedManager();
    expect(mgr.getMode()).toBe('ask');
    expect(mgr.isElevated()).toBe(false);
    mgr.destroy();
  });

  it('should elevate and revoke', () => {
    const mgr = new ElevatedManager();
    expect(mgr.elevate('test')).toBe(true);
    expect(mgr.isElevated()).toBe(true);
    mgr.revoke();
    expect(mgr.isElevated()).toBe(false);
    mgr.destroy();
  });

  it('should not elevate in off mode', () => {
    const mgr = new ElevatedManager({ mode: 'off' });
    expect(mgr.elevate()).toBe(false);
    expect(mgr.isElevated()).toBe(false);
    mgr.destroy();
  });

  it('should allow commands in allowedCommands list', () => {
    const mgr = new ElevatedManager({ allowedCommands: [/^git\s/] });
    expect(mgr.isCommandAllowed('git pull')).toBe(true);
    expect(mgr.isCommandAllowed('rm -rf /')).toBe(false);
    mgr.destroy();
  });

  it('should auto-execute in on mode', () => {
    const mgr = new ElevatedManager({ mode: 'on' });
    const result = mgr.canExecute('sudo reboot');
    expect(result.allowed).toBe(true);
    expect(mgr.isElevated()).toBe(true);
    mgr.destroy();
  });

  it('should require elevation in ask mode when not elevated', () => {
    const mgr = new ElevatedManager({ mode: 'ask' });
    const result = mgr.canExecute('sudo reboot');
    expect(result.allowed).toBe(false);
    expect(result.needsElevation).toBe(true);
    mgr.destroy();
  });

  it('should allow execution in ask mode when elevated', () => {
    const mgr = new ElevatedManager({ mode: 'ask' });
    mgr.elevate();
    const result = mgr.canExecute('sudo reboot');
    expect(result.allowed).toBe(true);
    mgr.destroy();
  });

  it('should keep audit log', () => {
    const mgr = new ElevatedManager();
    mgr.elevate('testing');
    mgr.revoke('done');
    const log = mgr.getAuditLog();
    expect(log).toHaveLength(2);
    expect(log[0].action).toBe('elevate');
    expect(log[1].action).toBe('revoke');
    mgr.destroy();
  });
});
