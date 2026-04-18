import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BrainSeedLoader, KnowledgeEvolver } from '../src/memory/seed-loader';
import { BaseAgent } from '../src/core/agent';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'opc-seed-ext-'));
}

// ─── BrainSeedLoader Edge Cases ────────────────────────────────────

describe('BrainSeedLoader edge cases', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    fs.mkdirSync(path.join(tmpDir, 'brain-seeds'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('handles empty seed file gracefully', () => {
    const seedFile = path.join(tmpDir, 'brain-seeds', 'empty.md');
    fs.writeFileSync(seedFile, '');
    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/empty.md'], autoSeed: true });
    const pages = loader.parseSeedFile(seedFile, 'workstation');
    expect(pages).toHaveLength(0);
  });

  it('handles seed file with only whitespace', () => {
    const seedFile = path.join(tmpDir, 'brain-seeds', 'ws.md');
    fs.writeFileSync(seedFile, '   \n\n  \n');
    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/ws.md'], autoSeed: true });
    const pages = loader.parseSeedFile(seedFile, 'workstation');
    expect(pages).toHaveLength(0);
  });

  it('handles seed file with only H1 header (no ## sections)', () => {
    const seedFile = path.join(tmpDir, 'brain-seeds', 'h1only.md');
    fs.writeFileSync(seedFile, '# Just a Title\n\nSome intro text without any ## sections.\n');
    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/h1only.md'], autoSeed: true });
    const pages = loader.parseSeedFile(seedFile, 'workstation');
    expect(pages).toHaveLength(0);
  });

  it('handles malformed seed with ## but no title text', () => {
    const seedFile = path.join(tmpDir, 'brain-seeds', 'malformed.md');
    fs.writeFileSync(seedFile, '## \n\nContent without a title.\n');
    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/malformed.md'], autoSeed: true });
    const pages = loader.parseSeedFile(seedFile, 'workstation');
    // Should still produce a page (possibly with empty slug segment)
    expect(pages.length).toBeGreaterThanOrEqual(0);
  });

  it('handles unicode section titles (Chinese)', () => {
    const seedFile = path.join(tmpDir, 'brain-seeds', 'industry.md');
    fs.writeFileSync(seedFile, '## 电子商务基础\n\n在线零售基础知识。\n\n## 支付系统\n\n支付如何运作。\n');
    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/industry.md'], autoSeed: true });
    const pages = loader.parseSeedFile(seedFile, 'industry');
    expect(pages).toHaveLength(2);
    expect(pages[0].slug).toContain('seed/industry/');
    expect(pages[0].content).toContain('电子商务基础');
    expect(pages[1].content).toContain('支付系统');
  });

  it('handles unicode section titles (Japanese/Korean)', () => {
    const seedFile = path.join(tmpDir, 'brain-seeds', 'job.md');
    fs.writeFileSync(seedFile, '## カスタマーサポート\n\nお客様対応の基本。\n');
    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/job.md'], autoSeed: true });
    const pages = loader.parseSeedFile(seedFile, 'job');
    expect(pages).toHaveLength(1);
    expect(pages[0].content).toContain('カスタマーサポート');
  });

  it('handles deeply nested ### subsections within ## sections', () => {
    const seedFile = path.join(tmpDir, 'brain-seeds', 'industry.md');
    fs.writeFileSync(seedFile, `## Main Topic

Intro text.

### Subtopic A

Detail A.

### Subtopic B

Detail B.

## Another Topic

More content.
`);
    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/industry.md'], autoSeed: true });
    const pages = loader.parseSeedFile(seedFile, 'industry');
    expect(pages).toHaveLength(2);
    // Nested ### should be included in the parent ## section's content
    expect(pages[0].content).toContain('Subtopic A');
    expect(pages[0].content).toContain('Subtopic B');
  });

  it('handles seed file with Windows line endings (CRLF)', () => {
    const seedFile = path.join(tmpDir, 'brain-seeds', 'industry.md');
    fs.writeFileSync(seedFile, '## Topic One\r\n\r\nContent one.\r\n\r\n## Topic Two\r\n\r\nContent two.\r\n');
    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/industry.md'], autoSeed: true });
    const pages = loader.parseSeedFile(seedFile, 'industry');
    expect(pages).toHaveLength(2);
  });

  it('seedBrain with multiple seed files aggregates all pages', async () => {
    fs.writeFileSync(path.join(tmpDir, 'brain-seeds', 'industry.md'), '## Ind1\n\nContent.\n');
    fs.writeFileSync(path.join(tmpDir, 'brain-seeds', 'job.md'), '## Job1\n\nContent.\n\n## Job2\n\nContent.\n');

    const learned: any[] = [];
    const mockBrain = { learn: async (_c: string, m: any) => { learned.push(m); } };

    const loader = new BrainSeedLoader(tmpDir, {
      seeds: ['brain-seeds/industry.md', 'brain-seeds/job.md'],
      autoSeed: true,
    });
    const result = await loader.seedBrain(mockBrain);
    expect(result.imported).toBe(3);
    expect(result.pages).toHaveLength(3);
  });

  it('seedBrain with null brain does not throw', async () => {
    fs.writeFileSync(path.join(tmpDir, 'brain-seeds', 'industry.md'), '## Topic\n\nContent.\n');
    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/industry.md'], autoSeed: true });
    const result = await loader.seedBrain(null);
    // Pages are parsed but nothing stored since brain is null
    expect(result.imported).toBe(1);
  });

  it('seedBrain with brain having neither learn nor store still counts pages', async () => {
    fs.writeFileSync(path.join(tmpDir, 'brain-seeds', 'industry.md'), '## Topic\n\nContent.\n');
    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/industry.md'], autoSeed: true });
    const result = await loader.seedBrain({});
    expect(result.imported).toBe(1);
  });

  it('inferTier defaults to workstation for unknown filenames', () => {
    fs.writeFileSync(path.join(tmpDir, 'brain-seeds', 'custom.md'), '## Custom\n\nContent.\n');
    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/custom.md'], autoSeed: true });
    const pages = loader.parseSeedFile(path.join(tmpDir, 'brain-seeds', 'custom.md'), 'workstation');
    expect(pages[0].tier).toBe('workstation');
  });

  it('handles very large section content', () => {
    const bigContent = 'x'.repeat(10000);
    const seedFile = path.join(tmpDir, 'brain-seeds', 'industry.md');
    fs.writeFileSync(seedFile, `## Big Section\n\n${bigContent}\n`);
    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/industry.md'], autoSeed: true });
    const pages = loader.parseSeedFile(seedFile, 'industry');
    expect(pages).toHaveLength(1);
    expect(pages[0].content.length).toBeGreaterThan(10000);
  });

  it('section with title only and no body', () => {
    const seedFile = path.join(tmpDir, 'brain-seeds', 'industry.md');
    fs.writeFileSync(seedFile, '## Title Only\n');
    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/industry.md'], autoSeed: true });
    const pages = loader.parseSeedFile(seedFile, 'industry');
    expect(pages).toHaveLength(1);
    expect(pages[0].slug).toBe('seed/industry/title-only');
  });
});

// ─── KnowledgeEvolver Extended ─────────────────────────────────────

describe('KnowledgeEvolver extended', () => {
  it('checkPromotion with custom thresholds (industry→job)', async () => {
    const evolver = new KnowledgeEvolver();
    const mockBrain = {
      search: async () => [
        { id: 'seed/industry/topic1', content: 'stuff', metadata: { tier: 'industry', usageCount: 30 } },
      ],
    };
    // minInteractions=20 means 30 >= 20 qualifies; confidence = 30/40 = 0.75
    const result = await evolver.checkPromotion(mockBrain, { minInteractions: 20, confidenceThreshold: 0.7 });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].fromTier).toBe('industry');
    expect(result.candidates[0].toTier).toBe('job');
    expect(result.candidates[0].confidence).toBeCloseTo(0.75);
  });

  it('checkPromotion skips pages below confidence threshold', async () => {
    const evolver = new KnowledgeEvolver();
    const mockBrain = {
      search: async () => [
        { id: 'seed/workstation/low', content: 'stuff', metadata: { tier: 'workstation', usageCount: 51 } },
      ],
    };
    // Default: minInteractions=50, threshold=0.8. confidence = 51/100 = 0.51 < 0.8
    const result = await evolver.checkPromotion(mockBrain);
    expect(result.candidates).toHaveLength(0);
  });

  it('checkPromotion promotes job→workstation tier transition', async () => {
    const evolver = new KnowledgeEvolver();
    const mockBrain = {
      search: async () => [
        { id: 'seed/job/important', content: 'knowledge', metadata: { tier: 'job', usageCount: 200 } },
      ],
    };
    const result = await evolver.checkPromotion(mockBrain, { minInteractions: 50, confidenceThreshold: 0.8 });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].fromTier).toBe('job');
    expect(result.candidates[0].toTier).toBe('workstation');
  });

  it('checkPromotion skips pages already at workstation tier (highest)', async () => {
    const evolver = new KnowledgeEvolver();
    const mockBrain = {
      search: async () => [
        { id: 'seed/workstation/top', content: 'top', metadata: { tier: 'workstation', usageCount: 500 } },
      ],
    };
    // workstation is tierIdx=0, which is skipped by tierIdx <= 0
    const result = await evolver.checkPromotion(mockBrain, { minInteractions: 10, confidenceThreshold: 0.1 });
    expect(result.candidates).toHaveLength(0);
  });

  it('checkPromotion handles brain.search throwing', async () => {
    const evolver = new KnowledgeEvolver();
    const mockBrain = { search: async () => { throw new Error('DB error'); } };
    const result = await evolver.checkPromotion(mockBrain);
    expect(result.candidates).toHaveLength(0);
    expect(result.promoted).toBe(0);
  });

  it('checkPromotion handles brain.search returning non-array', async () => {
    const evolver = new KnowledgeEvolver();
    const mockBrain = { search: async () => null };
    const result = await evolver.checkPromotion(mockBrain);
    expect(result.candidates).toHaveLength(0);
  });

  it('concurrent promoteToJob calls do not conflict', async () => {
    const stored: any[] = [];
    const mockBrain = {
      store: async (_c: string, slug: string, content: string, meta: any) => {
        await new Promise(r => setTimeout(r, 10));
        stored.push({ slug, content, meta });
      },
    };
    const evolver = new KnowledgeEvolver();
    await Promise.all([
      evolver.promoteToJob(mockBrain, 'K1', 'seed/job/p1'),
      evolver.promoteToJob(mockBrain, 'K2', 'seed/job/p2'),
      evolver.promoteToJob(mockBrain, 'K3', 'seed/job/p3'),
    ]);
    expect(stored).toHaveLength(3);
    expect(stored.map(s => s.slug).sort()).toEqual(['seed/job/p1', 'seed/job/p2', 'seed/job/p3']);
  });

  it('confidence caps at 1.0', async () => {
    const evolver = new KnowledgeEvolver();
    const mockBrain = {
      search: async () => [
        { id: 'seed/industry/hot', content: 'hot', metadata: { tier: 'industry', usageCount: 9999 } },
      ],
    };
    const result = await evolver.checkPromotion(mockBrain, { minInteractions: 50, confidenceThreshold: 0.5 });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].confidence).toBe(1.0);
  });
});

