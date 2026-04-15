import type { Message } from '../core/types';

/**
 * LLM Provider interface — abstracts different LLM backends.
 * Uses agentkits when available, falls back to stub.
 */
export interface LLMProvider {
  name: string;
  chat(messages: Message[], systemPrompt?: string): Promise<string>;
}

class StubProvider implements LLMProvider {
  name: string;
  private model: string;

  constructor(name: string, model: string) {
    this.name = name;
    this.model = model;
  }

  async chat(messages: Message[], systemPrompt?: string): Promise<string> {
    // Try agentkits dynamic import
    try {
      const ak = await import('agentkits');
      const chat = ak.createChat({ provider: this.name as any, model: this.model });
      const formatted = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];
      const result = await (chat as any).send(formatted);
      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch {
      // Stub fallback when agentkits is not available
      const lastMessage = messages[messages.length - 1];
      return `[${this.name}/${this.model} stub] Received: "${lastMessage?.content ?? ''}"`;
    }
  }
}

export function createProvider(name: string = 'deepseek', model: string = 'deepseek-chat'): LLMProvider {
  return new StubProvider(name, model);
}

export const SUPPORTED_PROVIDERS = ['openai', 'deepseek', 'qwen'] as const;
