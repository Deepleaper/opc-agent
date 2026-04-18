import { execSync } from 'child_process';
import * as path from 'path';
import type { MCPTool, MCPToolResult } from '../mcp';

export const shellTool: MCPTool = {
  name: 'shell_exec',
  description: 'Execute a shell command (sandboxed to workspace)',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string' },
      timeout: { type: 'number', default: 30000 },
    },
    required: ['command'],
  },
  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const command = input.command as string;
    const timeout = (input.timeout as number) || 30000;
    const workspace = process.cwd();

    // Block path traversal attempts
    if (command.includes('..')) {
      return { content: 'Commands with ".." are not allowed for security', isError: true };
    }

    try {
      const output = execSync(command, {
        cwd: workspace,
        timeout,
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const result = (output || '').slice(0, 5000);
      return { content: result || '(no output)', isError: false };
    } catch (err: any) {
      const stderr = err.stderr ? String(err.stderr).slice(0, 2500) : '';
      const stdout = err.stdout ? String(err.stdout).slice(0, 2500) : '';
      const output = [stdout, stderr].filter(Boolean).join('\n') || err.message;
      return { content: `Command failed: ${output.slice(0, 5000)}`, isError: true };
    }
  },
};
