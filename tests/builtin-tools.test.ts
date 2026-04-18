import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getBuiltinTools, getBuiltinToolsByName } from '../src/tools/builtin';
import { fileTool, shellTool, datetimeTool, webTool } from '../src/tools/builtin';

describe('getBuiltinTools', () => {
  it('returns 4 tools', () => {
    const tools = getBuiltinTools();
    expect(tools).toHaveLength(4);
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
    expect(getBuiltinToolsByName()).toHaveLength(4);
  });
});

describe('file_operations tool', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'opc-test-'));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('write and read a file', async () => {
    const writeRes = await fileTool.execute({ action: 'write', path: join(tmpDir, 'test.txt'), content: 'hello' });
    expect(writeRes.isError).toBe(false);

    const readRes = await fileTool.execute({ action: 'read', path: join(tmpDir, 'test.txt') });
    expect(readRes.isError).toBe(false);
    expect(readRes.content).toBe('hello');
  });

  it('list files', async () => {
    const res = await fileTool.execute({ action: 'list', path: tmpDir });
    expect(res.isError).toBe(false);
    expect(res.content).toContain('test.txt');
  });

  it('exists check', async () => {
    const res = await fileTool.execute({ action: 'exists', path: join(tmpDir, 'test.txt') });
    expect(res.content).toBe('true');

    const res2 = await fileTool.execute({ action: 'exists', path: join(tmpDir, 'nope.txt') });
    expect(res2.content).toBe('false');
  });
});

describe('datetime tool', () => {
  it('returns ISO string', async () => {
    const res = await datetimeTool.execute({});
    expect(res.isError).toBe(false);
    expect(new Date(res.content).toISOString()).toBe(res.content);
  });
});

describe('shell_exec tool', () => {
  it('runs a command', async () => {
    const res = await shellTool.execute({ command: 'echo hello' });
    expect(res.isError).toBe(false);
    expect(res.content).toContain('hello');
  });
});
