import type { MCPServerConfig } from '../../protocols/mcp/types';

// In-memory SQL-like database (no external deps)
interface Table { columns: string[]; rows: any[][] }

export function createDatabaseServer(): MCPServerConfig {
  const tables = new Map<string, Table>();

  return {
    name: 'database',
    version: '1.0.0',
    tools: [
      {
        name: 'db_create_table',
        description: 'Create a table with specified columns',
        inputSchema: { type: 'object', properties: { table: { type: 'string' }, columns: { type: 'array', items: { type: 'string' } } }, required: ['table', 'columns'] },
        handler: async (args: { table: string; columns: string[] }) => {
          tables.set(args.table, { columns: args.columns, rows: [] });
          return { created: args.table, columns: args.columns };
        },
      },
      {
        name: 'db_insert',
        description: 'Insert a row into a table',
        inputSchema: { type: 'object', properties: { table: { type: 'string' }, values: { type: 'object' } }, required: ['table', 'values'] },
        handler: async (args: { table: string; values: Record<string, any> }) => {
          const t = tables.get(args.table);
          if (!t) throw new Error(`Table ${args.table} not found`);
          const row = t.columns.map(c => args.values[c] ?? null);
          t.rows.push(row);
          return { inserted: true, rowIndex: t.rows.length - 1 };
        },
      },
      {
        name: 'db_query',
        description: 'Query a table with optional where clause',
        inputSchema: { type: 'object', properties: { table: { type: 'string' }, where: { type: 'object' }, limit: { type: 'number' } }, required: ['table'] },
        handler: async (args: { table: string; where?: Record<string, any>; limit?: number }) => {
          const t = tables.get(args.table);
          if (!t) throw new Error(`Table ${args.table} not found`);
          let results = t.rows.map(row => {
            const obj: Record<string, any> = {};
            t.columns.forEach((c, i) => obj[c] = row[i]);
            return obj;
          });
          if (args.where) {
            results = results.filter(row => Object.entries(args.where!).every(([k, v]) => row[k] === v));
          }
          if (args.limit) results = results.slice(0, args.limit);
          return { rows: results, count: results.length };
        },
      },
      {
        name: 'db_list_tables',
        description: 'List all tables',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
          return { tables: Array.from(tables.entries()).map(([name, t]) => ({ name, columns: t.columns, rowCount: t.rows.length })) };
        },
      },
      {
        name: 'db_drop_table',
        description: 'Drop a table',
        inputSchema: { type: 'object', properties: { table: { type: 'string' } }, required: ['table'] },
        handler: async (args: { table: string }) => {
          const existed = tables.delete(args.table);
          return { dropped: existed };
        },
      },
    ],
  };
}
