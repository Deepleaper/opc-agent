#!/usr/bin/env node
/**
 * Daemon entry point — spawned by `opc start` as a detached background process.
 * Loads agent.yaml, creates runtime, starts all channels, writes heartbeat.
 */
import * as fs from 'fs';
import * as path from 'path';
import { AgentRuntime } from './core/runtime';

const OPC_DIR = path.resolve('.opc');
const HEARTBEAT_FILE = path.join(OPC_DIR, 'heartbeat');
const LOG_FILE = path.join(OPC_DIR, 'agent.log');
const PID_FILE = path.join(OPC_DIR, 'agent.pid');
const HEARTBEAT_INTERVAL = 30_000;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch { /* ignore */ }
}

async function main() {
  ensureDir(OPC_DIR);

  // Redirect stdout/stderr to log file
  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  process.stdout.write = logStream.write.bind(logStream) as any;
  process.stderr.write = logStream.write.bind(logStream) as any;

  // Write PID
  fs.writeFileSync(PID_FILE, String(process.pid));
  log(`Daemon started, PID=${process.pid}`);

  // Write start time for uptime calculation
  fs.writeFileSync(path.join(OPC_DIR, 'started'), String(Date.now()));

  // Heartbeat
  const heartbeatTimer = setInterval(() => {
    try { fs.writeFileSync(HEARTBEAT_FILE, String(Date.now())); } catch { /* ignore */ }
  }, HEARTBEAT_INTERVAL);
  fs.writeFileSync(HEARTBEAT_FILE, String(Date.now()));

  // Load .env
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = value;
      }
    } catch { /* ignore */ }
  }

  // Determine config file
  const configFile = fs.existsSync('agent.yaml') ? 'agent.yaml' : 'oad.yaml';

  const runtime = new AgentRuntime();
  await runtime.loadConfig(configFile);
  await runtime.initialize();
  await runtime.start();

  log(`Agent running (config=${configFile})`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log(`Received ${signal}, shutting down...`);
    clearInterval(heartbeatTimer);
    await runtime.stop();
    try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
    log('Daemon stopped');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // On Windows, handle the message-based kill
  process.on('message', (msg) => {
    if (msg === 'shutdown') shutdown('message:shutdown');
  });
}

main().catch((err) => {
  log(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
  process.exit(1);
});
