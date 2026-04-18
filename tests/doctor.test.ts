import { describe, it, expect } from 'vitest';
import { getDoctorChecks, runDoctor } from '../src/doctor';

describe('opc doctor', () => {
  it('runDoctor runs without error', async () => {
    // Suppress console output
    const orig = console.log;
    console.log = () => {};
    const result = await runDoctor();
    console.log = orig;
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('total');
    expect(result.total).toBeGreaterThan(0);
    expect(result.passed).toBeGreaterThanOrEqual(0);
    expect(result.passed).toBeLessThanOrEqual(result.total);
  });

  it('Node.js check passes (we are running in Node)', async () => {
    const checks = getDoctorChecks();
    const nodeCheck = checks.find(c => c.name === 'Node.js version');
    expect(nodeCheck).toBeDefined();
    const result = await nodeCheck!.check();
    expect(result.ok).toBe(true);
    expect(result.detail).toMatch(/^v\d+/);
  });

  it('check result format has ok and detail fields', async () => {
    const checks = getDoctorChecks();
    for (const check of checks) {
      const result = await check.check();
      expect(typeof result.ok).toBe('boolean');
      expect(typeof result.detail).toBe('string');
      if (result.fix !== undefined) {
        expect(typeof result.fix).toBe('string');
      }
    }
  });
});
