// v2 tool permission — resolves allow/deny/ask for tool invocations
import type { PermissionLevel, ToolConfig } from '../core/types';

// --- Simple function-level permission check ---

type PermissionConfig = Record<string, PermissionLevel>;

const DEFAULTS: PermissionConfig = {
  read_file: 'allow',
  write_file: 'allow',
  web_search: 'allow',
  execute_code: 'ask',
  shell_command: 'ask',
  delete_file: 'ask',
};

export function checkPermission(toolName: string, config?: PermissionConfig): PermissionLevel {
  return config?.[toolName] ?? DEFAULTS[toolName] ?? 'ask';
}

// --- Class-based resolver (existing, used by agent loop) ---

export interface PermissionRequest {
  tool: string;
  args: Record<string, unknown>;
  sessionId?: string;
}

export interface PermissionDecision {
  level: PermissionLevel;
  reason?: string;
}

export class PermissionResolver {
  constructor(private config: ToolConfig) {}

  resolve(req: PermissionRequest): PermissionDecision {
    const explicit = this.config.permissions[req.tool];
    if (explicit) return { level: explicit };

    if (this.config.builtin.includes(req.tool)) {
      return { level: 'allow', reason: 'builtin_tool' };
    }

    return { level: 'ask', reason: 'default_policy' };
  }

  isAllowed(req: PermissionRequest): boolean {
    return this.resolve(req).level === 'allow';
  }
}
