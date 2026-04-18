import type { Message } from '../core/types';

export interface CompressorConfig {
  maxTokens: number;
  compressThreshold: number;
  preserveRecent: number;
  brain?: any;
}

export interface CompressResult {
  messages: Message[];
  learnedCount: number;
  savedTokens: number;
  summary: string;
}

const DEFAULT_CONFIG: CompressorConfig = {
  maxTokens: 8000,
  compressThreshold: 0.8,
  preserveRecent: 10,
};

/**
 * Context compression with optional DeepBrain memory offloading.
 */
export class ContextCompressor {
  private config: CompressorConfig;

  constructor(config: Partial<CompressorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Estimate token count using language-aware heuristic.
   * English: ~1 token per 4 chars. Chinese: ~1 token per 2 chars.
   */
  estimateTokens(text: string): number {
    let tokens = 0;
    for (const char of text) {
      // CJK Unicode range detection
      const code = char.codePointAt(0) ?? 0;
      if (
        (code >= 0x4e00 && code <= 0x9fff) ||  // CJK Unified
        (code >= 0x3400 && code <= 0x4dbf) ||  // CJK Extension A
        (code >= 0x3000 && code <= 0x303f)     // CJK Punctuation
      ) {
        tokens += 0.5; // 1 token per 2 chars
      } else {
        tokens += 0.25; // 1 token per 4 chars
      }
    }
    return Math.ceil(tokens);
  }

  private estimateMessagesTokens(messages: Message[]): number {
    return messages.reduce((sum, m) => sum + this.estimateTokens(m.content), 0);
  }

  /**
   * Extract key insights from messages for brain storage.
   */
  private extractInsights(messages: Message[]): Array<{ content: string; type: string }> {
    const insights: Array<{ content: string; type: string }> = [];
    for (const msg of messages) {
      const c = msg.content;
      // Decisions
      if (/\b(decided|decision|choose|chose|will use|going with|let's go|确定|决定)\b/i.test(c)) {
        insights.push({ content: c.slice(0, 500), type: 'decision' });
      }
      // Facts / definitions
      else if (/\b(is defined as|means|equals|refers to|是指|定义)\b/i.test(c)) {
        insights.push({ content: c.slice(0, 500), type: 'fact' });
      }
      // Preferences
      else if (/\b(prefer|like|want|don't like|不喜欢|喜欢|偏好)\b/i.test(c)) {
        insights.push({ content: c.slice(0, 500), type: 'preference' });
      }
      // Code snippets
      else if (/```[\s\S]{20,}```/.test(c)) {
        insights.push({ content: c.slice(0, 800), type: 'code' });
      }
      // Long assistant messages likely contain useful info
      else if (msg.role === 'assistant' && c.length > 200) {
        insights.push({ content: c.slice(0, 500), type: 'knowledge' });
      }
    }
    return insights;
  }

  /**
   * Generate a simple summary from messages (no-brain fallback).
   */
  private summarize(messages: Message[]): string {
    const topics = new Set<string>();
    const keyLines: string[] = [];

    for (const msg of messages) {
      // Extract first meaningful sentence
      const firstLine = msg.content.split(/[.\n!?。！？]/)[0]?.trim();
      if (firstLine && firstLine.length > 10 && firstLine.length < 200) {
        if (keyLines.length < 5) keyLines.push(`[${msg.role}] ${firstLine}`);
      }
      // Extract topic words (capitalized words, Chinese phrases)
      const words = msg.content.match(/[A-Z][a-z]{2,}/g) ?? [];
      words.forEach(w => topics.add(w));
    }

    const topicStr = [...topics].slice(0, 10).join(', ');
    const linesStr = keyLines.join('; ');
    return `Topics: ${topicStr || 'general discussion'}. Key points: ${linesStr || 'varied conversation'}`;
  }

  /**
   * Compress messages when token count exceeds threshold.
   */
  async compress(messages: Message[], config?: Partial<CompressorConfig>): Promise<CompressResult> {
    const cfg = { ...this.config, ...config };
    const totalTokens = this.estimateMessagesTokens(messages);
    const threshold = cfg.maxTokens * cfg.compressThreshold;

    // Under threshold — return as-is
    if (totalTokens <= threshold) {
      return {
        messages: [...messages],
        learnedCount: 0,
        savedTokens: 0,
        summary: '',
      };
    }

    const recentCount = Math.min(cfg.preserveRecent, messages.length);
    const splitIdx = messages.length - recentCount;
    const oldMessages = messages.slice(0, splitIdx);
    const recentMessages = messages.slice(splitIdx);

    if (oldMessages.length === 0) {
      return { messages: [...messages], learnedCount: 0, savedTokens: 0, summary: '' };
    }

    const oldTokens = this.estimateMessagesTokens(oldMessages);
    let learnedCount = 0;
    let summary: string;

    if (cfg.brain) {
      // Extract and learn insights
      const insights = this.extractInsights(oldMessages);
      for (const insight of insights) {
        try {
          await cfg.brain.learn(insight.content, { insight_type: insight.type });
          learnedCount++;
        } catch { /* non-critical */ }
      }
      summary = `${oldMessages.length} messages compressed. Extracted ${learnedCount} insights (${insights.map(i => i.type).filter((v, i, a) => a.indexOf(v) === i).join(', ')}).`;
    } else {
      summary = this.summarize(oldMessages);
    }

    const compressionMessage: Message = {
      id: `compressed-${Date.now()}`,
      role: 'system',
      content: `[Context compressed: ${oldMessages.length} messages → ${summary}${cfg.brain ? ' Details stored in Brain, use recall() to retrieve.' : ''}]`,
      timestamp: Date.now(),
    };

    return {
      messages: [compressionMessage, ...recentMessages],
      learnedCount,
      savedTokens: oldTokens - this.estimateTokens(compressionMessage.content),
      summary,
    };
  }

  /**
   * Restore context from brain for a given query.
   */
  async restore(query: string, brain: any): Promise<string[]> {
    if (!brain?.recall) return [];
    try {
      const results = await brain.recall(query);
      if (Array.isArray(results)) {
        return results.map((r: any) => typeof r === 'string' ? r : r.content ?? JSON.stringify(r));
      }
      if (typeof results === 'string') return [results];
      return [];
    } catch {
      return [];
    }
  }
}
