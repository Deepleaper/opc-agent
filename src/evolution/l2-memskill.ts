// L2 MemSkill — learnable recall strategy based on feedback accumulation
import type { DeepBrainProvider } from '../core/types';

interface FeedbackRecord {
  type: string;
  query: string;
  resultCount: number;
  accepted: boolean;
}

export class MemSkill {
  constructor(private brain: DeepBrainProvider) {}

  async recordRecallFeedback(
    query: string,
    results: string[],
    accepted: boolean
  ): Promise<void> {
    await this.brain.store({
      content: JSON.stringify({
        type: 'recall_feedback',
        query,
        resultCount: results.length,
        accepted,
      } satisfies FeedbackRecord),
      source: 'l2',
      layer: 'workstation',
      tags: ['recall_feedback', accepted ? 'accepted' : 'rejected'],
      embedding: null,
      maturityScore: 0,
      useCount: 0,
      lastUsed: '',
    });
  }

  async getOptimizedWeights(): Promise<{ fts: number; vec: number; maturity: number }> {
    const recalled = await this.brain.recall({
      query: 'recall feedback accepted rejected',
      topK: 200,
    });

    let accepted = 0;
    let total = 0;

    for (const entry of recalled.entries) {
      let data: FeedbackRecord;
      try {
        data = JSON.parse(entry.content) as FeedbackRecord;
      } catch {
        continue;
      }
      if (data.type !== 'recall_feedback') continue;
      total++;
      if (data.accepted) accepted++;
    }

    const acceptRate = total > 0 ? accepted / total : 0.5;

    // High acceptance → boost vector; low → fall back to FTS
    return {
      fts: Math.max(0.1, 1 - acceptRate * 0.8),
      vec: Math.max(0.1, acceptRate * 0.8),
      maturity: 0.3,
    };
  }
}
