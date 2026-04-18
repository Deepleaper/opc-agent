import { describe, it, expect, beforeEach } from 'vitest';
import { ContextRefResolver } from '../src/core/context-refs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ContextRefResolver.parseRefs', () => {
  let resolver: ContextRefResolver;
  beforeEach(() => { resolver = new ContextRefResolver(); });

  it('parses @file references', () => {
    const refs = resolver.parseRefs('Check @file:src/index.ts please');
    expect(refs).toEqual([{ type: 'file', path: 'src/index.ts' }]);
  });

  it('parses @folder references', () => {
    const refs = resolver.parseRefs('Look at @folder:src/');
    expect(refs).toEqual([{ type: 'folder', path: 'src/' }]);
  });

  it('parses @url references', () => {
    const refs = resolver.parseRefs('See @url:https://example.com/api');
    expect(refs).toEqual([{ type: 'url', path: 'https://example.com/api' }]);
  });

  it('parses @git-diff', () => {
    const refs = resolver.parseRefs('Show me @git-diff');
    expect(refs).toEqual([{ type: 'git-diff', path: 'git-diff' }]);
  });

  it('parses @git-log with count', () => {
    const refs = resolver.parseRefs('Show @git-log:5');
    expect(refs).toEqual([{ type: 'git-log', path: '5' }]);
  });

  it('parses @git-log without count defaults to 10', () => {
    const refs = resolver.parseRefs('Show @git-log');
    expect(refs).toEqual([{ type: 'git-log', path: '10' }]);
  });

  it('parses multiple refs', () => {
    const refs = resolver.parseRefs('Check @file:a.ts and @file:b.ts and @git-diff');
    expect(refs).toHaveLength(3);
    expect(refs[0].type).toBe('file');
    expect(refs[1].type).toBe('file');
    expect(refs[2].type).toBe('git-diff');
  });

  it('returns empty for no refs', () => {
    expect(resolver.parseRefs('no refs here')).toEqual([]);
  });
});

describe('ContextRefResolver.resolveRefs', () => {
  let resolver: ContextRefResolver;
  let tmpDir: string;

  beforeEach(() => {
    resolver = new ContextRefResolver();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-ref-'));
    fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'hello world');
    fs.mkdirSync(path.join(tmpDir, 'sub'));
    fs.writeFileSync(path.join(tmpDir, 'sub', 'nested.txt'), 'nested');
  });

  it('resolves file ref', async () => {
    const refs = await resolver.resolveRefs([{ type: 'file', path: path.join(tmpDir, 'test.txt') }]);
    expect(refs[0].content).toBe('hello world');
  });

  it('resolves folder ref', async () => {
    const refs = await resolver.resolveRefs([{ type: 'folder', path: tmpDir }]);
    expect(refs[0].content).toContain('test.txt');
    expect(refs[0].content).toContain('sub');
  });

  it('handles file not found gracefully', async () => {
    const refs = await resolver.resolveRefs([{ type: 'file', path: '/nonexistent/file.txt' }]);
    expect(refs[0].content).toContain('Error');
  });

  it('truncates long content', async () => {
    const longContent = 'x'.repeat(6000);
    fs.writeFileSync(path.join(tmpDir, 'long.txt'), longContent);
    const refs = await resolver.resolveRefs([{ type: 'file', path: path.join(tmpDir, 'long.txt') }]);
    expect(refs[0].content!.length).toBeLessThan(6000);
    expect(refs[0].content).toContain('truncated');
  });
});

describe('ContextRefResolver.injectRefs', () => {
  let resolver: ContextRefResolver;
  beforeEach(() => { resolver = new ContextRefResolver(); });

  it('injects context before last user message', () => {
    const messages = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'second' },
    ];
    const refs = [{ type: 'file' as const, path: 'a.ts', content: 'code here' }];
    const result = resolver.injectRefs(messages, refs);
    expect(result).toHaveLength(4);
    expect(result[2].role).toBe('system');
    expect(result[2].content).toContain('@file:a.ts');
    expect(result[3].content).toBe('second');
  });

  it('returns original messages if no refs', () => {
    const messages = [{ role: 'user', content: 'hi' }];
    const result = resolver.injectRefs(messages, []);
    expect(result).toEqual(messages);
  });

  it('skips refs without content', () => {
    const messages = [{ role: 'user', content: 'hi' }];
    const refs = [{ type: 'file' as const, path: 'a.ts' }];
    const result = resolver.injectRefs(messages, refs);
    expect(result).toEqual(messages);
  });
});
