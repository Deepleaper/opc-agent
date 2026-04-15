import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VersionManager } from '../src/core/versioning';
import * as fs from 'fs';

const TEST_STORE = '.test-versions.json';

describe('VersionManager', () => {
  let vm: VersionManager;

  beforeEach(() => {
    if (fs.existsSync(TEST_STORE)) fs.unlinkSync(TEST_STORE);
    vm = new VersionManager(TEST_STORE);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_STORE)) fs.unlinkSync(TEST_STORE);
  });

  it('should save and list versions', () => {
    vm.snapshot('1.0.0', 'yaml-content-1', 'Initial');
    vm.snapshot('1.1.0', 'yaml-content-2', 'Update');
    const versions = vm.list();
    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe('1.0.0');
  });

  it('should get specific version', () => {
    vm.snapshot('1.0.0', 'content', 'Test');
    expect(vm.get('1.0.0')).toBeDefined();
    expect(vm.get('9.9.9')).toBeUndefined();
  });

  it('should get current version', () => {
    vm.snapshot('1.0.0', 'v1');
    vm.snapshot('2.0.0', 'v2');
    expect(vm.getCurrent()?.version).toBe('2.0.0');
  });

  it('should rollback to version', () => {
    vm.snapshot('1.0.0', 'old-yaml');
    vm.snapshot('2.0.0', 'new-yaml');
    const rolled = vm.rollback('1.0.0');
    expect(rolled).toBe('old-yaml');
  });

  it('should return null for unknown rollback', () => {
    expect(vm.rollback('9.9.9')).toBeNull();
  });

  it('should run migrations', () => {
    vm.registerMigration({
      fromVersion: '1.0.0',
      toVersion: '2.0.0',
      migrate: (oad) => ({ ...oad, upgraded: true }),
    });
    const result = vm.migrate({ data: 'test' }, '1.0.0', '2.0.0');
    expect((result as any).upgraded).toBe(true);
  });

  it('should throw on missing migration path', () => {
    expect(() => vm.migrate({}, '1.0.0', '5.0.0')).toThrow('No migration path');
  });

  it('should clear all versions', () => {
    vm.snapshot('1.0.0', 'content');
    vm.clear();
    expect(vm.list()).toHaveLength(0);
  });

  it('should persist to file', () => {
    vm.snapshot('1.0.0', 'persisted');
    const vm2 = new VersionManager(TEST_STORE);
    expect(vm2.list()).toHaveLength(1);
  });
});
