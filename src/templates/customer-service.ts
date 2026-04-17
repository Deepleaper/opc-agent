import { BaseSkill } from '../skills/base';
import type { AgentContext, Message, SkillResult } from '../core/types';

const DEFAULT_FAQ: Record<string, string> = {
  'hours': 'Our business hours are Monday-Friday, 9am-6pm.',
  'return': 'You can return items within 30 days of purchase.',
  'shipping': 'Standard shipping takes 3-5 business days.',
  'contact': 'You can reach us at support@example.com.',
};

export class FAQSkill extends BaseSkill {
  name = 'faq-lookup';
  description = 'Look up FAQ answers';
  private faq: Record<string, string>;

  constructor(faq?: Record<string, string>) {
    super();
    this.faq = faq ?? DEFAULT_FAQ;
  }

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    for (const [key, answer] of Object.entries(this.faq)) {
      if (lower.includes(key)) {
        return this.match(answer, 0.9);
      }
    }
    return this.noMatch();
  }
}

export class HandoffSkill extends BaseSkill {
  name = 'human-handoff';
  description = 'Hand off to a human agent when confidence is low';
  private keywords = ['speak to human', 'talk to agent', 'real person', 'human agent'];

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (this.keywords.some((kw) => lower.includes(kw))) {
      return this.match(
        'I understand you\'d like to speak with a human agent. Let me connect you now. Please hold.',
        1.0
      );
    }
    return this.noMatch();
  }
}

export const CUSTOMER_SERVICE_SYSTEM_PROMPT = `You are a friendly and professional customer service agent. 
You help customers with their questions about products, orders, shipping, and returns.
Be concise, helpful, and empathetic. If you're unsure, offer to connect them with a human agent.`;

export function createCustomerServiceConfig() {
  return {
    apiVersion: 'opc/v1' as const,
    kind: 'Agent' as const,
    metadata: {
      name: 'customer-service',
      version: '1.0.0',
      description: 'Customer service agent with FAQ and human handoff',
      author: 'OPC Agent',
      license: 'Apache-2.0',
    },
    spec: {
      provider: { default: 'deepseek', allowed: ['openai', 'deepseek', 'qwen'] },
      model: 'deepseek-chat',
      systemPrompt: CUSTOMER_SERVICE_SYSTEM_PROMPT,
      skills: [
        { name: 'faq-lookup', description: 'Look up FAQ answers' },
        { name: 'human-handoff', description: 'Hand off to human agent' },
      ],
      channels: [{ type: 'web' as const, port: 3000 }],
      memory: { shortTerm: true, longTerm: false },
    },
  };
}
