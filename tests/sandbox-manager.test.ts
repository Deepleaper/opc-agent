import { describe, it, expect } from 'vitest';
import { SandboxManager } from '../src/core/sandbox';

describe('SandboxManager (Remote)', () => {
  it('should create with default local backend', () => {
    const sm = new SandboxManager();
    expect(sm).toBeDefined();
  });

  it('should exec local command', async () => {
    const sm = new SandboxManager({ backend: 'local' });
    const result = await sm.exec('echo hello');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello');
  });

  it('should return non-zero exit code on failure', async () => {
    const sm = new SandboxManager({ backend: 'local' });
    const result = await sm.exec('exit 1');
    expect(result.exitCode).not.toBe(0);
  });

  it('should throw on docker without image', async () => {
    const sm = new SandboxManager({ backend: 'docker' });
    await expect(sm.exec('echo hi')).rejects.toThrow('Docker image is required');
  });

  it('should throw on ssh without host', async () => {
    const sm = new SandboxManager({ backend: 'ssh' });
    await expect(sm.exec('echo hi')).rejects.toThrow('SSH host and user are required');
  });

  it('should upload locally (copy)', async () => {
    const sm = new SandboxManager({ backend: 'local' });
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const src = path.join(os.tmpdir(), 'sandbox-test-src.txt');
    const dst = path.join(os.tmpdir(), 'sandbox-test-dst.txt');
    fs.writeFileSync(src, 'test content');
    await sm.upload(src, dst);
    expect(fs.readFileSync(dst, 'utf-8')).toBe('test content');
    fs.unlinkSync(src);
    fs.unlinkSync(dst);
  });
});
