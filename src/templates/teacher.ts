import { BaseSkill } from '../skills/base';
import type { AgentContext, Message, SkillResult } from '../core/types';

export class LessonPlanSkill extends BaseSkill {
  name = 'lesson-plan';
  description = 'Create and manage lesson plans';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('lesson') || lower.includes('plan') || lower.includes('curriculum') || lower.includes('syllabus')) {
      return this.match('I can help create a lesson plan. What subject, grade level, and learning objectives should I focus on?', 0.85);
    }
    return this.noMatch();
  }
}

export class QuizSkill extends BaseSkill {
  name = 'quiz-generator';
  description = 'Generate quizzes and assessments';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('quiz') || lower.includes('test') || lower.includes('assessment') || lower.includes('exam') || lower.includes('question')) {
      return this.match('I\'ll create a quiz for you. What topic, difficulty level, and number of questions would you like?', 0.85);
    }
    return this.noMatch();
  }
}

export class ExplainSkill extends BaseSkill {
  name = 'concept-explainer';
  description = 'Explain concepts at appropriate level';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('explain') || lower.includes('what is') || lower.includes('how does') || lower.includes('why')) {
      return this.match('Let me explain that concept. What\'s your current level of understanding so I can tailor my explanation?', 0.75);
    }
    return this.noMatch();
  }
}

export const TEACHER_SYSTEM_PROMPT = `You are a patient and encouraging teacher assistant. Your goals:
1. Create engaging lesson plans tailored to student level
2. Generate quizzes and assessments with answer keys
3. Explain complex concepts using analogies and examples
4. Provide constructive feedback and encouragement
5. Adapt teaching style to different learning preferences
Be patient, use clear language, and always check for understanding. Use the Socratic method when appropriate.`;

export function createTeacherConfig() {
  return {
    apiVersion: 'opc/v1' as const,
    kind: 'Agent' as const,
    metadata: {
      name: 'teacher',
      version: '1.0.0',
      description: 'AI teacher assistant with lesson planning, quiz generation, and concept explanation',
      author: 'OPC Agent',
      license: 'Apache-2.0',
    },
    spec: {
      provider: { default: 'openai', allowed: ['openai', 'deepseek', 'qwen'] },
      model: 'gpt-4o-mini',
      systemPrompt: TEACHER_SYSTEM_PROMPT,
      skills: [
        { name: 'lesson-plan', description: 'Create lesson plans' },
        { name: 'quiz-generator', description: 'Generate quizzes' },
        { name: 'concept-explainer', description: 'Explain concepts' },
      ],
      channels: [{ type: 'web' as const, port: 3000 }],
      memory: { shortTerm: true, longTerm: true },
    },
  };
}
