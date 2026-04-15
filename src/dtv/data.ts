export interface DataSource {
  readonly name: string;
  readonly type: string;
  read(key: string): Promise<unknown>;
}

/**
 * MRGConfig reader — read-only data layer for agents.
 * Agents can read business data but cannot modify source systems.
 */
export class MRGConfigReader implements DataSource {
  readonly name = 'mrg-config';
  readonly type = 'config';
  private data: Map<string, unknown>;

  constructor(initial?: Record<string, unknown>) {
    this.data = new Map(Object.entries(initial ?? {}));
  }

  async read(key: string): Promise<unknown> {
    return this.data.get(key);
  }

  load(data: Record<string, unknown>): void {
    for (const [k, v] of Object.entries(data)) {
      this.data.set(k, v);
    }
  }
}
