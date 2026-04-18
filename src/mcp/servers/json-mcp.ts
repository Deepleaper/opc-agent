import type { MCPServerConfig } from '../../protocols/mcp/types';

function jsonPathQuery(obj: any, path: string): any[] {
  const parts = path.replace(/^\$\.?/, '').split('.');
  let current: any[] = [obj];
  for (const part of parts) {
    if (!part) continue;
    const next: any[] = [];
    for (const item of current) {
      if (part === '*') {
        if (Array.isArray(item)) next.push(...item);
        else if (typeof item === 'object' && item) next.push(...Object.values(item));
      } else if (part.match(/^\[(\d+)\]$/)) {
        const idx = parseInt(part.slice(1, -1));
        if (Array.isArray(item) && item[idx] !== undefined) next.push(item[idx]);
      } else {
        if (item && typeof item === 'object' && part in item) next.push(item[part]);
      }
    }
    current = next;
  }
  return current;
}

export function createJsonServer(): MCPServerConfig {
  return {
    name: 'json',
    version: '1.0.0',
    tools: [
      {
        name: 'json_query',
        description: 'Query JSON data using dot-notation path (e.g. "users.0.name", "items.*")',
        inputSchema: { type: 'object', properties: { data: { description: 'JSON string or object' }, path: { type: 'string', description: 'Dot-notation path' } }, required: ['data', 'path'] },
        handler: async (args: { data: any; path: string }) => {
          const obj = typeof args.data === 'string' ? JSON.parse(args.data) : args.data;
          return { results: jsonPathQuery(obj, args.path) };
        },
      },
      {
        name: 'json_transform',
        description: 'Transform JSON: pick fields, rename keys, flatten',
        inputSchema: { type: 'object', properties: { data: {}, operation: { type: 'string', enum: ['pick', 'omit', 'flatten', 'keys', 'values'] }, fields: { type: 'array', items: { type: 'string' } } }, required: ['data', 'operation'] },
        handler: async (args: { data: any; operation: string; fields?: string[] }) => {
          const obj = typeof args.data === 'string' ? JSON.parse(args.data) : args.data;
          switch (args.operation) {
            case 'pick': {
              const result: any = {};
              for (const f of args.fields || []) if (f in obj) result[f] = obj[f];
              return { result };
            }
            case 'omit': {
              const result = { ...obj };
              for (const f of args.fields || []) delete result[f];
              return { result };
            }
            case 'flatten': {
              const result: Record<string, any> = {};
              const recurse = (o: any, prefix: string) => {
                for (const [k, v] of Object.entries(o)) {
                  const key = prefix ? `${prefix}.${k}` : k;
                  if (v && typeof v === 'object' && !Array.isArray(v)) recurse(v, key);
                  else result[key] = v;
                }
              };
              recurse(obj, '');
              return { result };
            }
            case 'keys': return { result: Object.keys(obj) };
            case 'values': return { result: Object.values(obj) };
            default: throw new Error(`Unknown operation: ${args.operation}`);
          }
        },
      },
      {
        name: 'json_validate',
        description: 'Check if a string is valid JSON',
        inputSchema: { type: 'object', properties: { data: { type: 'string' } }, required: ['data'] },
        handler: async (args: { data: string }) => {
          try { JSON.parse(args.data); return { valid: true }; } catch (e: any) { return { valid: false, error: e.message }; }
        },
      },
      {
        name: 'json_diff',
        description: 'Compare two JSON objects and return differences',
        inputSchema: { type: 'object', properties: { a: {}, b: {} }, required: ['a', 'b'] },
        handler: async (args: { a: any; b: any }) => {
          const a = typeof args.a === 'string' ? JSON.parse(args.a) : args.a;
          const b = typeof args.b === 'string' ? JSON.parse(args.b) : args.b;
          const diffs: { path: string; a: any; b: any }[] = [];
          const compare = (x: any, y: any, path: string) => {
            if (x === y) return;
            if (typeof x !== typeof y || typeof x !== 'object' || !x || !y) { diffs.push({ path, a: x, b: y }); return; }
            const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
            for (const k of keys) compare(x[k], y[k], path ? `${path}.${k}` : k);
          };
          compare(a, b, '');
          return { equal: diffs.length === 0, differences: diffs };
        },
      },
    ],
  };
}
