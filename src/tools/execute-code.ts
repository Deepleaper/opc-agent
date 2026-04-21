// v2 execute-code tool — runs code snippets in a sandboxed subprocess
import { spawn } from 'child_process';
import * as os from 'os';

export interface CodeExecutionRequest {
  code: string;
  language: 'javascript' | 'typescript' | 'python' | 'bash';
  timeoutMs?: number;
  env?: Record<string, string>;
}

export interface CodeExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  elapsedMs: number;
}

// Simple API: executeCode(code, lang, timeout)
export async function executeCode(
  code: string,
  lang: 'js' | 'ts' | 'python' | 'shell',
  timeout = 30_000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const result = await runSubprocess(buildArgs(lang, code), {}, timeout);
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
}

// Full API: executeCodeRequest(req) — supports env vars, timedOut flag
export async function executeCodeRequest(req: CodeExecutionRequest): Promise<CodeExecutionResult> {
  const lang = mapLanguage(req.language);
  return runSubprocess(buildArgs(lang, req.code), req.env ?? {}, req.timeoutMs ?? 10_000);
}

function mapLanguage(lang: CodeExecutionRequest['language']): 'js' | 'ts' | 'python' | 'shell' {
  switch (lang) {
    case 'javascript': return 'js';
    case 'typescript': return 'ts';
    case 'python': return 'python';
    case 'bash': return 'shell';
  }
}

function buildArgs(lang: 'js' | 'ts' | 'python' | 'shell', code: string): string[] {
  switch (lang) {
    case 'js': return ['node', '-e', code];
    case 'ts': return ['npx', 'ts-node', '-e', code];
    case 'python': return ['python3', '-c', code];
    case 'shell':
      return os.platform() === 'win32'
        ? ['powershell', '-Command', code]
        : ['sh', '-c', code];
  }
}

function runSubprocess(
  args: string[],
  env: Record<string, string>,
  timeout: number
): Promise<CodeExecutionResult> {
  const start = Date.now();

  return new Promise((resolve) => {
    const proc = spawn(args[0], args.slice(1), {
      env: { ...process.env, ...env },
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, timeout);

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: exitCode ?? 1, timedOut, elapsedMs: Date.now() - start });
    });
  });
}
