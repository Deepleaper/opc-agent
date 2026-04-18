import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getBuiltinTools, getBuiltinToolsByName, fileTool, datetimeTool, shellTool, webTool } from '../../src/tools/builtin';

describe('getBuiltinTools', () => {
  it('returns 4 tools', () => {
    const tools = getBuiltinTools();
    expect(tools).toHaveLength(31);
  });

  it('returns copies (not same array)', () => {
    const a = getBuiltinTools();
    const b = getBuiltinTools();
    expect(a).not.toBe(b);
  });

  it('contains file_operations tool', () => {
    const tools = getBuiltinTools();
    expect(tools.some(t => t.name === 'file_operations')).toBe(true);
  });

  it('contains datetime tool', () => {
    const tools = getBuiltinTools();
    expect(tools.some(t => t.name === 'datetime')).toBe(true);
  });
});

describe('getBuiltinToolsByName', () => {
  it('returns all when no names given', () => {
    expect(getBuiltinToolsByName()).toHaveLength(31);
    expect(getBuiltinToolsByName([])).toHaveLength(31);
  });

  it('filters by name correctly', () => {
    const tools = getBuiltinToolsByName(['datetime']);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('datetime');
  });

  it('returns empty for unknown names', () => {
    const tools = getBuiltinToolsByName(['nonexistent']);
    expect(tools).toHaveLength(0);
  });

  it('returns multiple matching tools', () => {
    const tools = getBuiltinToolsByName(['datetime', 'file_operations']);
    expect(tools).toHaveLength(2);
  });
});

describe('fileTool', () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'builtin-test-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('has name file_operations', () => {
    expect(fileTool.name).toBe('file_operations');
  });

  it('read existing file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'hello world');
    const result = await fileTool.execute({ action: 'read', path: 'test.txt' });
    expect(result.content).toContain('hello world');
    expect(result.isError).toBeFalsy();
  });

  it('read non-existent returns error', async () => {
    const result = await fileTool.execute({ action: 'read', path: 'nonexistent.txt' });
    expect(result.isError).toBe(true);
  });

  it('write creates file', async () => {
    const result = await fileTool.execute({ action: 'write', path: 'out.txt', content: 'data' });
    expect(result.isError).toBeFalsy();
    expect(fs.readFileSync(path.join(tmpDir, 'out.txt'), 'utf-8')).toBe('data');
  });

  it('list directory', async () => {
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'a');
    fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'b');
    const result = await fileTool.execute({ action: 'list', path: '.' });
    expect(result.content).toContain('a.txt');
    expect(result.content).toContain('b.txt');
  });

  it('exists returns true for existing file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'exists.txt'), 'yes');
    const result = await fileTool.execute({ action: 'exists', path: 'exists.txt' });
    expect(result.content).toContain('true');
  });

  it('exists returns false for missing file', async () => {
    const result = await fileTool.execute({ action: 'exists', path: 'nope.txt' });
    expect(result.content).toContain('false');
  });

  it('path escape blocked (../)', async () => {
    const result = await fileTool.execute({ action: 'read', path: '../../../etc/passwd' });
    expect(result.isError).toBe(true);
  });
});

describe('datetimeTool', () => {
  it('has name datetime', () => {
    expect(datetimeTool.name).toBe('datetime');
  });

  it('returns valid ISO string', async () => {
    const result = await datetimeTool.execute({});
    expect(result.isError).toBeFalsy();
    // Should contain a date-like string
    expect(result.content).toMatch(/\d{4}/);
  });
});

describe('shellTool', () => {
  it('has name shell_exec', () => {
    expect(shellTool.name).toBe('shell_exec');
  });
});

describe('webTool', () => {
  it('has name web_fetch', () => {
    expect(webTool.name).toBe('web_fetch');
  });
});
