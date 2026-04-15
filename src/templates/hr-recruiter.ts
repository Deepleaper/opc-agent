import { BaseSkill } from '../skills/base';
import type { AgentContext, Message, SkillResult } from '../core/types';


export class ResumeScreeningSkill extends BaseSkill {
  name = 'resume-screening';
  description = 'Screen resumes against job requirements';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('resume') || lower.includes('cv') || lower.includes('candidate')) {
      return this.match(
        'I can help screen resumes. Please share the candidate\'s resume and the job requirements, and I\'ll provide an analysis.',
        0.8,
      );
    }
    return this.noMatch();
  }
}

export class InterviewSchedulingSkill extends BaseSkill {
  name = 'interview-scheduling';
  description = 'Help schedule interviews with candidates';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('schedule') || lower.includes('interview') || lower.includes('calendar')) {
      return this.match(
        'I can help schedule interviews. Please provide the candidate name, preferred dates, and interview format (phone/video/onsite).',
        0.8,
      );
    }
    return this.noMatch();
  }
}

export function createHRRecruiterConfig() {
  return {
    apiVersion: 'opc/v1',
    kind: 'Agent',
    metadata: {
      name: 'hr-recruiter',
      version: '1.0.0',
      description: 'HR Recruiter — resume screening, interview scheduling, candidate Q&A',
      author: 'Deepleaper',
      license: 'Apache-2.0',
    },
    spec: {
      model: 'deepseek-chat',
      systemPrompt: 'You are an HR recruiter assistant. Help with resume screening, interview scheduling, and answering candidate questions. Be professional and friendly.',
      skills: [
        { name: 'resume-screening', description: 'Screen resumes' },
        { name: 'interview-scheduling', description: 'Schedule interviews' },
      ],
      channels: [{ type: 'web', port: 3000 }],
    },
  };
}
