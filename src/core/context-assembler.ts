import { Message, AgentConfig, ChatMessage, EgoConfig, ContextLevel, SystemMessage } from './types';
import { DeepBrain } from '../deepbrain/provider';
import { readEgo } from '../deepbrain/workspace-files';

export function classifyMessage(content: string): ContextLevel {
  if (
    content.length < 20 &&
    /^(你好|hi|hello|谢谢|ok|好的|嗯)$/i.test(content.trim())
  ) {
    return 'simple';
  }
  if (/上次|之前|记得|历史|还记得|以前/.test(content)) return 'recall';
  return 'complex';
}

export async function assembleContext(
  userMessage: string,
  config: AgentConfig,
  history: Message[]
): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = [];

  // 1. System prompt from EGO.md in working directory
  const ego = await readEgo('.');
  const sysContent = ego ? formatEgoAsSystem(ego) : 'You are a helpful assistant.';
  messages.push({ role: 'system', content: sysContent } as SystemMessage);

  const level = classifyMessage(userMessage);

  // 2. Recall relevant memories (skip for simple greetings)
  if (level !== 'simple' && config.deepbrain) {
    try {
      const brain = new DeepBrain(config.deepbrain);
      await brain.init();
      const result = await brain.recall({ query: userMessage, topK: 5 });
      if (result.entries.length > 0) {
        const memBlock = result.entries.map(r => `- ${r.content}`).join('\n');
        messages.push({ role: 'system', content: `## 相关记忆\n${memBlock}` } as SystemMessage);
      }
    } catch {
      // non-fatal: continue without recall
    }
  }

  // 3. Surface skill hints for complex queries
  if (level === 'complex' && config.skills?.length) {
    const skillList = config.skills.map(s => `- ${s.name}: ${s.description}`).join('\n');
    messages.push({ role: 'system', content: `## 可用技能\n${skillList}` } as SystemMessage);
  }

  // 4. Recent conversation history (last 20 turns)
  for (const msg of history.slice(-20)) {
    messages.push({ role: msg.role, content: msg.content } as ChatMessage);
  }

  // 5. Current user message
  messages.push({ role: 'user', content: userMessage });

  return messages;
}

function formatEgoAsSystem(ego: EgoConfig): string {
  const parts: string[] = [
    `You are ${ego.identity.emoji} ${ego.identity.name}, a ${ego.identity.creature}.`,
  ];
  if (ego.role) parts.push(`Role: ${ego.role}`);
  if (ego.principles.length) {
    parts.push('Principles:\n' + ego.principles.map(p => `- ${p}`).join('\n'));
  }
  if (ego.egoContext) parts.push(ego.egoContext);
  return parts.join('\n\n');
}

export class ContextAssembler {
  constructor(private opts: { maxMessages?: number; systemPromptOverride?: string }) {}

  assemble(history: ChatMessage[], systemPrompt: string): ChatMessage[] {
    const sys: SystemMessage = {
      role: 'system',
      content: this.opts.systemPromptOverride ?? systemPrompt,
    };
    const max = this.opts.maxMessages ?? 50;
    const trimmed = history.length > max ? history.slice(history.length - max) : history;
    return [sys, ...trimmed];
  }
}