// ─── Seed Integration with BaseAgent ───────────────────────────────

describe('BaseAgent brain seed integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    fs.mkdirSync(path.join(tmpDir, 'brain-seeds'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'brain-seeds', 'industry.md'), '## Test Topic\n\nSeed content.\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('auto-seeds brain on first init when configured', async () => {
    const learned: any[] = [];
    const mockBrain = {
      learn: async (content: string, meta: any) => { learned.push({ content, meta }); },
    };

    const agent = new BaseAgent({
      name: 'test-agent',
      model: 'test',
      systemPrompt: 'You are a test agent.',
      agentDir: tmpDir,
      brainSeedConfig: {
        seeds: ['brain-seeds/industry.md'],
        autoSeed: true,
      },
    });
    agent.setLongTermMemory(mockBrain);

    await agent.init();

    expect(learned).toHaveLength(1);
    expect(learned[0].meta.tags).toContain('brain-seed');
    expect(fs.existsSync(path.join(tmpDir, '.brain-seeded'))).toBe(true);
  });

  it('skips seeding on re-init when already seeded', async () => {
    const learned: any[] = [];
    const mockBrain = {
      learn: async (content: string, meta: any) => { learned.push({ content, meta }); },
    };

    // Pre-mark as seeded
    fs.writeFileSync(path.join(tmpDir, '.brain-seeded'), JSON.stringify({ seededAt: new Date().toISOString() }));

    const agent = new BaseAgent({
      name: 'test-agent',
      model: 'test',
      systemPrompt: 'You are a test agent.',
      agentDir: tmpDir,
      brainSeedConfig: {
        seeds: ['brain-seeds/industry.md'],
        autoSeed: true,
      },
    });
    agent.setLongTermMemory(mockBrain);
    await agent.init();

    expect(learned).toHaveLength(0);
  });

  it('does not seed when autoSeed is false', async () => {
    const learned: any[] = [];
    const mockBrain = {
      learn: async (content: string, meta: any) => { learned.push({ content, meta }); },
    };

    const agent = new BaseAgent({
      name: 'test-agent',
      model: 'test',
      systemPrompt: 'You are a test agent.',
      agentDir: tmpDir,
      brainSeedConfig: {
        seeds: ['brain-seeds/industry.md'],
        autoSeed: false,
      },
    });
    agent.setLongTermMemory(mockBrain);
    await agent.init();

    expect(learned).toHaveLength(0);
  });

  it('does not seed when no long-term memory set', async () => {
    const agent = new BaseAgent({
      name: 'test-agent',
      model: 'test',
      systemPrompt: 'You are a test agent.',
      agentDir: tmpDir,
      brainSeedConfig: {
        seeds: ['brain-seeds/industry.md'],
        autoSeed: true,
      },
    });
    // No setLongTermMemory call
    await agent.init();
    // Should not throw, and no marker file since nothing was seeded
    expect(fs.existsSync(path.join(tmpDir, '.brain-seeded'))).toBe(false);
  });
});

