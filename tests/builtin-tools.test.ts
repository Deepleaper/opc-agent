import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getBuiltinTools, getBuiltinToolsByName } from '../src/tools/builtin';
import { fileTool, shellTool, datetimeTool } from '../src/tools/builtin';

describe('getBuiltinTools', () => {
  it('returns 14 tools', () => {
    const tools = getBuiltinTools();
    expect(tools).toHaveLength(14);
    const names = tools.map(t => t.name);
    expect(names).toContain('file_operations');
    expect(names).toContain('web_fetch');
    expect(names).toContain('shell_exec');
    expect(names).toContain('datetime');
  });

  it('getBuiltinToolsByName filters correctly', () => {
    const tools = getBuiltinToolsByName(['datetime', 'file_operations']);
    expect(tools).toHaveLength(2);
  });

  it('getBuiltinToolsByName with no args returns all', () => {
    expect(getBuiltinToolsByName()).toHaveLength(14);
  });
});

describe('file_operations tool', () => {
  // file tool resolves paths relative to cwd, so use relative paths from a temp dir
  // Actually, it uses process.cwd() as workspace. Let's just test with paths relative to cwd.
  const testFile = `tmp-test-${Date.now()}.txt`;

  afterAll(() => {
    try { require('fs').unlinkSync(testFile); } catch {}
  });

  it('write and read a file', async () => {
    const writeRes = await fileTool.execute({ action: 'write', path: testFile, content: 'hello' });
    expect(writeRes.isError).toBe(false);

    const readRes = await fileTool.execute({ action: 'read', path: testFile });
    expect(readRes.isError).toBe(false);
    expect(readRes.content).toBe('hello');
  });

  it('list files', async () => {
    const res = await fileTool.execute({ action: 'list', path: '.' });
    expect(res.isError).toBe(false);
    expect(res.content).toContain('package.json');
  });

  it('exists check', async () => {
    const res = await fileTool.execute({ action: 'exists', path: testFile });
    expect(res.content).toBe('true');

    const res2 = await fileTool.execute({ action: 'exists', path: 'nope-does-not-exist.txt' });
    expect(res2.content).toBe('false');
  });

  it('rejects path outside workspace', async () => {
    const res = await fileTool.execute({ action: 'read', path: '../../etc/passwd' });
    expect(res.isError).toBe(true);
  });
});

describe('datetime tool', () => {
  it('returns valid JSON with iso field', async () => {
    const res = await datetimeTool.execute({});
    expect(res.isError).toBe(false);
    const parsed = JSON.parse(res.content);
    expect(parsed.iso).toBeDefined();
    expect(new Date(parsed.iso).toISOString()).toBe(parsed.iso);
  });
});

describe('shell_exec tool', () => {
  it('runs a command', async () => {
    const res = await shellTool.execute({ command: 'echo hello' });
    expect(res.isError).toBe(false);
    expect(res.content).toContain('hello');
  });
});
