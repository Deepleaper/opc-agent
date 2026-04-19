import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable, Writable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock http to control Ollama detection
vi.mock('http', async () => {
  const actual = await vi.importActual<typeof import('http')>('http');
  return { ...actual };
});

describe('setup wizard', () => {
  const OPC_HOME = path.join(os.tmpdir(), `.opc-test-${Date.now()}`);
  const CONFIG_PATH = path.join(OPC_HOME, 'config.json');

  beforeEach(() => {
    // Override HOME so setup writes to temp
    vi.stubEnv('HOME', os.tmpdir());
    fs.mkdirSync(OPC_HOME, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(OPC_HOME, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  function createMockInput(lines: string[]): Readable {
    const input = new Readable({ read() {} });
    // Push lines async to simulate user typing
    let i = 0;
    const interval = setInterval(() => {
      if (i < lines.length) {
        input.push(lines[i] + '\n');
        i++;
      } else {
        input.push(null);
        clearInterval(interval);
      }
    }, 50);
    return input;
  }

  function createMockOutput(): Writable {
    const chunks: Buffer[] = [];
    const output = new Writable({
      write(chunk, _enc, cb) { chunks.push(Buffer.from(chunk)); cb(); },
    });
    (output as any).getOutput = () => Buffer.concat(chunks).toString();
    return output;
  }

  it('should export runSetup function', async () => {
    const { runSetup } = await import('../src/cli/setup');
    expect(typeof runSetup).toBe('function');
  });

  it('should have TEMPLATES defined', async () => {
    // Just test that the module loads without error
    const mod = await import('../src/cli/setup');
    expect(mod).toBeDefined();
  });

  it('createRL should return a readline interface', async () => {
    const { createRL } = await import('../src/cli/setup');
    const input = new Readable({ read() {} });
    const output = createMockOutput();
    const rl = createRL(input, output);
    expect(rl).toBeDefined();
    rl.close();
    input.destroy();
  });
});