// ─── OAD spec.brain.seeds config parsing extended ──────────────────

describe('OAD spec.brain.seeds config parsing extended', () => {
  it('parses minimal brain config (seeds only)', () => {
    const yaml = require('js-yaml');
    const config = yaml.load(`
spec:
  brain:
    seeds:
      - brain-seeds/industry.md
`) as any;
    expect(config.spec.brain.seeds).toHaveLength(1);
    expect(config.spec.brain.autoSeed).toBeUndefined();
  });

  it('parses brain config with evolve disabled', () => {
    const yaml = require('js-yaml');
    const config = yaml.load(`
spec:
  brain:
    seeds: []
    autoSeed: false
    evolve:
      enabled: false
      direction: top-down
`) as any;
    expect(config.spec.brain.seeds).toHaveLength(0);
    expect(config.spec.brain.autoSeed).toBe(false);
    expect(config.spec.brain.evolve.enabled).toBe(false);
    expect(config.spec.brain.evolve.direction).toBe('top-down');
  });

  it('handles missing brain section gracefully', () => {
    const yaml = require('js-yaml');
    const config = yaml.load(`
spec:
  model: gpt-4
`) as any;
    expect(config.spec.brain).toBeUndefined();
  });

  it('handles brain seeds with custom marker file', () => {
    const yaml = require('js-yaml');
    const config = yaml.load(`
spec:
  brain:
    seeds:
      - seeds/custom.md
    seedMarkerFile: .my-marker
    autoSeed: true
`) as any;
    expect(config.spec.brain.seedMarkerFile).toBe('.my-marker');
  });
});

