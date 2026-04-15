import type { MCPTool, MCPToolResult } from './mcp';

/**
 * DateTime Tool — v0.8.0
 * Date/time operations as an LLM function tool.
 */
export const DateTimeTool: MCPTool = {
  name: 'datetime',
  description: 'Get current date/time, format dates, calculate date differences, or add/subtract time.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['now', 'format', 'diff', 'add', 'parse'],
        description: 'Operation to perform',
      },
      date: {
        type: 'string',
        description: 'Date string (ISO 8601 or common format)',
      },
      date2: {
        type: 'string',
        description: 'Second date for diff operation',
      },
      format: {
        type: 'string',
        description: 'Output format: iso, date, time, datetime, unix, relative',
      },
      amount: {
        type: 'number',
        description: 'Amount to add (can be negative)',
      },
      unit: {
        type: 'string',
        enum: ['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'],
        description: 'Unit for add operation',
      },
      timezone: {
        type: 'string',
        description: 'IANA timezone (e.g. Asia/Shanghai, America/New_York)',
      },
    },
    required: ['operation'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    try {
      const op = String(input.operation);
      const tz = input.timezone as string | undefined;

      switch (op) {
        case 'now': {
          const now = new Date();
          const fmt = (input.format as string) ?? 'iso';
          return { content: formatDate(now, fmt, tz) };
        }

        case 'format': {
          const d = parseDate(input.date as string);
          const fmt = (input.format as string) ?? 'iso';
          return { content: formatDate(d, fmt, tz) };
        }

        case 'diff': {
          const d1 = parseDate(input.date as string);
          const d2 = input.date2 ? parseDate(input.date2 as string) : new Date();
          const diffMs = d2.getTime() - d1.getTime();
          const days = Math.floor(Math.abs(diffMs) / 86400000);
          const hours = Math.floor((Math.abs(diffMs) % 86400000) / 3600000);
          const mins = Math.floor((Math.abs(diffMs) % 3600000) / 60000);
          const sign = diffMs < 0 ? '-' : '';
          return {
            content: JSON.stringify({
              milliseconds: diffMs,
              readable: `${sign}${days}d ${hours}h ${mins}m`,
              days: diffMs / 86400000,
            }),
          };
        }

        case 'add': {
          const d = input.date ? parseDate(input.date as string) : new Date();
          const amount = Number(input.amount ?? 0);
          const unit = String(input.unit ?? 'days');
          const result = addTime(d, amount, unit);
          const fmt = (input.format as string) ?? 'iso';
          return { content: formatDate(result, fmt, tz) };
        }

        case 'parse': {
          const d = parseDate(input.date as string);
          return {
            content: JSON.stringify({
              iso: d.toISOString(),
              unix: d.getTime(),
              year: d.getFullYear(),
              month: d.getMonth() + 1,
              day: d.getDate(),
              weekday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()],
            }),
          };
        }

        default:
          return { content: `Unknown operation: ${op}`, isError: true };
      }
    } catch (err) {
      return { content: `Error: ${(err as Error).message}`, isError: true };
    }
  },
};

function parseDate(s: string): Date {
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`);
  return d;
}

function formatDate(d: Date, fmt: string, tz?: string): string {
  if (tz) {
    const localeStr = d.toLocaleString('en-US', { timeZone: tz });
    d = new Date(localeStr);
  }
  switch (fmt) {
    case 'iso': return d.toISOString();
    case 'date': return d.toISOString().split('T')[0];
    case 'time': return d.toTimeString().split(' ')[0];
    case 'datetime': return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
    case 'unix': return String(d.getTime());
    default: return d.toISOString();
  }
}

function addTime(d: Date, amount: number, unit: string): Date {
  const result = new Date(d);
  switch (unit) {
    case 'milliseconds': result.setTime(result.getTime() + amount); break;
    case 'seconds': result.setTime(result.getTime() + amount * 1000); break;
    case 'minutes': result.setTime(result.getTime() + amount * 60000); break;
    case 'hours': result.setTime(result.getTime() + amount * 3600000); break;
    case 'days': result.setDate(result.getDate() + amount); break;
    case 'weeks': result.setDate(result.getDate() + amount * 7); break;
    case 'months': result.setMonth(result.getMonth() + amount); break;
    case 'years': result.setFullYear(result.getFullYear() + amount); break;
    default: throw new Error(`Unknown unit: ${unit}`);
  }
  return result;
}
