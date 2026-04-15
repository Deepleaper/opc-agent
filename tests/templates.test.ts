import { describe, it, expect } from 'vitest';
import { createLegalAssistantConfig, ContractReviewSkill, ComplianceCheckSkill } from '../src/templates/legal-assistant';
import { createFinancialAdvisorConfig, BudgetAnalysisSkill, FinancialPlanningSkill } from '../src/templates/financial-advisor';
import { createExecutiveAssistantConfig, CalendarSkill, EmailDraftSkill, MeetingPrepSkill } from '../src/templates/executive-assistant';
import type { AgentContext, Message, MemoryStore } from '../src/core/types';

const mockMemory: MemoryStore = {
  get: async () => null, set: async () => {}, getConversation: async () => [],
  addMessage: async () => {}, clear: async () => {},
};
const ctx: AgentContext = { agentName: 'test', sessionId: 's1', messages: [], memory: mockMemory, metadata: {} };
const msg = (content: string): Message => ({ id: '1', role: 'user', content, timestamp: Date.now() });

describe('Legal Assistant Template', () => {
  it('should create valid config', () => {
    const config = createLegalAssistantConfig();
    expect(config.metadata.name).toBe('legal-assistant');
    expect(config.spec.skills).toHaveLength(2);
  });

  it('ContractReviewSkill matches contract terms', async () => {
    const skill = new ContractReviewSkill();
    const r = await skill.execute(ctx, msg('What is force majeure?'));
    expect(r.handled).toBe(true);
  });

  it('ComplianceCheckSkill matches GDPR', async () => {
    const skill = new ComplianceCheckSkill();
    const r = await skill.execute(ctx, msg('GDPR requirements'));
    expect(r.handled).toBe(true);
  });
});

describe('Financial Advisor Template', () => {
  it('should create valid config', () => {
    const config = createFinancialAdvisorConfig();
    expect(config.metadata.name).toBe('financial-advisor');
  });

  it('BudgetAnalysisSkill matches budget queries', async () => {
    const skill = new BudgetAnalysisSkill();
    const r = await skill.execute(ctx, msg('Help with my budget'));
    expect(r.handled).toBe(true);
  });

  it('FinancialPlanningSkill matches investment queries', async () => {
    const skill = new FinancialPlanningSkill();
    const r = await skill.execute(ctx, msg('How to invest'));
    expect(r.handled).toBe(true);
  });
});

describe('Executive Assistant Template', () => {
  it('should create valid config', () => {
    const config = createExecutiveAssistantConfig();
    expect(config.metadata.name).toBe('executive-assistant');
    expect(config.spec.skills).toHaveLength(3);
  });

  it('CalendarSkill matches scheduling', async () => {
    const skill = new CalendarSkill();
    const r = await skill.execute(ctx, msg('Schedule a meeting'));
    expect(r.handled).toBe(true);
  });

  it('EmailDraftSkill matches email queries', async () => {
    const skill = new EmailDraftSkill();
    const r = await skill.execute(ctx, msg('Draft an email'));
    expect(r.handled).toBe(true);
  });

  it('MeetingPrepSkill matches prep queries', async () => {
    const skill = new MeetingPrepSkill();
    const r = await skill.execute(ctx, msg('Prepare the agenda'));
    expect(r.handled).toBe(true);
  });
});
