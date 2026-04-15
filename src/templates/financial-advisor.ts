import { BaseSkill } from '../skills/base';
import type { AgentContext, Message, SkillResult } from '../core/types';
import type { OADDocument } from '../schema/oad';

export class BudgetAnalysisSkill extends BaseSkill {
  name = 'budget-analysis';
  description = 'Analyze budgets and expenses';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('budget') || lower.includes('expense') || lower.includes('cost')) {
      return this.match('I can help analyze your budget. Please share your income and expense categories, and I\'ll provide insights on spending patterns and savings opportunities.', 0.8);
    }
    if (lower.includes('save') || lower.includes('saving')) {
      return this.match('Common savings strategies: 50/30/20 rule (needs/wants/savings), automate transfers, review subscriptions, negotiate bills, and track daily spending.', 0.75);
    }
    return this.noMatch();
  }
}

export class FinancialPlanningSkill extends BaseSkill {
  name = 'financial-planning';
  description = 'Help with financial planning and advice';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('invest') || lower.includes('portfolio')) {
      return this.match('For investment planning, consider: risk tolerance, time horizon, diversification, asset allocation, and regular rebalancing. This is general guidance — consult a certified financial advisor for personalized advice.', 0.8);
    }
    if (lower.includes('retire') || lower.includes('pension')) {
      return this.match('Retirement planning essentials: estimate target savings (25x annual expenses), maximize employer matching, consider tax-advantaged accounts, and start early for compound growth.', 0.8);
    }
    return this.noMatch();
  }
}

export function createFinancialAdvisorConfig(): OADDocument {
  return {
    apiVersion: 'opc/v1',
    kind: 'Agent',
    metadata: {
      name: 'financial-advisor',
      version: '1.0.0',
      description: 'AI Financial Advisor - budget analysis, expense tracking, financial planning',
      author: 'OPC',
      license: 'Apache-2.0',
    },
    spec: {
      model: 'deepseek-chat',
      systemPrompt: 'You are a financial advisor AI. Help users with budget analysis, expense tracking, and financial planning. Always recommend consulting a certified financial advisor for binding decisions.',
      skills: [
        { name: 'budget-analysis', description: 'Analyze budgets and expenses' },
        { name: 'financial-planning', description: 'Financial planning advice' },
      ],
      channels: [{ type: 'web', port: 3000 }],
      memory: { shortTerm: true, longTerm: false },
      streaming: false,
    },
  };
}
