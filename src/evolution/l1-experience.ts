// L1 evolution — experience compilation: MicroCompact + Contrastive Reflection
import { randomUUID } from 'crypto';
import type { Message, EvolutionConfig, DeepBrainProvider } from '../core/types';
import type { ModelRouter } from '../providers/router';
import { BrainStore } from '../deepbrain/store';

// MicroCompact: compress old tool outputs, keep the most recent N intact
export function microCompact(messages: Message[], keepRecent = 3): Message[] {
  const toolIndices: number[] = [];
  messages.forEach((m, i) => {
    if (m.metadata?.toolCallId || m.metadata?.isToolResult) {
      toolIndices.push(i);
    }
  });

  const keepSet = new Set(toolIndices.slice(-keepRecent));

  return messages.map((m, i) => {
    if ((m.metadata?.toolCallId || m.metadata?.isToolResult) && !keepSet.has(i)) {
      const toolName = String(m.metadata?.toolName ?? 'unknown');
      const byteCount = Buffer.byteLength(m.content, 'utf-8');
      return {
        ...m,
        content: `[tool result compressed: ${toolName} returned ${byteCount} bytes]`,
      };
    }
    return m;
  });
}

// Contrastive Reflection: compare success/failure paths, extract lessons
export async function compileExperience(
  messages: Message[],
  config: EvolutionConfig,
  router: ModelRouter,
  brain: DeepBrainProvider
): Promise<void> {
  if (!config.l1.enabled) return;

  if (config.strategy === 'free') {
    const keywords = extractKeywords(messages);
    await brain.store({
      content: keywords.join(', '),
      source: 'l1',
      layer: 'workstation',
      tags: ['keywords', 'l1'],
      embedding: null,
      maturityScore: 0,
      useCount: 0,
      lastUsed: '',
    });
    return;
  }

  const provider = router.getProvider('l1');
  const reflectPrompt = `对比以下对话中的成功和失败路径，提取3个关键教训。只输出JSON：
{"summary":"一句话总结","lessons":["教训1","教训2","教训3"],"errorPatterns":["错误模式"]}`;

  const response = await provider.chat({
    systemPrompt: reflectPrompt,
    messages: [{
      id: randomUUID(),
      role: 'user',
      content: formatMessagesForReflection(messages),
      timestamp: Date.now(),
    }],
  });

  const text = response.message.content;
  const parsed = safeParseJSON(text);

  await brain.store({
    content: JSON.stringify({
      summary: (parsed.summary as string | undefined) ?? text.slice(0, 200),
      lessons: (parsed.lessons as string[] | undefined) ?? [],
      errorPatterns: (parsed.errorPatterns as string[] | undefined) ?? [],
    }),
    source: 'l1',
    layer: 'workstation',
    tags: ['experience', 'reflection', 'l1'],
    embedding: null,
    maturityScore: 0,
    useCount: 0,
    lastUsed: '',
  });

  await brain.evolve('l1', config);
}

function extractKeywords(messages: Message[]): string[] {
  const stopWords = new Set([
    '的', '了', '是', '在', '我', '你', '他', '她', '它', '们', '和',
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
    'should', 'may', 'might', 'can', 'could', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'it', 'this', 'that',
  ]);

  const freq = new Map<string, number>();

  for (const msg of messages) {
    const words = msg.content
      .toLowerCase()
      .replace(/[^\w一-鿿\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !stopWords.has(w));

    for (const word of words) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function formatMessagesForReflection(messages: Message[]): string {
  return messages
    .slice(-20)
    .map(m => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 500)}`)
    .join('\n');
}

function safeParseJSON(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * L1 direct compilation for CLI context — no ModelRouter needed.
 * Calls Ollama qwen2.5:0.5b to extract summary/keywords/preferences,
 * then persists to brain.db at the given path.
 */
export async function compileL1Direct(
  userInput: string,
  assistantReply: string,
  dbPath: string,
  ollamaUrl = 'http://localhost:11434'
): Promise<void> {
  const conversationText = `用户: ${userInput.slice(0, 600)}\n助手: ${assistantReply.slice(0, 600)}`;
  const prompt = `从以下对话提取关键信息。只输出JSON，不输出其他内容：
{"summary":"一句话总结","keywords":["关键词1","关键词2"],"userPreferences":["偏好1"]}

对话：
${conversationText}`;

  let summary = '';
  let keywords: string[] = [];
  let userPreferences: string[] = [];

  try {
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'qwen2.5:0.5b', prompt, stream: false }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) {
      const data = await res.json() as Record<string, unknown>;
      const parsed = safeParseJSON((data['response'] as string) || '');
      summary = (parsed['summary'] as string) || '';
      keywords = Array.isArray(parsed['keywords']) ? (parsed['keywords'] as string[]) : [];
      userPreferences = Array.isArray(parsed['userPreferences']) ? (parsed['userPreferences'] as string[]) : [];
    }
  } catch { /* Ollama unavailable — fall through to keyword fallback */ }

  // Fallback: simple keyword extraction when Ollama is unreachable or returns nothing
  if (!summary && keywords.length === 0) {
    const msgs: Message[] = [
      { id: randomUUID(), role: 'user', content: userInput, timestamp: Date.now() },
      { id: randomUUID(), role: 'assistant', content: assistantReply, timestamp: Date.now() },
    ];
    keywords = extractKeywords(msgs);
    summary = userInput.slice(0, 100);
  }

  const parts: string[] = [];
  if (summary) parts.push(`Summary: ${summary}`);
  if (keywords.length > 0) parts.push(`Keywords: ${keywords.join(', ')}`);
  if (userPreferences.length > 0) parts.push(`Preferences: ${userPreferences.join(', ')}`);
  const content = parts.join('\n');

  const store = new BrainStore({ dbPath });
  await store.init();
  const now = new Date().toISOString();
  store.upsert({
    id: randomUUID(),
    content,
    source: 'l1',
    layer: 'workstation',
    tags: ['l1', 'experience', ...keywords.slice(0, 5)],
    embedding: null,
    maturityScore: 0,
    useCount: 0,
    lastUsed: now,
    createdAt: now,
    updatedAt: now,
  });
  store.close();
}
