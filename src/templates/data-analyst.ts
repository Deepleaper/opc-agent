import { BaseSkill } from '../skills/base';
import type { AgentContext, Message, SkillResult } from '../core/types';

export class DataQuerySkill extends BaseSkill {
  name = 'data-query';
  description = 'Help users query and analyze data';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('average') || lower.includes('mean') || lower.includes('sum') || lower.includes('count')) {
      return this.match('I can help with that calculation. Could you share the dataset or describe the data source?', 0.8);
    }
    if (lower.includes('chart') || lower.includes('graph') || lower.includes('visualize') || lower.includes('plot')) {
      return this.match('I can help create visualizations. What type of chart would you like? (bar, line, pie, scatter)', 0.85);
    }
    if (lower.includes('csv') || lower.includes('excel') || lower.includes('spreadsheet')) {
      return this.match('I can analyze CSV/Excel data. Please share the file or paste the data.', 0.8);
    }
    return this.noMatch();
  }
}

export class InsightSkill extends BaseSkill {
  name = 'insight-generator';
  description = 'Generate insights from data patterns';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('trend') || lower.includes('pattern') || lower.includes('insight') || lower.includes('anomaly')) {
      return this.match('I\'ll analyze the data for trends and anomalies. Please provide the dataset or describe what you\'re looking for.', 0.8);
    }
    return this.noMatch();
  }
}

export const DATA_ANALYST_SYSTEM_PROMPT = `You are a professional data analyst assistant. Your goals:
1. Help users query, transform, and analyze data
2. Create clear visualizations and summaries
3. Identify trends, patterns, and anomalies
4. Explain findings in plain language
Be precise with numbers, always cite your data source, and suggest next steps for deeper analysis.`;

export function createDataAnalystConfig() {
  return {
    apiVersion: 'opc/v1' as const,
    kind: 'Agent' as const,
    metadata: {
      name: 'data-analyst',
      version: '1.0.0',
      description: 'AI data analyst with data querying, visualization, and insight generation',
      author: 'OPC Agent',
      license: 'Apache-2.0',
    },
    spec: {
      provider: { default: 'openai', allowed: ['openai', 'deepseek', 'qwen'] },
      model: 'gpt-4o-mini',
      systemPrompt: DATA_ANALYST_SYSTEM_PROMPT,
      skills: [
        { name: 'data-query', description: 'Query and transform data' },
        { name: 'insight-generator', description: 'Generate data insights' },
      ],
      channels: [{ type: 'web' as const, port: 3000 }],
      memory: { shortTerm: true, longTerm: true },
      dtv: {
        trust: { level: 'sandbox' as const },
        value: { metrics: ['queries_processed', 'insights_generated'] },
      },
    },
  };
}
