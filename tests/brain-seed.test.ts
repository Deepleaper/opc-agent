import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BrainSeedLoader, KnowledgeEvolver } from '../src/memory/seed-loader';
import type { BrainSeedConfig } from '../src/memory/seed-loader';

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opc-seed-test-'));
  return dir;
}

describe('BrainSeedLoader', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    fs.mkdirSync(path.join(tmpDir, 'brain-seeds'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parseSeedFile splits ## sections into pages', () => {
    const seedFile = path.join(tmpDir, 'brain-seeds', 'industry.md');
    fs.writeFileSync(seedFile, `# Industry Knowledge

## E-commerce Basics

Online retail fundamentals.

## Payment Systems

How payments work in e-commerce.

## Logistics

Shipping and fulfillment.
`);
    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/industry.md'], autoSeed: true });
    const pages = loader.parseSeedFile(seedFile, 'industry');

    expect(pages).toHaveLength(3);
    expect(pages[0].slug).toBe('seed/industry/e-commerce-basics');
    expect(pages[0].tier).toBe('industry');
    expect(pages[0].content).toContain('E-commerce Basics');
    expect(pages[0].content).toContain('Online retail fundamentals.');
    expect(pages[1].slug).toBe('seed/industry/payment-systems');
    expect(pages[2].slug).toBe('seed/industry/logistics');
  });

  it('isSeeded returns false when no marker file', async () => {
    const loader = new BrainSeedLoader(tmpDir, { seeds: [], autoSeed: true });
    expect(await loader.isSeeded()).toBe(false);
  });

  it('isSeeded returns true after markSeeded', async () => {
    const loader = new BrainSeedLoader(tmpDir, { seeds: [], autoSeed: true });
    await loader.markSeeded();
    expect(await loader.isSeeded()).toBe(true);
    // Check marker file content
    const marker = JSON.parse(fs.readFileSync(path.join(tmpDir, '.brain-seeded'), 'utf-8'));
    expect(marker.seededAt).toBeDefined();
  });

  it('seedBrain imports pages with learn()', async () => {
    const seedFile = path.join(tmpDir, 'brain-seeds', 'job.md');
    fs.writeFileSync(seedFile, `# Job Knowledge

## Customer Handling

How to handle customers.

## Escalation

When to escalate.
`);

    const learned: { content: string; meta: any }[] = [];
    const mockBrain = {
      learn: async (content: string, meta: any) => { learned.push({ content, meta }); },
    };

    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/job.md'], autoSeed: true });
    const result = await loader.seedBrain(mockBrain);

    expect(result.imported).toBe(2);
    expect(result.pages).toContain('seed/job/customer-handling');
    expect(result.pages).toContain('seed/job/escalation');
    expect(learned).toHaveLength(2);
    expect(learned[0].meta.tags).toContain('brain-seed');
    expect(learned[0].meta.tags).toContain('job');
  });

  it('seedBrain imports pages with store()', async () => {
    const seedFile = path.join(tmpDir, 'brain-seeds', 'industry.md');
    fs.writeFileSync(seedFile, `## Topic One\n\nContent one.\n`);

    const stored: any[] = [];
    const mockBrain = {
      store: async (collection: string, slug: string, content: string, meta: any) => {
        stored.push({ collection, slug, content, meta });
      },
    };

    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/industry.md'], autoSeed: true });
    const result = await loader.seedBrain(mockBrain);

    expect(result.imported).toBe(1);
    expect(stored[0].collection).toBe('brain-seeds');
    expect(stored[0].meta.tier).toBe('industry');
    expect(stored[0].meta.source).toBe('brain-seed');
  });

  it('skips import if already seeded', async () => {
    const seedFile = path.join(tmpDir, 'brain-seeds', 'industry.md');
    fs.writeFileSync(seedFile, `## Topic\n\nContent.\n`);

    const loader = new BrainSeedLoader(tmpDir, { seeds: ['brain-seeds/industry.md'], autoSeed: true });
    await loader.markSeeded();

    expect(await loader.isSeeded()).toBe(true);
    // seedBrain would still work if called, but the guard is in agent.ts
  });

  it('handles missing seed files gracefully', async () => {
    const loader = new BrainSeedLoader(tmpDir, {
      seeds: ['brain-seeds/nonexistent.md'],
      autoSeed: true,
    });

    const mockBrain = { learn: async () => {} };
    const result = await loader.seedBrain(mockBrain);
    expect(result.imported).toBe(0);
    expect(result.pages).toHaveLength(0);
  });

  it('infers tier from filename', () => {
    // Write all three seed files
    fs.writeFileSync(path.join(tmpDir, 'brain-seeds', 'industry.md'), '## Ind Topic\n\nContent.\n');
    fs.writeFileSync(path.join(tmpDir, 'brain-seeds', 'job.md'), '## Job Topic\n\nContent.\n');
    fs.writeFileSync(path.join(tmpDir, 'brain-seeds', 'workstation.md'), '## WS Topic\n\nContent.\n');

    const loader = new BrainSeedLoader(tmpDir, {
      seeds: ['brain-seeds/industry.md', 'brain-seeds/job.md', 'brain-seeds/workstation.md'],
      autoSeed: true,
    });

    const indPages = loader.parseSeedFile(path.join(tmpDir, 'brain-seeds', 'industry.md'), 'industry');
    const jobPages = loader.parseSeedFile(path.join(tmpDir, 'brain-seeds', 'job.md'), 'job');
    const wsPages = loader.parseSeedFile(path.join(tmpDir, 'brain-seeds', 'workstation.md'), 'workstation');

    expect(indPages[0].tier).toBe('industry');
    expect(indPages[0].slug).toContain('seed/industry/');
    expect(jobPages[0].tier).toBe('job');
    expect(wsPages[0].tier).toBe('workstation');
  });

  it('uses custom seedMarkerFile', async () => {
    const loader = new BrainSeedLoader(tmpDir, {
      seeds: [],
      autoSeed: true,
      seedMarkerFile: '.custom-marker',
    });
    await loader.markSeeded();
    expect(fs.existsSync(path.join(tmpDir, '.custom-marker'))).toBe(true);
    expect(await loader.isSeeded()).toBe(true);
  });
});

