/**
 * Hooks Module - v1.0.0
 * Event hook system with priority ordering and context modification.
 */

export type HookEvent =
  | 'before:message' | 'after:message'
  | 'before:tool' | 'after:tool'
  | 'before:llm' | 'after:llm'
  | 'before:send' | 'after:send'
  | 'before:learn' | 'after:learn'
  | 'before:recall' | 'after:recall'
  | 'on:error' | 'on:start' | 'on:stop';

export const ALL_HOOK_EVENTS: HookEvent[] = [
  'before:message', 'after:message',
  'before:tool', 'after:tool',
  'before:llm', 'after:llm',
  'before:send', 'after:send',
  'before:learn', 'after:learn',
  'before:recall', 'after:recall',
  'on:error', 'on:start', 'on:stop',
];

export interface HookContext {
  [key: string]: unknown;
}

export type HookHandler = (ctx: HookContext) => HookContext | void | Promise<HookContext | void>;

interface RegisteredHook {
  id: string;
  event: HookEvent;
  handler: HookHandler;
  priority: number;
  name?: string;
}

let hookIdCounter = 0;

export class HookManager {
  private hooks: Map<HookEvent, RegisteredHook[]> = new Map();

  register(event: HookEvent, handler: HookHandler, options?: { priority?: number; name?: string }): string {
    const id = `hook_${++hookIdCounter}`;
    const entry: RegisteredHook = {
      id,
      event,
      handler,
      priority: options?.priority ?? 100,
      name: options?.name,
    };
    if (!this.hooks.has(event)) this.hooks.set(event, []);
    const list = this.hooks.get(event)!;
    list.push(entry);
    list.sort((a, b) => a.priority - b.priority);
    return id;
  }

  unregister(id: string): boolean {
    for (const [event, list] of this.hooks) {
      const idx = list.findIndex(h => h.id === id);
      if (idx !== -1) {
        list.splice(idx, 1);
        return true;
      }
    }
    return false;
  }

  async run(event: HookEvent, ctx: HookContext = {}): Promise<HookContext> {
    const list = this.hooks.get(event);
    if (!list || list.length === 0) return ctx;
    let current = { ...ctx };
    for (const hook of list) {
      const result = await hook.handler(current);
      if (result) current = { ...current, ...result };
    }
    return current;
  }

  getRegistered(event?: HookEvent): { id: string; event: HookEvent; priority: number; name?: string }[] {
    const results: { id: string; event: HookEvent; priority: number; name?: string }[] = [];
    const events = event ? [event] : ALL_HOOK_EVENTS;
    for (const e of events) {
      const list = this.hooks.get(e) ?? [];
      for (const h of list) {
        results.push({ id: h.id, event: h.event, priority: h.priority, name: h.name });
      }
    }
    return results;
  }

  clear(event?: HookEvent): void {
    if (event) {
      this.hooks.delete(event);
    } else {
      this.hooks.clear();
    }
  }

  hasHooks(event: HookEvent): boolean {
    return (this.hooks.get(event)?.length ?? 0) > 0;
  }
}
