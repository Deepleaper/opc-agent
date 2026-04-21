// Maturity scorer — computes knowledge entry promotion readiness (0–1)
import type { KnowledgeEntry } from '../core/types';

export interface MaturityFactors {
  useCount: number;
  ageMs: number;
  recentAccessMs?: number;
  tagDiversity: number;
  hasEmbedding: boolean;
}

export function computeMaturityScore(factors: MaturityFactors): number {
  const useWeight = Math.min(factors.useCount / 20, 1) * 0.4;
  const ageWeight = Math.min(factors.ageMs / (7 * 86400_000), 1) * 0.2;
  const tagWeight = Math.min(factors.tagDiversity / 5, 1) * 0.2;
  const embedWeight = factors.hasEmbedding ? 0.2 : 0;
  return useWeight + ageWeight + tagWeight + embedWeight;
}

export function scoreEntry(entry: KnowledgeEntry): number {
  return computeMaturityScore({
    useCount: entry.useCount,
    ageMs: Date.now() - new Date(entry.createdAt).getTime(),
    recentAccessMs: entry.lastUsed ? Date.now() - new Date(entry.lastUsed).getTime() : undefined,
    tagDiversity: entry.tags.length,
    hasEmbedding: Array.isArray(entry.embedding) && entry.embedding.length > 0,
  });
}
