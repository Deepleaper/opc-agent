import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProfileManager } from '../src/core/profiles';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ProfileManager', () => {
  let tmpDir: string;
  let pm: ProfileManager;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `opc-profiles-test-${Date.now()}`);
    pm = new ProfileManager(tmpDir);
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('should create a profile', () => {
    const p = pm.create('test-profile', { model: 'gpt-4o' });
    expect(p.name).toBe('test-profile');
    expect(p.config.model).toBe('gpt-4o');
  });

  it('should throw on duplicate create', () => {
    pm.create('dup');
    expect(() => pm.create('dup')).toThrow('already exists');
  });

  it('should list profiles', () => {
    pm.create('a');
    pm.create('b');
    const list = pm.list();
    expect(list).toHaveLength(2);
    expect(list.map(p => p.name).sort()).toEqual(['a', 'b']);
  });

  it('should switch profiles', () => {
    pm.create('prof1');
    pm.create('prof2');
    pm.switch('prof1');
    expect(pm.current().name).toBe('prof1');
    pm.switch('prof2');
    expect(pm.current().name).toBe('prof2');
  });

  it('should delete a non-current profile', () => {
    pm.create('keeper');
    pm.create('goner');
    pm.switch('keeper');
    pm.delete('goner');
    expect(pm.list()).toHaveLength(1);
  });

  it('should throw when deleting current profile', () => {
    pm.create('active');
    pm.switch('active');
    expect(() => pm.delete('active')).toThrow('Cannot delete');
  });
});
