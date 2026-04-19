/**
 * Skill Marketplace Manager
 * Handles skill installation, uninstallation, and runtime discovery.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as os from 'os';
import type { MarketplaceSkill, InstalledSkill, SkillInstallResult, SkillCategory } from './types';
import { BUILTIN_SKILLS } from './builtin/index';

export class SkillMarketplace {
  private installedSkills: Map<string, InstalledSkill> = new Map();
  private configPath: string;

  constructor() {
    const dir = join(os.homedir(), '.opc');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.configPath = join(dir, 'skills-installed.json');
    this.loadInstalled();
  }

  private loadInstalled(): void {
    if (existsSync(this.configPath)) {
      try {
        const data = JSON.parse(readFileSync(this.configPath, 'utf-8'));
        if (Array.isArray(data)) {
          data.forEach((s: InstalledSkill) => this.installedSkills.set(s.skillId, s));
        }
      } catch { /* ignore corrupted file */ }
    }
  }

  private saveInstalled(): void {
    const data = Array.from(this.installedSkills.values());
    writeFileSync(this.configPath, JSON.stringify(data, null, 2));
  }

  /** Get all available skills with installation status */
  listAll(category?: string, search?: string): (MarketplaceSkill & { installed: boolean })[] {
    let skills = BUILTIN_SKILLS;
    if (category) {
      skills = skills.filter(s => s.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      skills = skills.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.nameZh.includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.descriptionZh.includes(q)
      );
    }
    return skills.map(s => ({
      ...s,
      installed: this.installedSkills.has(s.id),
    }));
  }

  /** Get a single skill by ID */
  getSkill(id: string): (MarketplaceSkill & { installed: boolean }) | null {
    const skill = BUILTIN_SKILLS.find(s => s.id === id);
    if (!skill) return null;
    return { ...skill, installed: this.installedSkills.has(id) };
  }

  /** Install a skill */
  install(id: string, config?: Record<string, any>): SkillInstallResult {
    const skill = BUILTIN_SKILLS.find(s => s.id === id);
    if (!skill) return { success: false, skillId: id, message: 'Skill not found' };
    if (this.installedSkills.has(id)) return { success: true, skillId: id, message: 'Already installed' };

    this.installedSkills.set(id, {
      skillId: id,
      installedAt: new Date().toISOString(),
      config,
    });
    this.saveInstalled();
    return { success: true, skillId: id, message: 'Installed successfully' };
  }

  /** Uninstall a skill */
  uninstall(id: string): SkillInstallResult {
    if (!this.installedSkills.has(id)) {
      return { success: false, skillId: id, message: 'Skill not installed' };
    }
    this.installedSkills.delete(id);
    this.saveInstalled();
    return { success: true, skillId: id, message: 'Uninstalled successfully' };
  }

  /** Get installed skills with full details */
  getInstalled(): (MarketplaceSkill & { installed: boolean; installedAt: string })[] {
    return Array.from(this.installedSkills.values())
      .map(inst => {
        const skill = BUILTIN_SKILLS.find(s => s.id === inst.skillId);
        if (!skill) return null;
        return { ...skill, installed: true, installedAt: inst.installedAt };
      })
      .filter(Boolean) as any;
  }

  /** Get system prompts for all installed skills (for agent runtime) */
  getInstalledSystemPrompts(): string[] {
    return this.getInstalled()
      .filter(s => s.systemPrompt)
      .map(s => `[${s.icon} ${s.nameZh}] ${s.systemPrompt}`);
  }

  /** Get all tool names from installed skills */
  getInstalledToolNames(): string[] {
    return this.getInstalled().flatMap(s => s.tools);
  }
}
