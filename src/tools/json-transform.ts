import type { MCPTool, MCPToolResult } from './mcp';

/**
 * JSON Transform Tool — v0.8.0
 * Parse, query, and transform JSON data as an LLM function tool.
 */
export const JsonTransformTool: MCPTool = {
  name: 'json_transform',
  description: 'Parse, query (JSONPath-like), transform, flatten, or merge JSON data.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['parse', 'query', 'flatten', 'unflatten', 'merge', 'pick', 'omit', 'sort', 'filter', 'map_keys'],
        description: 'Operation to perform on the JSON data',
      },
      data: {
        description: 'JSON string or object to operate on',
      },
      data2: {
        description: 'Second JSON for merge operation',
      },
      path: {
        type: 'string',
        description: 'Dot-notation path for query (e.g. "users.0.name")',
      },
      keys: {
        type: 'array',
        items: { type: 'string' },
        description: 'Keys for pick/omit operations',
      },
      sortBy: {
        type: 'string',
        description: 'Key to sort array by',
      },
      order: {
        type: 'string',
        enum: ['asc', 'desc'],
      },
      filterKey: {
        type: 'string',
        description: 'Key to filter by',
      },
      filterValue: {
        description: 'Value to match for filter',
      },
    },
    required: ['operation', 'data'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    try {
      const op = String(input.operation);
      const data = typeof input.data === 'string' ? JSON.parse(input.data) : input.data;

      switch (op) {
        case 'parse':
          return { content: JSON.stringify(data, null, 2) };

        case 'query': {
          const path = String(input.path ?? '');
          const result = getByPath(data, path);
          return { content: JSON.stringify(result, null, 2) };
        }

        case 'flatten':
          return { content: JSON.stringify(flatten(data), null, 2) };

        case 'unflatten':
          return { content: JSON.stringify(unflatten(data as Record<string, unknown>), null, 2) };

        case 'merge': {
          const data2 = typeof input.data2 === 'string' ? JSON.parse(input.data2) : input.data2;
          return { content: JSON.stringify(deepMerge(data, data2), null, 2) };
        }

        case 'pick': {
          const keys = input.keys as string[] ?? [];
          const result: Record<string, unknown> = {};
          for (const k of keys) {
            if (k in data) result[k] = data[k];
          }
          return { content: JSON.stringify(result, null, 2) };
        }

        case 'omit': {
          const keys = new Set(input.keys as string[] ?? []);
          const result: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(data)) {
            if (!keys.has(k)) result[k] = v;
          }
          return { content: JSON.stringify(result, null, 2) };
        }

        case 'sort': {
          if (!Array.isArray(data)) return { content: 'Data must be an array for sort', isError: true };
          const sortBy = String(input.sortBy ?? '');
          const order = input.order === 'desc' ? -1 : 1;
          const sorted = [...data].sort((a, b) => {
            const va = sortBy ? a[sortBy] : a;
            const vb = sortBy ? b[sortBy] : b;
            return va < vb ? -order : va > vb ? order : 0;
          });
          return { content: JSON.stringify(sorted, null, 2) };
        }

        case 'filter': {
          if (!Array.isArray(data)) return { content: 'Data must be an array for filter', isError: true };
          const fk = String(input.filterKey ?? '');
          const fv = input.filterValue;
          const filtered = data.filter((item) => item[fk] === fv);
          return { content: JSON.stringify(filtered, null, 2) };
        }

        case 'map_keys': {
          // Rename keys: path is "old:new,old2:new2"
          const mapping = String(input.path ?? '').split(',').reduce((acc, pair) => {
            const [old, nw] = pair.split(':');
            if (old && nw) acc[old.trim()] = nw.trim();
            return acc;
          }, {} as Record<string, string>);
          const result: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(data)) {
            result[mapping[k] ?? k] = v;
          }
          return { content: JSON.stringify(result, null, 2) };
        }

        default:
          return { content: `Unknown operation: ${op}`, isError: true };
      }
    } catch (err) {
      return { content: `Error: ${(err as Error).message}`, isError: true };
    }
  },
};

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce((curr: any, key) => {
    if (curr == null) return undefined;
    const idx = Number(key);
    return Number.isInteger(idx) && Array.isArray(curr) ? curr[idx] : curr[key];
  }, obj);
}

function flatten(obj: unknown, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        Object.assign(result, flatten(v, key));
      } else {
        result[key] = v;
      }
    }
  }
  return result;
}

function unflatten(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const parts = key.split('.');
    let curr: any = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in curr)) curr[parts[i]] = {};
      curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = value;
  }
  return result;
}

function deepMerge(a: any, b: any): any {
  if (!b) return a;
  const result = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && result[k] && typeof result[k] === 'object') {
      result[k] = deepMerge(result[k], v);
    } else {
      result[k] = v;
    }
  }
  return result;
}