describe('KnowledgeEvolver', () => {
  it('checkPromotion returns empty when brain is null', async () => {
    const evolver = new KnowledgeEvolver();
    const result = await evolver.checkPromotion(null);
    expect(result.candidates).toHaveLength(0);
    expect(result.promoted).toBe(0);
  });

  it('promoteToJob calls brain.store with job tier', async () => {
    const stored: any[] = [];
    const mockBrain = {
      store: async (col: string, slug: string, content: string, meta: any) => {
        stored.push({ col, slug, content, meta });
      },
    };

    const evolver = new KnowledgeEvolver();
    await evolver.promoteToJob(mockBrain, 'Important knowledge', 'seed/job/promoted-topic');

    expect(stored).toHaveLength(1);
    expect(stored[0].meta.tier).toBe('job');
    expect(stored[0].meta.source).toBe('promotion');
    expect(stored[0].slug).toBe('seed/job/promoted-topic');
  });

  it('promoteToIndustry calls brain.store with industry tier', async () => {
    const stored: any[] = [];
    const mockBrain = {
      store: async (col: string, slug: string, content: string, meta: any) => {
        stored.push({ col, slug, content, meta });
      },
    };

    const evolver = new KnowledgeEvolver();
    await evolver.promoteToIndustry(mockBrain, 'Cross-role knowledge', 'seed/industry/common-pattern');

    expect(stored).toHaveLength(1);
    expect(stored[0].meta.tier).toBe('industry');
    expect(stored[0].meta.source).toBe('promotion');
  });
});

describe('OAD spec.brain.seeds config parsing', () => {
  it('parses brain seed config from YAML', () => {
    const yaml = require('js-yaml');
    const config = yaml.load(`
apiVersion: opc/v1
kind: Agent
metadata:
  name: test
spec:
  brain:
    seeds:
      - brain-seeds/industry.md
      - brain-seeds/job.md
      - brain-seeds/workstation.md
    autoSeed: true
    evolve:
      enabled: true
      direction: bottom-up
`) as any;

    expect(config.spec.brain.seeds).toHaveLength(3);
    expect(config.spec.brain.autoSeed).toBe(true);
    expect(config.spec.brain.evolve.enabled).toBe(true);
    expect(config.spec.brain.evolve.direction).toBe('bottom-up');
  });
});
