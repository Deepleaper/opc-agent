import { randomUUID } from 'crypto';
import type {
  DeepBrainProvider,
  DeepBrainConfig,
  KnowledgeEntry,
  RecallQuery,
  RecallResult,
  StoreResult,
  EvolutionLog,
  EvolutionConfig,
  DeepBrainLayer,
  DeepBrainStats,
} from '../core/types';
import { BrainStore } from './store';
import { Embedder } from './embedding';
import { recall } from './recall';

export class DeepBrain implements DeepBrainProvider {
  private db!: BrainStore;
  private embedder!: Embedder;

  constructor(private config: DeepBrainConfig) {}

  async init(): Promise<void> {
    const dbPath = this.config.dbPath || '.opc/brain.db';
    this.db = new BrainStore({ dbPath });
    await this.db.init();

    const model =
      this.config.embeddingModel && this.config.embeddingModel !== 'auto'
        ? this.config.embeddingModel
        : undefined;

    this.embedder = new Embedder(
      this.config.embeddingProvider === 'none' ? '' : model
    );
  }

  async store(
    entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<StoreResult> {
    const now = new Date().toISOString();
    const id = randomUUID();

    // Generate embedding if not provided
    let embedding = entry.embedding;
    if (embedding === null && this.config.embeddingProvider !== 'none') {
      embedding = await this.embedder.embed(entry.content);
    }

    const full: KnowledgeEntry = {
      ...entry,
      embedding,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.db.upsert(full);

    return { id, layer: entry.layer, success: true };
  }

  async recall(query: RecallQuery): Promise<RecallResult> {
    const start = Date.now();
    const entries = await recall(
      query.query,
      this.db,
      this.embedder,
      {
        topK: query.topK,
        layer: Array.isArray(query.layer) ? undefined : (query.layer as string | undefined),
      }
    );

    const result: RecallResult = {
      entries: query.includeEmbedding
        ? entries
        : entries.map((e) => ({ ...e, embedding: null })),
      query: query.query,
      elapsedMs: Date.now() - start,
    };

    // Increment use_count for recalled entries
    const now = new Date().toISOString();
    for (const e of entries) {
      this.db.upsert({ ...e, useCount: e.useCount + 1, lastUsed: now, updatedAt: now });
    }

    return result;
  }

  async evolve(layer: DeepBrainLayer, config?: Partial<EvolutionConfig>): Promise<EvolutionLog> {
    const now = new Date().toISOString();
    const log: EvolutionLog = {
      id: randomUUID(),
      layer,
      action: 'evolve',
      details: { config: config ?? {}, triggeredAt: now },
      modelUsed: this.config.embeddingModel || 'none',
      createdAt: now,
    };
    this.db.insertEvolutionLog(log);
    return log;
  }

  async getStats(): Promise<DeepBrainStats> {
    return {
      totalEntries: this.db.total(),
      entriesByLayer: this.db.countByLayer(),
      avgMaturityScore: this.db.avgMaturity(),
      lastEvolution: this.db.lastEvolutionTime(),
    };
  }
}
