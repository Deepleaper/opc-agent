import type { MCPTool, MCPToolResult } from '../mcp';
import { execSync } from 'child_process';

export const GitTool: MCPTool = {
  name: 'git',
  description: 'Run git commands on a local repository: status, diff, commit, log.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['status', 'diff', 'commit', 'log'], description: 'Git action' },
      cwd: { type: 'string', description: 'Repository directory path' },
      message: { type: 'string', description: 'Commit message (for commit)' },
      args: { type: 'string', description: 'Additional git arguments' },
    },
    required: ['action'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const action = String(input.action ?? '');
    const cwd = String(input.cwd ?? process.cwd());
    const args = String(input.args ?? '');

    try {
      let cmd: string;
      switch (action) {
        case 'status': cmd = `git status --short ${args}`; break;
        case 'diff': cmd = `git diff ${args}`; break;
        case 'commit':
          if (!input.message) return { content: 'Error: message required for commit', isError: true };
          cmd = `git add -A && git commit -m ${JSON.stringify(String(input.message))} ${args}`;
          break;
        case 'log': cmd = `git log --oneline -20 ${args}`; break;
        default: return { content: `Unknown action: ${action}`, isError: true };
      }

      const result = execSync(cmd, { cwd, timeout: 30000, encoding: 'utf-8', maxBuffer: 1024 * 1024 });
      return { content: result.slice(0, 4000) || '(clean)' };
    } catch (err) {
      return { content: `Git error: ${(err as Error).message.slice(0, 1000)}`, isError: true };
    }
  },
};
