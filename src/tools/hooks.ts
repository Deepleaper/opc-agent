// v2 tool hooks — before/after middleware for tool execution
import type { ToolCall } from '../core/types';

// --- Simple synchronous hook types (used by ToolHooks) ---

export interface SimpleHookContext {
  toolName: string;
  args: Record<string, unknown>;
}

export type BeforeHook = (ctx: SimpleHookContext) => {
  allow: boolean;
  reason?: string;
  modifiedArgs?: Record<string, unknown>;
};

export type AfterHook = (ctx: SimpleHookContext, result: string) => string;

export class ToolHooks {
  private beforeHooks: BeforeHook[] = [];
  private afterHooks: AfterHook[] = [];

  addBefore(hook: BeforeHook): void { this.beforeHooks.push(hook); }
  addAfter(hook: AfterHook): void { this.afterHooks.push(hook); }

  runBefore(ctx: SimpleHookContext): { allow: boolean; reason?: string; modifiedArgs?: Record<string, unknown> } {
    let modifiedArgs = ctx.args;
    for (const hook of this.beforeHooks) {
      const result = hook({ ...ctx, args: modifiedArgs });
      if (!result.allow) return result;
      if (result.modifiedArgs) modifiedArgs = result.modifiedArgs;
    }
    return { allow: true, modifiedArgs };
  }

  runAfter(ctx: SimpleHookContext, result: string): string {
    let out = result;
    for (const hook of this.afterHooks) {
      out = hook(ctx, out);
    }
    return out;
  }
}

// Built-in guard: block destructive shell commands before execution
export const dangerousCommandBlocker: BeforeHook = (ctx) => {
  if (
    ctx.toolName === 'shell' &&
    /rm\s+-rf|format\s+[c-z]:|DROP\s+TABLE/i.test((ctx.args['command'] as string) ?? '')
  ) {
    return { allow: false, reason: 'Dangerous command blocked' };
  }
  return { allow: true };
};

// --- Async hook runner (existing, used by agent loop) ---

export type HookPhase = 'before' | 'after' | 'error';

export interface ToolHook {
  id: string;
  phase: HookPhase;
  tools?: string[];
  fn: (ctx: ToolHookContext) => Promise<void>;
}

export interface ToolHookContext {
  call: ToolCall;
  args: Record<string, unknown>;
  result?: unknown;
  error?: Error;
  startedAt: number;
}

export class ToolHookRunner {
  private hooks: ToolHook[] = [];

  add(hook: ToolHook): void {
    this.hooks.push(hook);
  }

  remove(id: string): void {
    this.hooks = this.hooks.filter((h) => h.id !== id);
  }

  async runBefore(ctx: ToolHookContext): Promise<void> {
    for (const hook of this.hooks.filter((h) => h.phase === 'before')) {
      if (!hook.tools || hook.tools.includes(ctx.call.name)) {
        await hook.fn(ctx);
      }
    }
  }

  async runAfter(ctx: ToolHookContext): Promise<void> {
    for (const hook of this.hooks.filter((h) => h.phase === 'after')) {
      if (!hook.tools || hook.tools.includes(ctx.call.name)) {
        await hook.fn(ctx);
      }
    }
  }

  async runError(ctx: ToolHookContext): Promise<void> {
    for (const hook of this.hooks.filter((h) => h.phase === 'error')) {
      if (!hook.tools || hook.tools.includes(ctx.call.name)) {
        await hook.fn(ctx);
      }
    }
  }
}
