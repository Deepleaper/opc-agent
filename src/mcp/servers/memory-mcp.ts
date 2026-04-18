import type { MCPServerConfig } from '../../protocols/mcp/types';

export function createMemoryServer(): MCPServerConfig {
  const store = new Map<string, { value: any; tags: string[]; created: string; updated: string }>();

  return {
    name: 'memory',
    version: '1.0.0',
    tools: [
      {
        name: 'memory_store',
        description: 'Store a key-value pair in memory with optional tags',
        inputSchema: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'any' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['key', 'value'] },
        handler: async (args: { key: string; value: any; tags?: string[] }) => {
          const now = new Date().toISOString();
          const existing = store.get(args.key);
          store.set(args.key, { value: args.value, tags: args.tags || [], created: existing?.created || now, updated: now });
          return { stored: args.key };
        },
      },
      {
        name: 'memory_recall',
        description: 'Recall a value by key',
        inputSchema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] },
        handler: async (args: { key: string }) => {
          const entry = store.get(args.key);
          if (!entry) return { found: false };
          return { found: true, ...entry };
        },
      },
      {
        name: 'memory_search',
        description: 'Search memory entries by tag or substring in key',
        inputSchema: { type: 'object', properties: { query: { type: 'string' }, tag: { type: 'string' } }, required: [] },
        handler: async (args: { query?: string; tag?: string }) => {
          let results = Array.from(store.entries()).map(([k, v]) => ({ key: k, ...v }));
          if (args.tag) results = results.filter(r => r.tags.includes(args.tag!));
          if (args.query) results = results.filter(r => r.key.includes(args.query!) || JSON.stringify(r.value).includes(args.query!));
          return { results, count: results.length };
        },
      },
      {
        name: 'memory_delete',
        description: 'Delete a memory entry',
        inputSchema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] },
        handler: async (args: { key: string }) => ({ deleted: store.delete(args.key) }),
      },
      {
        name: 'memory_list',
        description: 'List all memory keys',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => ({ keys: Array.from(store.keys()), count: store.size }),
      },
    ],
  };
}
