import type { MCPServerConfig } from '../../protocols/mcp/types';

const TIMEZONE_OFFSETS: Record<string, number> = {
  'UTC': 0, 'GMT': 0, 'EST': -5, 'EDT': -4, 'CST': -6, 'CDT': -5,
  'MST': -7, 'MDT': -6, 'PST': -8, 'PDT': -7, 'JST': 9, 'KST': 9,
  'CST8': 8, 'IST': 5.5, 'CET': 1, 'CEST': 2, 'AEST': 10, 'AEDT': 11,
  'Asia/Shanghai': 8, 'Asia/Tokyo': 9, 'America/New_York': -4,
  'America/Los_Angeles': -7, 'Europe/London': 1, 'Europe/Berlin': 2,
};

export function createDateTimeServer(): MCPServerConfig {
  return {
    name: 'datetime',
    version: '1.0.0',
    tools: [
      {
        name: 'dt_now',
        description: 'Get current date/time in a timezone',
        inputSchema: { type: 'object', properties: { timezone: { type: 'string', default: 'UTC' }, format: { type: 'string', enum: ['iso', 'unix', 'human'], default: 'iso' } } },
        handler: async (args: { timezone?: string; format?: string }) => {
          const offset = TIMEZONE_OFFSETS[args.timezone || 'UTC'] ?? 0;
          const now = new Date(Date.now() + offset * 3600000);
          const fmt = args.format || 'iso';
          return {
            iso: now.toISOString(),
            unix: Math.floor(now.getTime() / 1000),
            human: now.toUTCString(),
            timezone: args.timezone || 'UTC',
            offset,
          };
        },
      },
      {
        name: 'dt_diff',
        description: 'Calculate difference between two dates',
        inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, unit: { type: 'string', enum: ['days', 'hours', 'minutes', 'seconds'], default: 'days' } }, required: ['from', 'to'] },
        handler: async (args: { from: string; to: string; unit?: string }) => {
          const d1 = new Date(args.from).getTime();
          const d2 = new Date(args.to).getTime();
          const diffMs = d2 - d1;
          const divisors: Record<string, number> = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 };
          const unit = args.unit || 'days';
          return { from: args.from, to: args.to, difference: diffMs / divisors[unit], unit };
        },
      },
      {
        name: 'dt_add',
        description: 'Add duration to a date',
        inputSchema: { type: 'object', properties: { date: { type: 'string' }, amount: { type: 'number' }, unit: { type: 'string', enum: ['days', 'hours', 'minutes', 'seconds'] } }, required: ['date', 'amount', 'unit'] },
        handler: async (args: { date: string; amount: number; unit: string }) => {
          const d = new Date(args.date);
          const ms: Record<string, number> = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 };
          const result = new Date(d.getTime() + args.amount * ms[args.unit]);
          return { original: args.date, result: result.toISOString(), added: `${args.amount} ${args.unit}` };
        },
      },
      {
        name: 'dt_parse',
        description: 'Parse a date string and return components',
        inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] },
        handler: async (args: { date: string }) => {
          const d = new Date(args.date);
          if (isNaN(d.getTime())) throw new Error('Invalid date');
          return { iso: d.toISOString(), year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), dayOfWeek: d.toLocaleDateString('en', { weekday: 'long' }), unix: Math.floor(d.getTime() / 1000) };
        },
      },
    ],
  };
}
