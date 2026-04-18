import * as fs from 'fs';
import * as path from 'path';
import type { MCPTool, MCPToolResult } from '../mcp';
import type { AgentContext } from '../../core/types';

function resolveSafe(basePath: string, targetPath: string): string | null {
  const resolved = path.resolve(basePath, targetPath);
  if (!resolved.startsWith(path.resolve(basePath))) return null;
  return resolved;
}

function searchFiles(dir: string, query: string, results: string[] = [], maxResults = 20): string[] {
  if (results.length >= maxResults) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxResults) break;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        searchFiles(full, query, results, maxResults);
      } else if (entry.isFile()) {
        try {
          const content = fs.readFileSync(full, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(query)) {
              results.push(`${full}:${i + 1}: ${lines[i].trim()}`);
              if (results.length >= maxResults) break;
            }
          }
        } catch { /* skip binary/unreadable */ }
      }
    }
  } catch { /* skip inaccessible dirs */ }
  return results;
}

export const fileTool: MCPTool = {
  name: 'file_operations',
  description: 'Read, write, list, and search files in the workspace',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['read', 'write', 'list', 'search', 'exists'] },
      path: { type: 'string' },
      content: { type: 'string' },
      query: { type: 'string' },
    },
    required: ['action'],
  },
  async execute(input: Record<string, unknown>, context?: AgentContext): Promise<MCPToolResult> {
    const action = input.action as string;
    const workspace = process.cwd();
    const targetPath = input.path as string | undefined;

    if (action === 'search') {
      const query = input.query as string;
      if (!query) return { content: 'query is required for search', isError: true };
      const results = searchFiles(workspace, query);
      return { content: results.length ? results.join('\n') : 'No matches found', isError: false };
    }

    if (action === 'list') {
      const dir = targetPath ? resolveSafe(workspace, targetPath) : workspace;
      if (!dir) return { content: 'Path outside workspace', isError: true };
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const listing = entries.map(e => `${e.isDirectory() ? '[DIR] ' : ''}${e.name}`).join('\n');
        return { content: listing || '(empty directory)', isError: false };
      } catch (err) {
        return { content: `Error listing directory: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    }

    if (!targetPath) return { content: 'path is required', isError: true };
    const resolved = resolveSafe(workspace, targetPath);
    if (!resolved) return { content: 'Path outside workspace', isError: true };

    switch (action) {
      case 'read': {
        try {
          const content = fs.readFileSync(resolved, 'utf-8');
          return { content: content.slice(0, 50000), isError: false };
        } catch (err) {
          return { content: `Error reading file: ${err instanceof Error ? err.message : String(err)}`, isError: true };
        }
      }
      case 'write': {
        const content = input.content as string;
        if (content === undefined) return { content: 'content is required for write', isError: true };
        try {
          fs.mkdirSync(path.dirname(resolved), { recursive: true });
          fs.writeFileSync(resolved, content, 'utf-8');
          return { content: `Written ${content.length} bytes to ${targetPath}`, isError: false };
        } catch (err) {
          return { content: `Error writing file: ${err instanceof Error ? err.message : String(err)}`, isError: true };
        }
      }
      case 'exists': {
        return { content: String(fs.existsSync(resolved)), isError: false };
      }
      default:
        return { content: `Unknown action: ${action}`, isError: true };
    }
  },
};
