import { describe, it, expect } from 'vitest';
import { listMCPServers, getMCPServer } from '../src/mcp/servers';
import { createFilesystemServer } from '../src/mcp/servers/filesystem';
import { createDatabaseServer } from '../src/mcp/servers/database-mcp';
import { createMemoryServer } from '../src/mcp/servers/memory-mcp';
import { createCalculatorServer } from '../src/mcp/servers/calculator-mcp';
import { createDateTimeServer } from '../src/mcp/servers/datetime-mcp';
import { createJsonServer } from '../src/mcp/servers/json-mcp';
import { createRegexServer } from '../src/mcp/servers/regex-mcp';
import { createCryptoServer } from '../src/mcp/servers/crypto-mcp';
import { generateChatWidget } from '../src/ui/components';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ─── Registry Tests ─────────────────────────────────
describe('MCP Server Registry', () => {
  it('lists 10 servers', () => {
    const servers = listMCPServers();
    expect(servers).toHaveLength(10);
  });

  it('each server has name, description, version, toolCount', () => {
    for (const s of listMCPServers()) {
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.version).toBeTruthy();
      expect(s.toolCount).toBeGreaterThan(0);
    }
  });

  it('getMCPServer returns valid config', () => {
    const config = getMCPServer('calculator');
    expect(config.name).toBe('calculator');
    expect(config.tools!.length).toBeGreaterThan(0);
  });

  it('getMCPServer throws for unknown', () => {
    expect(() => getMCPServer('nonexistent')).toThrow('not found');
  });
});

// ─── Filesystem Server ──────────────────────────────
describe('Filesystem MCP', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-fs-'));
  const server = createFilesystemServer(tmpDir);

  it('tools/list returns 5 tools', () => {
    expect(server.tools).toHaveLength(5);
    expect(server.tools!.map(t => t.name)).toContain('fs_read');
  });

  it('fs_write + fs_read round-trip', async () => {
    const write = server.tools!.find(t => t.name === 'fs_write')!;
    const read = server.tools!.find(t => t.name === 'fs_read')!;
    await write.handler({ path: 'test.txt', content: 'hello mcp' });
    const result = await read.handler({ path: 'test.txt' });
    expect(result.content).toBe('hello mcp');
  });

  it('fs_list returns entries', async () => {
    const list = server.tools!.find(t => t.name === 'fs_list')!;
    const result = await list.handler({});
    expect(result.entries.length).toBeGreaterThan(0);
  });
});

// ─── Database MCP ───────────────────────────────────
describe('Database MCP', () => {
  const server = createDatabaseServer();

  it('tools/list returns 5 tools', () => {
    expect(server.tools).toHaveLength(5);
  });

  it('create table, insert, query', async () => {
    const create = server.tools!.find(t => t.name === 'db_create_table')!;
    const insert = server.tools!.find(t => t.name === 'db_insert')!;
    const query = server.tools!.find(t => t.name === 'db_query')!;
    await create.handler({ table: 'users', columns: ['name', 'age'] });
    await insert.handler({ table: 'users', values: { name: 'Alice', age: 30 } });
    const result = await query.handler({ table: 'users' });
    expect(result.count).toBe(1);
    expect(result.rows[0].name).toBe('Alice');
  });
});

// ─── Memory MCP ─────────────────────────────────────
describe('Memory MCP', () => {
  const server = createMemoryServer();

  it('store and recall', async () => {
    const store = server.tools!.find(t => t.name === 'memory_store')!;
    const recall = server.tools!.find(t => t.name === 'memory_recall')!;
    await store.handler({ key: 'foo', value: 'bar', tags: ['test'] });
    const result = await recall.handler({ key: 'foo' });
    expect(result.found).toBe(true);
    expect(result.value).toBe('bar');
  });

  it('search by tag', async () => {
    const search = server.tools!.find(t => t.name === 'memory_search')!;
    const result = await search.handler({ tag: 'test' });
    expect(result.count).toBeGreaterThan(0);
  });
});

// ─── Calculator MCP ─────────────────────────────────
describe('Calculator MCP', () => {
  const server = createCalculatorServer();

  it('evaluate expression', async () => {
    const calc = server.tools!.find(t => t.name === 'calc_evaluate')!;
    const result = await calc.handler({ expression: '2 + 3 * 4' });
    expect(result.result).toBe(14);
  });

  it('convert temperature', async () => {
    const conv = server.tools!.find(t => t.name === 'calc_convert')!;
    const result = await conv.handler({ value: 100, from: 'C', to: 'F' });
    expect(result.result).toBe(212);
  });
});

