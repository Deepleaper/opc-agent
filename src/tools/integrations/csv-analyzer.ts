import type { MCPTool, MCPToolResult } from '../mcp';
import * as fs from 'fs';

export const CSVAnalyzerTool: MCPTool = {
  name: 'csv-analyzer',
  description: 'Parse, filter, and aggregate CSV data from a file or inline text.',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Path to CSV file' },
      data: { type: 'string', description: 'Inline CSV data (alternative to file_path)' },
      action: { type: 'string', enum: ['parse', 'filter', 'aggregate'], description: 'Action (default: parse)' },
      column: { type: 'string', description: 'Column name (for filter/aggregate)' },
      value: { type: 'string', description: 'Filter value' },
      operation: { type: 'string', enum: ['sum', 'avg', 'min', 'max', 'count'], description: 'Aggregate operation' },
    },
    required: [],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    try {
      let csvText: string;
      if (input.file_path) {
        csvText = fs.readFileSync(String(input.file_path), 'utf-8');
      } else if (input.data) {
        csvText = String(input.data);
      } else {
        return { content: 'Error: file_path or data required', isError: true };
      }

      const lines = csvText.trim().split(/\r?\n/);
      if (lines.length < 2) return { content: 'Error: CSV must have at least a header and one data row', isError: true };

      const headers = parseCsvLine(lines[0]);
      const rows = lines.slice(1).map(parseCsvLine);
      const action = String(input.action ?? 'parse');

      if (action === 'parse') {
        const preview = rows.slice(0, 20).map((r) => {
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => obj[h] = r[i] ?? '');
          return obj;
        });
        return { content: `${headers.join(', ')}\n${rows.length} rows\n\n${JSON.stringify(preview, null, 2).slice(0, 3000)}` };
      }

      if (action === 'filter') {
        const col = String(input.column ?? '');
        const colIdx = headers.indexOf(col);
        if (colIdx === -1) return { content: `Column not found: ${col}. Available: ${headers.join(', ')}`, isError: true };
        const filtered = rows.filter((r) => r[colIdx] === String(input.value ?? ''));
        return { content: `${filtered.length} matching rows\n${JSON.stringify(filtered.slice(0, 20), null, 2).slice(0, 3000)}` };
      }

      if (action === 'aggregate') {
        const col = String(input.column ?? '');
        const colIdx = headers.indexOf(col);
        if (colIdx === -1) return { content: `Column not found: ${col}`, isError: true };
        const values = rows.map((r) => parseFloat(r[colIdx])).filter((v) => !isNaN(v));
        const op = String(input.operation ?? 'count');
        let result: number;
        switch (op) {
          case 'sum': result = values.reduce((a, b) => a + b, 0); break;
          case 'avg': result = values.reduce((a, b) => a + b, 0) / values.length; break;
          case 'min': result = Math.min(...values); break;
          case 'max': result = Math.max(...values); break;
          case 'count': result = values.length; break;
          default: return { content: `Unknown operation: ${op}`, isError: true };
        }
        return { content: `${op}(${col}) = ${result}` };
      }

      return { content: `Unknown action: ${action}`, isError: true };
    } catch (err) {
      return { content: `CSV error: ${(err as Error).message}`, isError: true };
    }
  },
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}
