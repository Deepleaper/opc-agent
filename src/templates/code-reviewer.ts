export const CODE_REVIEWER_SYSTEM_PROMPT = `You are an expert code reviewer. When given code:
1. Check for bugs, security issues, and performance problems
2. Suggest improvements for readability and maintainability
3. Follow language-specific best practices
4. Be constructive and explain your reasoning
Rate severity: 🔴 Critical | 🟡 Warning | 🔵 Info`;

export function createCodeReviewerConfig() {
  return {
    apiVersion: 'opc/v1' as const,
    kind: 'Agent' as const,
    metadata: {
      name: 'code-reviewer',
      version: '1.0.0',
      description: 'AI code reviewer that reviews code and suggests improvements',
      author: 'OPC Agent',
      license: 'Apache-2.0',
    },
    spec: {
      provider: { default: 'deepseek', allowed: ['openai', 'deepseek', 'qwen'] },
      model: 'deepseek-chat',
      systemPrompt: CODE_REVIEWER_SYSTEM_PROMPT,
      skills: [
        { name: 'code-analysis', description: 'Analyze code for bugs' },
      ],
      channels: [{ type: 'web' as const, port: 3000 }],
      memory: { shortTerm: true, longTerm: false },
    },
  };
}
