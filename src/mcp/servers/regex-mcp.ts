import type { MCPServerConfig } from '../../protocols/mcp/types';

export function createRegexServer(): MCPServerConfig {
  return {
    name: 'regex',
    version: '1.0.0',
    tools: [
      {
        name: 'regex_test',
        description: 'Test if a string matches a regex pattern',
        inputSchema: { type: 'object', properties: { pattern: { type: 'string' }, flags: { type: 'string', default: '' }, text: { type: 'string' } }, required: ['pattern', 'text'] },
        handler: async (args: { pattern: string; flags?: string; text: string }) => {
          const re = new RegExp(args.pattern, args.flags || '');
          return { matches: re.test(args.text), pattern: args.pattern };
        },
      },
      {
        name: 'regex_match',
        description: 'Find all matches of a regex in text',
        inputSchema: { type: 'object', properties: { pattern: { type: 'string' }, flags: { type: 'string', default: 'g' }, text: { type: 'string' } }, required: ['pattern', 'text'] },
        handler: async (args: { pattern: string; flags?: string; text: string }) => {
          const re = new RegExp(args.pattern, args.flags || 'g');
          const matches: { match: string; index: number; groups?: Record<string, string> }[] = [];
          let m;
          while ((m = re.exec(args.text)) !== null) {
            matches.push({ match: m[0], index: m.index, groups: m.groups });
            if (!re.global) break;
          }
          return { matches, count: matches.length };
        },
      },
      {
        name: 'regex_replace',
        description: 'Replace matches in text using regex',
        inputSchema: { type: 'object', properties: { pattern: { type: 'string' }, flags: { type: 'string', default: 'g' }, text: { type: 'string' }, replacement: { type: 'string' } }, required: ['pattern', 'text', 'replacement'] },
        handler: async (args: { pattern: string; flags?: string; text: string; replacement: string }) => {
          const re = new RegExp(args.pattern, args.flags || 'g');
          return { result: args.text.replace(re, args.replacement) };
        },
      },
      {
        name: 'regex_split',
        description: 'Split text by regex pattern',
        inputSchema: { type: 'object', properties: { pattern: { type: 'string' }, text: { type: 'string' }, limit: { type: 'number' } }, required: ['pattern', 'text'] },
        handler: async (args: { pattern: string; text: string; limit?: number }) => {
          const re = new RegExp(args.pattern);
          const parts = args.text.split(re, args.limit);
          return { parts, count: parts.length };
        },
      },
    ],
  };
}
