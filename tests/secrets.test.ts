import { describe, it, expect, afterEach } from 'vitest';
import { SecretsManager } from '../src/security/secrets';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const testDir = join(tmpdir(), 'opc-secrets-test-' + Date.now());
let counter = 0;
function testPath() { return join(testDir, `secrets-${++counter}.enc`); }

afterEach(() => {
  // cleanup
});

describe('SecretsManager', () => {
  it('should create new store and set/get secrets', () => {
    const fp = testPath();
    const mgr = new SecretsManager({ password: 'test123', filePath: fp });
    mgr.set('API_KEY', 'sk-abc123');
    expect(mgr.get('API_KEY')).toBe('sk-abc123');
    expect(existsSync(fp)).toBe(true);
  });

  it('should persist and reload secrets', () => {
    const fp = testPath();
    const mgr1 = new SecretsManager({ password: 'pw', filePath: fp });
    mgr1.set('TOKEN', 'xyz');
    const mgr2 = new SecretsManager({ password: 'pw', filePath: fp });
    expect(mgr2.get('TOKEN')).toBe('xyz');
  });

  it('should fail with wrong password', () => {
    const fp = testPath();
    const mgr = new SecretsManager({ password: 'right', filePath: fp });
    mgr.set('KEY', 'val');
    expect(() => new SecretsManager({ password: 'wrong', filePath: fp })).toThrow();
  });

  it('should delete secrets', () => {
    const fp = testPath();
    const mgr = new SecretsManager({ password: 'pw', filePath: fp });
    mgr.set('A', '1');
    expect(mgr.delete('A')).toBe(true);
    expect(mgr.get('A')).toBeUndefined();
    expect(mgr.delete('nonexistent')).toBe(false);
  });

  it('should list secret keys', () => {
    const fp = testPath();
    const mgr = new SecretsManager({ password: 'pw', filePath: fp });
    mgr.set('A', '1');
    mgr.set('B', '2');
    expect(mgr.list().sort()).toEqual(['A', 'B']);
  });

  it('should check has', () => {
    const fp = testPath();
    const mgr = new SecretsManager({ password: 'pw', filePath: fp });
    mgr.set('X', 'y');
    expect(mgr.has('X')).toBe(true);
    expect(mgr.has('Z')).toBe(false);
  });

  it('should inject secrets into env object', () => {
    const fp = testPath();
    const mgr = new SecretsManager({ password: 'pw', filePath: fp });
    mgr.set('DB_HOST', 'localhost');
    mgr.set('DB_PASS', 'secret');
    const env: Record<string, string | undefined> = { PATH: '/usr/bin' };
    mgr.inject(env, ['DB_HOST']);
    expect(env.DB_HOST).toBe('localhost');
    expect(env.DB_PASS).toBeUndefined();
  });

  it('should inject all secrets when no keys specified', () => {
    const fp = testPath();
    const mgr = new SecretsManager({ password: 'pw', filePath: fp });
    mgr.set('A', '1');
    mgr.set('B', '2');
    const env: Record<string, string | undefined> = {};
    mgr.inject(env);
    expect(env.A).toBe('1');
    expect(env.B).toBe('2');
  });

  it('should rotate password', () => {
    const fp = testPath();
    const mgr = new SecretsManager({ password: 'old', filePath: fp });
    mgr.set('KEY', 'value');
    mgr.rotate('new');
    // Old password should fail
    expect(() => new SecretsManager({ password: 'old', filePath: fp })).toThrow();
    // New password should work
    const mgr2 = new SecretsManager({ password: 'new', filePath: fp });
    expect(mgr2.get('KEY')).toBe('value');
  });

  it('should export and import', () => {
    const fp1 = testPath();
    const mgr = new SecretsManager({ password: 'pw', filePath: fp1 });
    mgr.set('SECRET', 'data');
    const exported = mgr.exportEncrypted();
    const fp2 = testPath();
    const mgr2 = SecretsManager.importEncrypted(exported, 'pw', fp2);
    expect(mgr2.get('SECRET')).toBe('data');
  });
});
