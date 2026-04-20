/**
 * Skill Marketplace - Type Definitions
 * Defines the structure for installable skills in the OPC Agent marketplace.
 */

export interface MarketplaceSkill {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  category: SkillCategory;
  icon: string;
  version: string;
  author: string;
  tools: string[];
  config?: Record<string, any>;
  systemPrompt?: string;
}

export type SkillCategory = 'productivity' | 'knowledge' | 'creative' | 'developer' | 'lifestyle' | 'business' | 'education';

export interface InstalledSkill {
  skillId: string;
  installedAt: string;
  config?: Record<string, any>;
}

export interface SkillInstallResult {
  success: boolean;
  skillId: string;
  message?: string;
}

export const CATEGORY_LABELS: Record<SkillCategory, { en: string; zh: string }> = {
  productivity: { en: 'Productivity', zh: '效率工具' },
  knowledge: { en: 'Knowledge', zh: '知识工具' },
  creative: { en: 'Creative', zh: '创作工具' },
  developer: { en: 'Developer', zh: '开发工具' },
  lifestyle: { en: 'Lifestyle', zh: '生活工具' },
  business: { en: 'Business', zh: '业务工具' },
  education: { en: 'Education', zh: '教育学习' },
};
