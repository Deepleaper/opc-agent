import { BaseSkill } from 'opc-agent';
import type { AgentContext, Message, SkillResult } from 'opc-agent';

export class EchoSkill extends BaseSkill {
  name = 'echo';
  description = 'Echo back the message (test skill)';

  async execute(context: AgentContext, message: Message): Promise<SkillResult> {
    if (message.content.toLowerCase().startsWith('/echo ')) {
      const text = message.content.slice(6);
      return this.match(`🔊 Echo: ${text}`);
    }
    return this.noMatch();
  }
}
