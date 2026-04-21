import type { KnowledgeEntry } from '../core/types';
import type { BrainStore } from './store';
import { Embedder, cosineSimilarity } from './embedding';

export { Embedder };

export async function recall(
  query: string,
  store: BrainStore,
  embedder: Embedder,
  opts?: { topK?: number; layer?: string }
): Promise<KnowledgeEntry[]> {
  const topK = opts?.topK ?? 5;

  // 1. FTS5 / LIKE keyword search
  const ftsRaw = store.ftsSearch(query, topK * 6);

  // Normalize FTS ranks to [0, 1]
  const ftsMap = new Map<string, number>();
  const maxFts = ftsRaw.reduce((m, r) => Math.max(m, r.rank), 0.001);
  for (const r of ftsRaw) {
    ftsMap.set(r.entry.id, r.rank / maxFts);
  }

  // 2. Vector embedding of query
  const queryVec = await embedder.embed(query);

  // Candidate set: all entries when embedding available (for vector recall),
  // otherwise only FTS hits
  const candidates: KnowledgeEntry[] = queryVec
    ? store.getAll()
    : ftsRaw.map((r) => r.entry);

  // Optional layer filter
  const filtered = opts?.layer
    ? candidates.filter((e) => e.layer === opts.layer)
    : candidates;

  // 3. Score and fuse
  const scored = filtered.map((entry) => {
    const scoreFts = ftsMap.get(entry.id) ?? 0;

    let scoreVec = 0;
    if (queryVec && entry.embedding) {
      scoreVec = Math.max(0, cosineSimilarity(queryVec, entry.embedding));
    }

    const maturity = Math.min(1, Math.max(0, entry.maturityScore));

    const score = queryVec
      ? 0.4 * scoreFts + 0.4 * scoreVec + 0.2 * maturity
      : 0.8 * scoreFts + 0.2 * maturity;

    return { entry, score };
  });

  // 4. Return top-k by descending score (require some signal)
  scored.sort((a, b) => b.score - a.score);

  return scored
    .filter((s) => s.score > 0)
    .slice(0, topK)
    .map((s) => s.entry);
}
