import type { ISkill, AgentContext, Message, SkillResult } from '../core/types';

export type { ISkill } from '../core/types';

export class SkillRegistry {
  private skills: Map<string, ISkill> = new Map();

  register(skill: ISkill): void {
    this.skills.set(skill.name, skill);
  }

  get(name: string): ISkill | undefined {
    return this.skills.get(name);
  }

  list(): ISkill[] {
    return Array.from(this.skills.values());
  }

  async executeAll(context: AgentContext, message: Message): Promise<SkillResult | null> {
    for (const skill of this.skills.values()) {
      const result = await skill.execute(context, message);
      if (result.handled) return result;
    }
    return null;
  }
}
