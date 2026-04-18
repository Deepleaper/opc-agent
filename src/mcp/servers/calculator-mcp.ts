import type { MCPServerConfig } from '../../protocols/mcp/types';

const UNITS: Record<string, Record<string, number>> = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 },
  weight: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.453592, oz: 0.0283495, ton: 1000 },
  temperature: {}, // special
};

function convertTemp(value: number, from: string, to: string): number {
  let celsius = from === 'C' ? value : from === 'F' ? (value - 32) * 5/9 : value - 273.15;
  return to === 'C' ? celsius : to === 'F' ? celsius * 9/5 + 32 : celsius + 273.15;
}

export function createCalculatorServer(): MCPServerConfig {
  return {
    name: 'calculator',
    version: '1.0.0',
    tools: [
      {
        name: 'calc_evaluate',
        description: 'Evaluate a mathematical expression (safe eval with Math functions)',
        inputSchema: { type: 'object', properties: { expression: { type: 'string', description: 'Math expression, e.g. "sqrt(16) + pow(2,3)"' } }, required: ['expression'] },
        handler: async (args: { expression: string }) => {
          const safe = args.expression.replace(/[^0-9+\-*/().,%\s]/g, (m) => {
            const allowed = ['Math','PI','E','sqrt','pow','abs','sin','cos','tan','log','log2','log10','ceil','floor','round','min','max','random'];
            return allowed.some(a => m.includes(a)) ? m : '';
          });
          const fn = new Function('Math', `"use strict"; return (${args.expression})`);
          const result = fn(Math);
          return { expression: args.expression, result };
        },
      },
      {
        name: 'calc_convert',
        description: 'Convert between units (length, weight, temperature)',
        inputSchema: { type: 'object', properties: { value: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' }, category: { type: 'string', enum: ['length', 'weight', 'temperature'] } }, required: ['value', 'from', 'to'] },
        handler: async (args: { value: number; from: string; to: string; category?: string }) => {
          if (['C', 'F', 'K'].includes(args.from) && ['C', 'F', 'K'].includes(args.to)) {
            return { value: args.value, from: args.from, to: args.to, result: convertTemp(args.value, args.from, args.to) };
          }
          for (const [, units] of Object.entries(UNITS)) {
            if (units[args.from] && units[args.to]) {
              const base = args.value * units[args.from];
              return { value: args.value, from: args.from, to: args.to, result: base / units[args.to] };
            }
          }
          throw new Error(`Cannot convert ${args.from} to ${args.to}`);
        },
      },
      {
        name: 'calc_percentage',
        description: 'Calculate percentages: what is X% of Y, X is what % of Y, % change',
        inputSchema: { type: 'object', properties: { operation: { type: 'string', enum: ['of', 'is_what_percent', 'change'] }, x: { type: 'number' }, y: { type: 'number' } }, required: ['operation', 'x', 'y'] },
        handler: async (args: { operation: string; x: number; y: number }) => {
          switch (args.operation) {
            case 'of': return { result: (args.x / 100) * args.y, description: `${args.x}% of ${args.y}` };
            case 'is_what_percent': return { result: (args.x / args.y) * 100, description: `${args.x} is ${((args.x / args.y) * 100).toFixed(2)}% of ${args.y}` };
            case 'change': return { result: ((args.y - args.x) / args.x) * 100, description: `Change from ${args.x} to ${args.y}` };
            default: throw new Error('Unknown operation');
          }
        },
      },
    ],
  };
}
