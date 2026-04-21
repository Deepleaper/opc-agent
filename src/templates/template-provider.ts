// v2 template provider — loads and resolves agent role templates
import type { EgoConfig, AgentConfig } from '../core/types';
import * as path from 'path';
import * as fs from 'fs';

export interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  ego: EgoConfig;
  configOverrides?: Partial<AgentConfig>;
}

export class TemplateProvider {
  private templates = new Map<string, RoleTemplate>();

  register(template: RoleTemplate): void {
    this.templates.set(template.id, template);
  }

  get(id: string): RoleTemplate | undefined {
    return this.templates.get(id);
  }

  list(): RoleTemplate[] {
    return Array.from(this.templates.values());
  }

  async loadFromDir(dir: string): Promise<void> {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      const tpl = JSON.parse(raw) as RoleTemplate;
      this.register(tpl);
    }
  }
}
