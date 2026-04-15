import { BaseSkill } from '../skills/base';
import type { AgentContext, Message, SkillResult } from '../core/types';
import type { OADDocument } from '../schema/oad';

const LEGAL_TERMS: Record<string, string> = {
  'force majeure': 'A clause that frees parties from obligations due to extraordinary events.',
  'indemnification': 'One party agrees to compensate the other for certain damages or losses.',
  'limitation of liability': 'A cap on the amount one party can claim from the other.',
  'non-compete': 'Restricts a party from competing within a specified scope and timeframe.',
  'confidentiality': 'Obligations to keep certain information private.',
  'termination': 'Conditions under which the agreement may be ended.',
};

export class ContractReviewSkill extends BaseSkill {
  name = 'contract-review';
  description = 'Review contracts and identify key clauses';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    for (const [term, explanation] of Object.entries(LEGAL_TERMS)) {
      if (lower.includes(term)) {
        return this.match(`📋 **${term.toUpperCase()}**: ${explanation}`, 0.85);
      }
    }
    if (lower.includes('review') || lower.includes('contract')) {
      return this.match('I can review contracts for key clauses like force majeure, indemnification, limitation of liability, non-compete, confidentiality, and termination provisions.', 0.7);
    }
    return this.noMatch();
  }
}

export class ComplianceCheckSkill extends BaseSkill {
  name = 'compliance-check';
  description = 'Check compliance with regulations';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('gdpr') || lower.includes('privacy')) {
      return this.match('GDPR compliance requires: data minimization, consent mechanisms, right to erasure, data protection officer, and breach notification within 72 hours.', 0.9);
    }
    if (lower.includes('compliance') || lower.includes('regulation')) {
      return this.match('I can check compliance with GDPR, CCPA, SOX, HIPAA, and other major regulations. Please specify the regulation and context.', 0.7);
    }
    return this.noMatch();
  }
}

export function createLegalAssistantConfig(): OADDocument {
  return {
    apiVersion: 'opc/v1',
    kind: 'Agent',
    metadata: {
      name: 'legal-assistant',
      version: '1.0.0',
      description: 'AI Legal Assistant - contract review, compliance checking, legal research',
      author: 'OPC',
      license: 'Apache-2.0',
    },
    spec: {
      model: 'deepseek-chat',
      systemPrompt: 'You are a legal assistant AI. Help users review contracts, check compliance, and research legal topics. Always recommend consulting a qualified attorney for binding decisions.',
      skills: [
        { name: 'contract-review', description: 'Review contracts and identify key clauses' },
        { name: 'compliance-check', description: 'Check regulatory compliance' },
      ],
      channels: [{ type: 'web', port: 3000 }],
      memory: { shortTerm: true, longTerm: false },
      streaming: false,
    },
  };
}
