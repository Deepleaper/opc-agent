import type { MCPServerConfig } from '../../protocols/mcp/types';
import { createFilesystemServer } from './filesystem';
import { createGitHubServer } from './github-mcp';
import { createDatabaseServer } from './database-mcp';
import { createWebServer } from './web-mcp';
import { createMemoryServer } from './memory-mcp';
import { createCalculatorServer } from './calculator-mcp';
import { createDateTimeServer } from './datetime-mcp';
import { createJsonServer } from './json-mcp';
import { createRegexServer } from './regex-mcp';
import { createCryptoServer } from './crypto-mcp';

export interface MCPServerInfo {
  name: string;
  description: string;
  version: string;
  toolCount: number;
}

interface ServerEntry {
  name: string;
  description: string;
  factory: () => MCPServerConfig;
}

const SERVERS: ServerEntry[] = [
  { name: 'filesystem', description: 'Read/write/list files in a sandboxed directory', factory: () => createFilesystemServer() },
  { name: 'github', description: 'GitHub API — repos, issues, files via fetch', factory: () => createGitHubServer() },
  { name: 'database', description: 'In-memory SQL-like database with tables and queries', factory: () => createDatabaseServer() },
  { name: 'web', description: 'Web fetch, text extraction, and search', factory: () => createWebServer() },
  { name: 'memory', description: 'Key-value memory store with tags and search', factory: () => createMemoryServer() },
  { name: 'calculator', description: 'Math evaluation, unit conversion, percentages', factory: () => createCalculatorServer() },
  { name: 'datetime', description: 'Time zones, date math, parsing, and formatting', factory: () => createDateTimeServer() },
  { name: 'json', description: 'JSON path query, transform, validate, and diff', factory: () => createJsonServer() },
  { name: 'regex', description: 'Regex test, match, replace, and split', factory: () => createRegexServer() },
  { name: 'crypto', description: 'Hash, HMAC, encrypt/decrypt, random generation', factory: () => createCryptoServer() },
];

export function getMCPServer(name: string): MCPServerConfig {
  const entry = SERVERS.find(s => s.name === name);
  if (!entry) throw new Error(`MCP server '${name}' not found. Available: ${SERVERS.map(s => s.name).join(', ')}`);
  return entry.factory();
}

export function listMCPServers(): MCPServerInfo[] {
  return SERVERS.map(s => {
    const config = s.factory();
    return { name: s.name, description: s.description, version: config.version, toolCount: config.tools?.length || 0 };
  });
}

export {
  createFilesystemServer,
  createGitHubServer,
  createDatabaseServer,
  createWebServer,
  createMemoryServer,
  createCalculatorServer,
  createDateTimeServer,
  createJsonServer,
  createRegexServer,
  createCryptoServer,
};
