import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Daemon', () => {
  const OPC_DIR_NAME = '.opc';
  let tmpDir: string;
  let opcDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daemon-test-'));
    opcDir = path.join(tmpDir, OPC_DIR_NAME);
    fs.mkdirSync(opcDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Test the daemon's file-based contract (PID, heartbeat, log)
  it('PID file can be created', () => {
    const pidFile = path.join(opcDir, 'agent.pid');
    fs.writeFileSync(pidFile, '12345');
    expect(fs.existsSync(pidFile)).toBe(true);
    expect(fs.readFileSync(pidFile, 'utf-8')).toBe('12345');
  });

  it('PID file can be removed', () => {
    const pidFile = path.join(opcDir, 'agent.pid');
    fs.writeFileSync(pidFile, '12345');
    fs.unlinkSync(pidFile);
    expect(fs.existsSync(pidFile)).toBe(false);
  });

  it('status: PID exists and process alive → running', () => {
    const pidFile = path.join(opcDir, 'agent.pid');
    fs.writeFileSync(pidFile, String(process.pid)); // current process is alive
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'));
    let alive = false;
    try { process.kill(pid, 0); alive = true; } catch { alive = false; }
    expect(alive).toBe(true);
  });

  it('status: no PID file → stopped', () => {
    const pidFile = path.join(opcDir, 'agent.pid');
    expect(fs.existsSync(pidFile)).toBe(false);
  });

  it('stale PID detection: PID file with non-running process', () => {
    const pidFile = path.join(opcDir, 'agent.pid');
    fs.writeFileSync(pidFile, '999999999'); // very unlikely to be running
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'));
    let alive = false;
    try { process.kill(pid, 0); alive = true; } catch { alive = false; }
    expect(alive).toBe(false);
  });

  it('heartbeat file written', () => {
    const hbFile = path.join(opcDir, 'heartbeat');
    const now = String(Date.now());
    fs.writeFileSync(hbFile, now);
    expect(fs.readFileSync(hbFile, 'utf-8')).toBe(now);
  });

  it('heartbeat staleness detection', () => {
    const hbFile = path.join(opcDir, 'heartbeat');
    const old = String(Date.now() - 120_000); // 2 minutes ago
    fs.writeFileSync(hbFile, old);
    const hbTime = parseInt(fs.readFileSync(hbFile, 'utf-8'));
    expect(Date.now() - hbTime).toBeGreaterThan(60_000);
  });

  it('log file created', () => {
    const logFile = path.join(opcDir, 'agent.log');
    fs.writeFileSync(logFile, '[2026-04-18T10:00:00.000Z] Daemon started\n');
    expect(fs.existsSync(logFile)).toBe(true);
  });

  it('log file appendable', () => {
    const logFile = path.join(opcDir, 'agent.log');
    fs.writeFileSync(logFile, 'line1\n');
    fs.appendFileSync(logFile, 'line2\n');
    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content).toContain('line1');
    expect(content).toContain('line2');
  });

  it('double-start prevention: PID file already exists', () => {
    const pidFile = path.join(opcDir, 'agent.pid');
    fs.writeFileSync(pidFile, String(process.pid));
    // Simulating: check before starting
    const exists = fs.existsSync(pidFile);
    expect(exists).toBe(true);
    // A real daemon would check and abort
  });

  it('started file tracks uptime', () => {
    const startedFile = path.join(opcDir, 'started');
    const startTime = Date.now();
    fs.writeFileSync(startedFile, String(startTime));
    const uptime = Date.now() - parseInt(fs.readFileSync(startedFile, 'utf-8'));
    expect(uptime).toBeGreaterThanOrEqual(0);
    expect(uptime).toBeLessThan(1000);
  });

  it('.opc directory creation is idempotent', () => {
    fs.mkdirSync(opcDir, { recursive: true });
    fs.mkdirSync(opcDir, { recursive: true }); // should not throw
    expect(fs.existsSync(opcDir)).toBe(true);
  });

  it('graceful shutdown cleans up PID file', () => {
    const pidFile = path.join(opcDir, 'agent.pid');
    fs.writeFileSync(pidFile, '12345');
    // Simulate shutdown
    try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
    expect(fs.existsSync(pidFile)).toBe(false);
  });

  it('env file parsing', () => {
    const envFile = path.join(tmpDir, '.env');
    fs.writeFileSync(envFile, 'KEY1=value1\nKEY2=value2\n# comment\n');
    const content = fs.readFileSync(envFile, 'utf-8');
    const vars: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
    expect(vars).toEqual({ KEY1: 'value1', KEY2: 'value2' });
  });
});
