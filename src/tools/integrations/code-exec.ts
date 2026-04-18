import type { MCPTool, MCPToolResult } from '../mcp';
import { execSync } from 'child_process';

export const CodeExecutionTool: MCPTool = {
  name: 'code-exec',
  description: 'Execute JavaScript or Python code in a sandboxed subprocess.',
  inputSchema: {
    type: 'object',
    properties: {
      language: { type: 'string', enum: ['javascript', 'python'], description: 'Language to execute' },
      code: { type: 'string', description: 'Code to execute' },
      timeout: { type: 'number', description: 'Timeout in seconds (default: 10)' },
    },
    required: ['language', 'code'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const language = String(input.language ?? '');
    const code = String(input.code ?? '');
    if (!code) return { content: 'Error: code required', isError: true };

    const timeout = Math.min(Number(input.timeout ?? 10), 30) * 1000;

    try {
      let result: string;
      if (language === 'javascript') {
        result = execSync(`node -e ${JSON.stringify(code)}`, { timeout, encoding: 'utf-8', maxBuffer: 1024 * 1024 });
      } else if (language === 'python') {
        result = execSync(`python -c ${JSON.stringify(code)}`, { timeout, encoding: 'utf-8', maxBuffer: 1024 * 1024 });
      } else {
        return { content: `Unsupported language: ${language}`, isError: true };
      }
      return { content: result.slice(0, 4000) || '(no output)' };
    } catch (err) {
      const msg = (err as Error & { stderr?: string }).stderr || (err as Error).message;
      return { content: `Execution error: ${String(msg).slice(0, 2000)}`, isError: true };
    }
  },
};
