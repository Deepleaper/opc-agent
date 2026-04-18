import * as fs from 'fs';
import * as path from 'path';
import type { Message } from '../core/types';
import type { LLMProvider } from '../providers';

export interface LearnedSkill {
  name: string;
  description: string;
  trigger: string;
  instructions: string;
  examples: string[];
  createdAt: Date;
  usageCount: number;
  lastUsed?: Date;
  version: number;
}

const SKILL_EXTRACTION_PROMPT = `Analyze this conversation and determine if it represents a repeatable task that should be saved as a reusable skill.

Criteria for creating a skill:
1. The task is specific and well-defined
2. It could reasonably happen again
3. The solution has clear steps

If yes, extract:
- name: short kebab-case name
- description: one-line description
- trigger: regex pattern or keywords that would identify this task
- instructions: step-by-step instructions to complete the task
- examples: 2-3 example user inputs that would trigger this skill

If this is just casual chat or a one-off question, return null.

Respond in JSON format only: { "shouldCreate": boolean, "skill": { "name": string, "description": string, "trigger": string, "instructions": string, "examples": string[] } | null }

Conversation:
`;

const SKILL_IMPROVEMENT_PROMPT = `This skill was just used. Based on the outcome, suggest improvements:

Current skill:
`;

const SKILL_IMPROVEMENT_SUFFIX = `

Respond in JSON only: { "shouldImprove": boolean, "improvements": { "instructions"?: string, "trigger"?: string, "examples"?: string[] } | null }`;

export class SkillLearner {
  private skillsDir: string;
  private skills: LearnedSkill[] = [];
  private loaded = false;

  constructor(skillsDir: string) {
    this.skillsDir = skillsDir;
  }

  async analyzeForSkillCreation(
    conversation: Message[],
    provider: LLMProvider,
  ): Promise<LearnedSkill | null> {
    const conversationText = conversation
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const prompt = SKILL_EXTRACTION_PROMPT + conversationText;

    try {
      const response = await provider.chat(
        [{ id: 'analysis', role: 'user', content: prompt, timestamp: Date.now() }],
        'You are a skill extraction assistant. Respond only with valid JSON.',
      );

      const json = extractJson(response);
      if (!json || !json.shouldCreate || !json.skill) return null;

      const skill: LearnedSkill = {
        name: json.skill.name,
        description: json.skill.description,
        trigger: json.skill.trigger,
        instructions: json.skill.instructions,
        examples: json.skill.examples || [],
        createdAt: new Date(),
        usageCount: 0,
        version: 1,
      };

      return skill;
    } catch {
      return null;
    }
  }

  async saveSkill(skill: LearnedSkill): Promise<void> {
    fs.mkdirSync(this.skillsDir, { recursive: true });
    const filePath = path.join(this.skillsDir, `${skill.name}.md`);
    fs.writeFileSync(filePath, skillToMarkdown(skill), 'utf-8');

    // Update cache
    const idx = this.skills.findIndex((s) => s.name === skill.name);
    if (idx >= 0) {
      this.skills[idx] = skill;
    } else {
      this.skills.push(skill);
    }
  }

  async loadLearnedSkills(): Promise<LearnedSkill[]> {
    if (!fs.existsSync(this.skillsDir)) return [];

    const files = fs.readdirSync(this.skillsDir).filter((f) => f.endsWith('.md'));
    this.skills = files
      .map((f) => {
        try {
          const content = fs.readFileSync(path.join(this.skillsDir, f), 'utf-8');
          return parseSkillMarkdown(content);
        } catch {
          return null;
        }
      })
      .filter((s): s is LearnedSkill => s !== null);

    this.loaded = true;
    return this.skills;
  }

  matchSkill(message: string): LearnedSkill | null {
    if (!this.loaded) return null;

    for (const skill of this.skills) {
      try {
        const regex = new RegExp(skill.trigger, 'i');
        if (regex.test(message)) return skill;
      } catch {
        // Fallback: keyword matching — split on common separators, strip non-word chars
        const keywords = skill.trigger.split(/[\s,;|]+/).map(k => k.replace(/[^\w-]/g, '').toLowerCase()).filter(k => k.length > 2);
        const lower = message.toLowerCase();
        if (keywords.some((kw) => lower.includes(kw))) return skill;
      }
    }
    return null;
  }

  async improveSkill(
    skill: LearnedSkill,
    conversation: Message[],
    provider: LLMProvider,
  ): Promise<void> {
    const conversationText = conversation
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const prompt =
      SKILL_IMPROVEMENT_PROMPT +
      skillToMarkdown(skill) +
      '\n\nConversation where it was used:\n' +
      conversationText +
      SKILL_IMPROVEMENT_SUFFIX;

    try {
      const response = await provider.chat(
        [{ id: 'improve', role: 'user', content: prompt, timestamp: Date.now() }],
        'You are a skill improvement assistant. Respond only with valid JSON.',
      );

      const json = extractJson(response);
      if (!json || !json.shouldImprove || !json.improvements) return;

      const { improvements } = json;
      if (improvements.instructions) skill.instructions = improvements.instructions;
      if (improvements.trigger) skill.trigger = improvements.trigger;
      if (improvements.examples) skill.examples = [...skill.examples, ...improvements.examples];
      skill.version++;

      await this.saveSkill(skill);
    } catch {
      // Silently fail — improvement is best-effort
    }
  }

  getSkills(): LearnedSkill[] {
    return [...this.skills];
  }
}

// ─── Helpers ────────────────────────────────────────────────

function extractJson(text: string): any {
  // Try to extract JSON from response (may be wrapped in markdown code block)
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export function skillToMarkdown(skill: LearnedSkill): string {
  const lines = [
    `# Skill: ${skill.name}`,
    '',
    '## Description',
    skill.description,
    '',
    '## Trigger',
    `Pattern: ${skill.trigger}`,
    '',
    '## Instructions',
    skill.instructions,
    '',
    '## Examples',
    ...skill.examples.map((e) => `- "${e}"`),
    '',
    '## Metadata',
    `- Created: ${skill.createdAt.toISOString()}`,
    `- Version: ${skill.version}`,
    `- Usage Count: ${skill.usageCount}`,
    `- Last Used: ${skill.lastUsed?.toISOString() ?? 'never'}`,
    '',
  ];
  return lines.join('\n');
}

export function parseSkillMarkdown(content: string): LearnedSkill | null {
  const nameMatch = content.match(/^# Skill:\s*(.+)$/m);
  if (!nameMatch) return null;

  const section = (heading: string): string => {
    const re = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`);
    const m = content.match(re);
    return m ? m[1].trim() : '';
  };

  const description = section('Description');
  const triggerLine = section('Trigger');
  const trigger = triggerLine.replace(/^Pattern:\s*/i, '').trim();
  const instructions = section('Instructions');

  const examplesRaw = section('Examples');
  const examples = examplesRaw
    .split('\n')
    .map((l) => l.replace(/^-\s*"?|"?\s*$/g, '').trim())
    .filter(Boolean);

  const metadata = section('Metadata');
  const getMeta = (key: string): string => {
    const m = metadata.match(new RegExp(`- ${key}:\\s*(.+)`, 'i'));
    return m ? m[1].trim() : '';
  };

  return {
    name: nameMatch[1].trim(),
    description,
    trigger,
    instructions,
    examples,
    createdAt: new Date(getMeta('Created') || Date.now()),
    version: parseInt(getMeta('Version') || '1', 10),
    usageCount: parseInt(getMeta('Usage Count') || '0', 10),
    lastUsed: getMeta('Last Used') !== 'never' ? new Date(getMeta('Last Used')) : undefined,
  };
}
