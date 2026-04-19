/**
 * Brain-seed downloader and auto-learner.
 * Downloads brain-seed files from Hub and optionally imports into DeepBrain.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { HubBrainSeed } from './client';

export interface BrainSeedResult {
  savedFiles: string[];
  learnedCount: number;
}

/**
 * Save brain-seed files to disk and optionally auto-learn into DeepBrain.
 */
export async function downloadAndLearnBrainSeeds(
  projectDir: string,
  seeds: HubBrainSeed[],
): Promise<BrainSeedResult> {
  if (!seeds || seeds.length === 0) {
    return { savedFiles: [], learnedCount: 0 };
  }

  const seedDir = path.join(projectDir, 'brain-seed');
  fs.mkdirSync(seedDir, { recursive: true });

  const savedFiles: string[] = [];
  for (const seed of seeds) {
    const filePath = path.join(seedDir, seed.filename);
    fs.writeFileSync(filePath, seed.content, 'utf-8');
    savedFiles.push(seed.filename);
  }

  // Try auto-learn into DeepBrain (optional dependency)
  let learnedCount = 0;
  try {
    const { Brain } = require('deepbrain');
    const brain = new Brain({ database: path.join(projectDir, 'data', 'brain.db') });
    for (const seed of seeds) {
      await brain.learn(seed.content, {
        slug: `brain-seed/${seed.filename.replace(/\.md$/, '')}`,
        title: `Brain Seed: ${seed.tier}`,
        namespace: `seed/${seed.tier}`,
      });
      learnedCount++;
    }
  } catch {
    // deepbrain not installed — that's fine, files are saved
  }

  return { savedFiles, learnedCount };
}