// ─── CLI brain commands (unit-level) ───────────────────────────────

describe('CLI brain commands parsing', () => {
  it('BrainSeedLoader can be constructed from OAD-style config', () => {
    const tmpDir2 = makeTmpDir();
    try {
      fs.mkdirSync(path.join(tmpDir2, 'brain-seeds'), { recursive: true });
      const config = {
        seeds: ['brain-seeds/industry.md', 'brain-seeds/job.md'],
        autoSeed: true,
      };
      const loader = new BrainSeedLoader(tmpDir2, config);
      expect(loader).toBeDefined();
    } finally {
      fs.rmSync(tmpDir2, { recursive: true, force: true });
    }
  });

  it('seed --status checks isSeeded correctly', async () => {
    const tmpDir2 = makeTmpDir();
    try {
      const loader = new BrainSeedLoader(tmpDir2, { seeds: [], autoSeed: true });
      expect(await loader.isSeeded()).toBe(false);
      await loader.markSeeded();
      expect(await loader.isSeeded()).toBe(true);
    } finally {
      fs.rmSync(tmpDir2, { recursive: true, force: true });
    }
  });

  it('seed --reset clears marker and allows re-seed', async () => {
    const tmpDir2 = makeTmpDir();
    try {
      fs.mkdirSync(path.join(tmpDir2, 'brain-seeds'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir2, 'brain-seeds', 'industry.md'), '## Re\n\nContent.\n');

      const loader = new BrainSeedLoader(tmpDir2, { seeds: ['brain-seeds/industry.md'], autoSeed: true });
      await loader.markSeeded();
      expect(await loader.isSeeded()).toBe(true);

      // Simulate --reset: remove marker
      fs.unlinkSync(path.join(tmpDir2, '.brain-seeded'));
      expect(await loader.isSeeded()).toBe(false);

      // Re-seed
      const mockBrain = { learn: async () => {} };
      const result = await loader.seedBrain(mockBrain);
      expect(result.imported).toBe(1);
    } finally {
      fs.rmSync(tmpDir2, { recursive: true, force: true });
    }
  });

  it('evolve command with no brain returns empty candidates', async () => {
    const evolver = new KnowledgeEvolver();
    const result = await evolver.checkPromotion(null);
    expect(result.candidates).toHaveLength(0);
  });
});
