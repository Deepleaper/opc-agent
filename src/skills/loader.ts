import * as fs from 'fs';
import * as path from 'path';
import type { SkillConfig, SkillDefinition } from '../core/types';

// --- JS module loader (existing, used by agent loop) ---

export interface LoadedSkill {
  config: SkillConfig;
  module: unknown;
  loadedAt: number;
}

export async function loadSkill(config: SkillConfig): Promise<LoadedSkill> {
  const resolvedPath = path.isAbsolute(config.path)
    ? config.path
    : path.resolve(process.cwd(), config.path);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = await import(resolvedPath);
  return { config, module: mod, loadedAt: Date.now() };
}

export async function loadAllSkills(configs: SkillConfig[]): Promise<LoadedSkill[]> {
  const results: LoadedSkill[] = [];
  for (const config of configs) {
    if (config.enabled === false) continue;
    results.push(await loadSkill(config));
  }
  return results;
}

// --- L0/L1/L2 progressive markdown skill loader ---

// L0: load name + description index only (~3k tokens)
export async function loadSkillIndex(
  dirs: string[]
): Promise<{ name: string; description: string; path: string }[]> {
  const index: { name: string; description: string; path: string }[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = await fs.promises.readdir(dir, { recursive: true });
    for (const file of files) {
      if (!String(file).endsWith('.md')) continue;
      const fullPath = path.join(dir, String(file));
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      const { name, description } = parseSkillFrontmatter(content);
      if (name) index.push({ name, description: description || '', path: fullPath });
    }
  }
  return index;
}

// L1: load full skill definition from a markdown file
export async function loadSkillFull(skillPath: string): Promise<SkillDefinition> {
  const content = await fs.promises.readFile(skillPath, 'utf-8');
  return parseSkillContent(content);
}

// L2: load an external file referenced by a skill
export async function loadSkillReference(skillDir: string, refPath: string): Promise<string> {
  return fs.promises.readFile(path.join(skillDir, refPath), 'utf-8');
}

function parseSkillFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { name: '', description: '' };
  const yaml = match[1];
  const name = yaml.match(/name:\s*(.+)/)?.[1]?.trim() ?? '';
  const description = yaml.match(/description:\s*['"]?(.+?)['"]?\s*$/m)?.[1]?.trim() ?? '';
  return { name, description };
}

function parseSkillContent(content: string): SkillDefinition {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const yaml = match?.[1] ?? '';
  const body = match?.[2] ?? content;

  const name = yaml.match(/name:\s*(.+)/)?.[1]?.trim() ?? '';
  const description = yaml.match(/description:\s*['"]?(.+?)['"]?\s*$/m)?.[1]?.trim() ?? '';

  const triggersMatch = yaml.match(/triggers:\s*\[([^\]]*)\]/);
  const triggers = triggersMatch
    ? triggersMatch[1].split(',').map((t) => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    : [];

  const referencesMatch = yaml.match(/references:\s*\[([^\]]*)\]/);
  const references = referencesMatch
    ? referencesMatch[1].split(',').map((r) => r.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    : [];

  return { name, description, triggers, content: body.trim(), references };
}
