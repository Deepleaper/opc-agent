import type { MCPTool, MCPToolResult } from '../mcp';
import * as fs from 'fs';

export const PDFReaderTool: MCPTool = {
  name: 'pdf-reader',
  description: 'Extract text content from a PDF file. Uses basic binary parsing (no external deps).',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Path to PDF file' },
      url: { type: 'string', description: 'URL of PDF file (alternative to file_path)' },
      max_length: { type: 'number', description: 'Max characters to return (default: 5000)' },
    },
    required: [],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const maxLen = Number(input.max_length ?? 5000);

    try {
      let buffer: Buffer;

      if (input.url) {
        const res = await fetch(String(input.url));
        if (!res.ok) return { content: `HTTP ${res.status}`, isError: true };
        buffer = Buffer.from(await res.arrayBuffer());
      } else if (input.file_path) {
        buffer = fs.readFileSync(String(input.file_path));
      } else {
        return { content: 'Error: file_path or url required', isError: true };
      }

      // Basic PDF text extraction — find text between BT/ET markers and decode
      const content = buffer.toString('latin1');
      const textParts: string[] = [];

      // Extract text from stream objects
      const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
      let match: RegExpExecArray | null;
      while ((match = streamRegex.exec(content)) !== null) {
        const stream = match[1];
        // Extract text shown with Tj or TJ operators
        const tjRegex = /\(([^)]*)\)\s*Tj/g;
        let tjMatch: RegExpExecArray | null;
        while ((tjMatch = tjRegex.exec(stream)) !== null) {
          textParts.push(tjMatch[1]);
        }
      }

      const text = textParts.join(' ').replace(/\\n/g, '\n').replace(/\\\(/g, '(').replace(/\\\)/g, ')');
      if (!text.trim()) return { content: '(No extractable text found — PDF may use compressed streams. Consider using a dedicated PDF library.)' };

      return { content: text.slice(0, maxLen), metadata: { pages_approx: (content.match(/\/Type\s*\/Page[^s]/g) || []).length } };
    } catch (err) {
      return { content: `PDF error: ${(err as Error).message}`, isError: true };
    }
  },
};
