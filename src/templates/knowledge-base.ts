export const KNOWLEDGE_BASE_SYSTEM_PROMPT = `You are a knowledge base assistant. Answer questions using the company documents
and knowledge provided to you. If you don't have enough information, say so honestly.
Always cite sources when possible. Be accurate and concise.`;

export function createKnowledgeBaseConfig() {
  return {
    apiVersion: 'opc/v1' as const,
    kind: 'Agent' as const,
    metadata: {
      name: 'knowledge-base',
      version: '1.0.0',
      description: 'RAG-powered knowledge base agent using DeepBrain for semantic search',
      author: 'OPC Agent',
      license: 'Apache-2.0',
    },
    spec: {
      provider: { default: 'deepseek', allowed: ['openai', 'deepseek', 'qwen'] },
      model: 'deepseek-chat',
      systemPrompt: KNOWLEDGE_BASE_SYSTEM_PROMPT,
      skills: [
        { name: 'doc-search', description: 'Search company documents' },
      ],
      channels: [{ type: 'web' as const, port: 3000 }],
      memory: { shortTerm: true, longTerm: { provider: 'deepbrain' as const, collection: 'company-knowledge' } },
      dtv: {
        trust: { level: 'sandbox' as const },
        value: { metrics: ['queries_answered', 'docs_indexed'] },
      },
    },
  };
}
