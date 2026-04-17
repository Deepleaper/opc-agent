import { BaseSkill } from '../skills/base';
import type { AgentContext, Message, SkillResult } from '../core/types';

export class ProductQASkill extends BaseSkill {
  name = 'product-qa';
  description = 'Answer product-related questions';
  private catalog: Record<string, string>;

  constructor(catalog?: Record<string, string>) {
    super();
    this.catalog = catalog ?? {
      pricing: 'Please visit our pricing page or contact sales for a custom quote.',
      features: 'Our product includes AI-powered automation, analytics dashboard, and API access.',
      demo: 'I\'d love to schedule a demo for you! Could you share your email and preferred time?',
    };
  }

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    for (const [key, answer] of Object.entries(this.catalog)) {
      if (lower.includes(key)) return this.match(answer, 0.85);
    }
    return this.noMatch();
  }
}

export class LeadCaptureSkill extends BaseSkill {
  name = 'lead-capture';
  description = 'Capture prospect information';
  private emailRegex = /[\w.-]+@[\w.-]+\.\w+/;

  async execute(context: AgentContext, message: Message): Promise<SkillResult> {
    const email = message.content.match(this.emailRegex);
    if (email) {
      await context.memory.set(`lead:${email[0]}`, {
        email: email[0],
        capturedAt: Date.now(),
        messages: context.messages.length,
      });
      return this.match(`Thanks! I've noted your email (${email[0]}). Our team will reach out shortly.`, 0.95);
    }
    return this.noMatch();
  }
}

export const SALES_ASSISTANT_SYSTEM_PROMPT = `You are a professional sales assistant. Your goals:
1. Answer product questions accurately and enthusiastically
2. Capture leads by collecting name, email, and company info
3. Book appointments when prospects are ready
Be friendly, persuasive but not pushy. Always provide value first.`;

export function createSalesAssistantConfig() {
  return {
    apiVersion: 'opc/v1' as const,
    kind: 'Agent' as const,
    metadata: {
      name: 'sales-assistant',
      version: '1.0.0',
      description: 'AI sales assistant with product Q&A, lead capture, and appointment booking',
      author: 'OPC Agent',
      license: 'Apache-2.0',
    },
    spec: {
      provider: { default: 'deepseek', allowed: ['openai', 'deepseek', 'qwen'] },
      model: 'deepseek-chat',
      systemPrompt: SALES_ASSISTANT_SYSTEM_PROMPT,
      skills: [
        { name: 'product-qa', description: 'Answer product questions' },
        { name: 'lead-capture', description: 'Capture prospect info' },
      ],
      channels: [{ type: 'web' as const, port: 3000 }],
      memory: { shortTerm: true, longTerm: false },
    },
  };
}