// ─── DateTime MCP ───────────────────────────────────
describe('DateTime MCP', () => {
  const server = createDateTimeServer();

  it('dt_now returns iso string', async () => {
    const now = server.tools!.find(t => t.name === 'dt_now')!;
    const result = await now.handler({});
    expect(result.iso).toBeTruthy();
  });

  it('dt_diff calculates correctly', async () => {
    const diff = server.tools!.find(t => t.name === 'dt_diff')!;
    const result = await diff.handler({ from: '2024-01-01', to: '2024-01-02', unit: 'days' });
    expect(result.difference).toBe(1);
  });
});

// ─── JSON MCP ───────────────────────────────────────
describe('JSON MCP', () => {
  const server = createJsonServer();

  it('json_query dot-notation', async () => {
    const query = server.tools!.find(t => t.name === 'json_query')!;
    const result = await query.handler({ data: { users: [{ name: 'Alice' }] }, path: 'users.0.name' });
    expect(result.results).toContain('Alice');
  });

  it('json_validate', async () => {
    const validate = server.tools!.find(t => t.name === 'json_validate')!;
    expect((await validate.handler({ data: '{"a":1}' })).valid).toBe(true);
    expect((await validate.handler({ data: 'not json' })).valid).toBe(false);
  });

  it('json_diff finds differences', async () => {
    const diff = server.tools!.find(t => t.name === 'json_diff')!;
    const result = await diff.handler({ a: { x: 1 }, b: { x: 2 } });
    expect(result.equal).toBe(false);
    expect(result.differences).toHaveLength(1);
  });
});

// ─── Regex MCP ──────────────────────────────────────
describe('Regex MCP', () => {
  const server = createRegexServer();

  it('regex_test', async () => {
    const test = server.tools!.find(t => t.name === 'regex_test')!;
    expect((await test.handler({ pattern: '\\d+', text: 'abc123' })).matches).toBe(true);
    expect((await test.handler({ pattern: '\\d+', text: 'abc' })).matches).toBe(false);
  });

  it('regex_match finds all', async () => {
    const match = server.tools!.find(t => t.name === 'regex_match')!;
    const result = await match.handler({ pattern: '\\d+', text: 'a1b22c333' });
    expect(result.count).toBe(3);
  });

  it('regex_replace', async () => {
    const replace = server.tools!.find(t => t.name === 'regex_replace')!;
    const result = await replace.handler({ pattern: '\\d', text: 'a1b2', replacement: 'X' });
    expect(result.result).toBe('aXbX');
  });
});

// ─── Crypto MCP ─────────────────────────────────────
describe('Crypto MCP', () => {
  const server = createCryptoServer();

  it('crypto_hash sha256', async () => {
    const hash = server.tools!.find(t => t.name === 'crypto_hash')!;
    const result = await hash.handler({ text: 'hello' });
    expect(result.hash).toBeTruthy();
    expect(result.algorithm).toBe('sha256');
  });

  it('crypto_random uuid', async () => {
    const random = server.tools!.find(t => t.name === 'crypto_random')!;
    const result = await random.handler({ type: 'uuid' });
    expect(result.value).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('crypto_encrypt + decrypt round-trip', async () => {
    const encrypt = server.tools!.find(t => t.name === 'crypto_encrypt')!;
    const decrypt = server.tools!.find(t => t.name === 'crypto_decrypt')!;
    const enc = await encrypt.handler({ text: 'secret', password: 'pass123' });
    const dec = await decrypt.handler({ encrypted: enc.encrypted, password: 'pass123', iv: enc.iv, tag: enc.tag });
    expect(dec.decrypted).toBe('secret');
  });
});

// ─── Chat Widget ────────────────────────────────────
describe('Chat Widget', () => {
  it('generates valid HTML string', () => {
    const html = generateChatWidget({ endpoint: '/api/chat' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('/api/chat');
    expect(html).toContain('OPC Chat');
  });

  it('respects custom title and theme', () => {
    const html = generateChatWidget({ endpoint: '/chat', theme: 'light', title: 'My Bot' });
    expect(html).toContain('My Bot');
    expect(html).toContain('#ffffff');
  });

  it('dark theme uses dark colors', () => {
    const html = generateChatWidget({ endpoint: '/chat', theme: 'dark' });
    expect(html).toContain('#1a1a2e');
  });
});

// ─── Playground API (static check) ──────────────────
describe('Playground page', () => {
  it('studio-ui index.html contains playground page', () => {
    const html = fs.readFileSync(path.join(__dirname, '../src/studio-ui/index.html'), 'utf-8');
    expect(html).toContain('id="page-assistant"');
    expect(html).toContain('assistant-input');
    expect(html).toContain('assistant-messages');
  });
});

// ─── All MCP servers have proper tool schemas ───────
describe('MCP tool schemas', () => {
  it('every tool has name, description, inputSchema, handler', () => {
    const servers = listMCPServers();
    for (const info of servers) {
      const config = getMCPServer(info.name);
      for (const tool of config.tools || []) {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeTruthy();
        expect(typeof tool.handler).toBe('function');
      }
    }
  });
});
