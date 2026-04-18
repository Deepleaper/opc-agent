import * as fs from 'fs';
import * as path from 'path';

export interface BrainSeedConfig {
  seeds: string[];
  autoSeed: boolean;
  seedMarkerFile?: string;
  evolve?: {
    enabled: boolean;
    direction: 'bottom-up' | 'top-down';
  };
}

export interface SeedPage {
  slug: string;
  content: string;
  tier: string;
}

export interface SeedResult {
  imported: number;
  pages: string[];
}

export interface PromotionCandidate {
  slug: string;
  content: string;
  fromTier: string;
  toTier: string;
  confidence: number;
}

export interface PromotionResult {
  candidates: PromotionCandidate[];
  promoted: number;
}

export class BrainSeedLoader {
  private markerFile: string;

  constructor(private agentDir: string, private config: BrainSeedConfig) {
    this.markerFile = config.seedMarkerFile
      ? path.resolve(agentDir, config.seedMarkerFile)
      : path.resolve(agentDir, '.brain-seeded');
  }

  async isSeeded(): Promise<boolean> {
    return fs.existsSync(this.markerFile);
  }

  async seedBrain(brain: any): Promise<SeedResult> {
    const allPages: SeedPage[] = [];

    for (const seedPath of this.config.seeds) {
      const fullPath = path.resolve(this.agentDir, seedPath);
      if (!fs.existsSync(fullPath)) continue;

      const tier = this.inferTier(seedPath);
      const pages = this.parseSeedFile(fullPath, tier);
      allPages.push(...pages);
    }

    const importedSlugs: string[] = [];
    for (const page of allPages) {
      if (brain && typeof brain.store === 'function') {
        await brain.store('brain-seeds', page.slug, page.content, {
          tier: page.tier,
          source: 'brain-seed',
        });
      } else if (brain && typeof brain.learn === 'function') {
        await brain.learn(page.content, {
          tags: ['brain-seed', page.tier],
          slug: page.slug,
        });
      }
      importedSlugs.push(page.slug);
    }

    return { imported: importedSlugs.length, pages: importedSlugs };
  }

  async markSeeded(): Promise<void> {
    const dir = path.dirname(this.markerFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.markerFile, JSON.stringify({
      seededAt: new Date().toISOString(),
      seeds: this.config.seeds,
    }, null, 2));
  }

  parseSeedFile(filePath: string, tier: string): SeedPage[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const pages: SeedPage[] = [];
    const sections = content.split(/^## /m);

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      const newlineIdx = trimmed.indexOf('\n');
      if (newlineIdx === -1 && sections.indexOf(section) === 0 && !content.trimStart().startsWith('## ')) {
        // This is preamble before any ## heading — skip or treat as intro
        continue;
      }

      let title: string;
      let body: string;

      if (sections.indexOf(section) === 0 && !content.trimStart().startsWith('## ')) {
        // Preamble (before first ##)
        continue;
      }

      if (newlineIdx === -1) {
        title = trimmed;
        body = '';
      } else {
        title = trimmed.slice(0, newlineIdx).trim();
        body = trimmed.slice(newlineIdx + 1).trim();
      }

      const slug = `seed/${tier}/${this.slugify(title)}`;
      pages.push({ slug, content: `## ${title}\n\n${body}`, tier });
    }

    return pages;
  }

  private inferTier(seedPath: string): string {
    const basename = path.basename(seedPath, path.extname(seedPath)).toLowerCase();
    if (basename.includes('industry')) return 'industry';
    if (basename.includes('job')) return 'job';
    if (basename.includes('workstation')) return 'workstation';
    return 'workstation';
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

export class KnowledgeEvolver {
  private tierOrder = ['workstation', 'job', 'industry'];

  async checkPromotion(brain: any, options: {
    minInteractions?: number;
    confidenceThreshold?: number;
  } = {}): Promise<PromotionResult> {
    const minInteractions = options.minInteractions ?? 50;
    const confidenceThreshold = options.confidenceThreshold ?? 0.8;

    const result: PromotionResult = { candidates: [], promoted: 0 };

    // Search for frequently referenced seed knowledge
    if (!brain || typeof brain.search !== 'function') return result;

    try {
      const seedPages = await brain.search('brain-seeds', 'seed/', 100);
      if (!Array.isArray(seedPages)) return result;

      for (const page of seedPages) {
        const meta = page.metadata || {};
        const usageCount = meta.usageCount ?? 0;
        const tier = meta.tier || 'workstation';

        if (usageCount < minInteractions) continue;

        const confidence = Math.min(usageCount / (minInteractions * 2), 1.0);
        if (confidence < confidenceThreshold) continue;

        const tierIdx = this.tierOrder.indexOf(tier);
        if (tierIdx <= 0) continue; // already at highest tier or unknown

        const toTier = this.tierOrder[tierIdx - 1];
        result.candidates.push({
          slug: page.id || page.slug,
          content: page.content,
          fromTier: tier,
          toTier,
          confidence,
        });
      }
    } catch {
      // Silent fail
    }

    return result;
  }

  async promoteToJob(brain: any, knowledge: string, jobSlug: string): Promise<void> {
    if (brain && typeof brain.store === 'function') {
      await brain.store('brain-seeds', jobSlug, knowledge, {
        tier: 'job',
        source: 'promotion',
        promotedAt: new Date().toISOString(),
      });
    }
  }

  async promoteToIndustry(brain: any, knowledge: string, industrySlug: string): Promise<void> {
    if (brain && typeof brain.store === 'function') {
      await brain.store('brain-seeds', industrySlug, knowledge, {
        tier: 'industry',
        source: 'promotion',
        promotedAt: new Date().toISOString(),
      });
    }
  }
}
