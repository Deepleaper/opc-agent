import * as fs from 'fs';
import * as path from 'path';
import type { MCPServerConfig } from '../../protocols/mcp/types';

export function createFilesystemServer(rootDir: string = process.cwd()): MCPServerConfig {
  const resolve = (p: string) => {
    const resolved = path.resolve(rootDir, p);
    if (!resolved.startsWith(path.resolve(rootDir))) throw new Error('Path traversal not allowed');
    return resolved;
  };

  return {
    name: 'filesystem',
    version: '1.0.0',
    tools: [
      {
        name: 'fs_read',
        description: 'Read file contents as UTF-8 text',
        inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'File path relative to root' } }, required: ['path'] },
        handler: async (args: { path: string }) => {
          return { content: fs.readFileSync(resolve(args.path), 'utf-8') };
        },
      },
      {
        name: 'fs_write',
        description: 'Write content to a file (creates directories as needed)',
        inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
        handler: async (args: { path: string; content: string }) => {
          const target = resolve(args.path);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, args.content, 'utf-8');
          return { written: target };
        },
      },
      {
        name: 'fs_list',
        description: 'List files and directories',
        inputSchema: { type: 'object', properties: { path: { type: 'string', default: '.' }, recursive: { type: 'boolean', default: false } }, required: [] },
        handler: async (args: { path?: string; recursive?: boolean }) => {
          const dir = resolve(args.path || '.');
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          const result = entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'directory' : 'file' }));
          return { entries: result };
        },
      },
      {
        name: 'fs_stat',
        description: 'Get file/directory metadata',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        handler: async (args: { path: string }) => {
          const stat = fs.statSync(resolve(args.path));
          return { size: stat.size, isFile: stat.isFile(), isDirectory: stat.isDirectory(), modified: stat.mtime.toISOString() };
        },
      },
      {
        name: 'fs_delete',
        description: 'Delete a file',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        handler: async (args: { path: string }) => {
          fs.unlinkSync(resolve(args.path));
          return { deleted: true };
        },
      },
    ],
  };
}
