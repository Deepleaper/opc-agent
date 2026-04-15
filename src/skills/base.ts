import type { ISkill, AgentContext, Message, SkillResult } from '../core/types';

export abstract class BaseSkill implements ISkill {
  abstract name: string;
  abstract description: string;

  abstract execute(context: AgentContext, message: Message): Promise<SkillResult>;

  protected noMatch(): SkillResult {
    return { handled: false, confidence: 0 };
  }

  protected match(response: string, confidence: number = 1.0): SkillResult {
    return { handled: true, response, confidence };
  }
}
