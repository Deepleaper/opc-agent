import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { KnowledgeEntry } from '../core/types';

const EGO_TEMPLATE = `# Identity
name: Agent
creature: robot
emoji: 🤖

# Role
AI assistant

# Principles
- Be helpful
- Be honest
- Respect user privacy

# Evolution Goals
- Improve task accuracy
- Learn user preferences

# Context
`;

const DEEPBRAIN_HEADER = `# DeepBrain Knowledge Base

> Migrated from MEMORY.md. Edit sections below to manage knowledge.

## Summary

`;

export async function migrate(dir: string): Promise<void> {
  const soulPath = path.join(dir, 'SOUL.md');
  const egoPath = path.join(dir, 'EGO.md');
  const memoryPath = path.join(dir, 'MEMORY.md');
  const deepbrainPath = path.join(dir, 'DEEPBRAIN.md');
  const dbDir = path.join(dir, '.opc');
  const dbPath = path.join(dbDir, 'brain.db');

  // 1. SOUL.md → EGO.md
  if (!fs.existsSync(egoPath)) {
    if (fs.existsSync(soulPath)) {
      const soulContent = fs.readFileSync(soulPath, 'utf-8');
      const egoContent = mergeIntoEgoTemplate(soulContent);
      fs.writeFileSync(egoPath, egoContent, 'utf-8');
      fs.copyFileSync(soulPath, soulPath + '.bak');
    }
  }

  // 2. MEMORY.md → DEEPBRAIN.md
  if (!fs.existsSync(deepbrainPath)) {
    if (fs.existsSync(memoryPath)) {
      const memContent = fs.readFileSync(memoryPath, 'utf-8');
      fs.writeFileSync(deepbrainPath, DEEPBRAIN_HEADER + memContent, 'utf-8');
      fs.copyFileSync(memoryPath, memoryPath + '.bak');
    }
  }

  // 3. Create .opc/brain.db and seed from MEMORY.md
  if (!fs.existsSync(dbPath) && fs.existsSync(memoryPath)) {
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    const { BrainStore } = await import('./store');
    const store = new BrainStore({ dbPath });
    await store.init();

    const memContent = fs.readFileSync(memoryPath, 'utf-8');
    const now = new Date().toISOString();

    const paragraphs = memContent
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 10);

    for (const para of paragraphs) {
      const entry: KnowledgeEntry = {
        id: randomUUID(),
        content: para,
        source: 'seed',
        layer: 'workstation',
        tags: [],
        embedding: null,
        maturityScore: 0.5,
        useCount: 0,
        lastUsed: now,
        createdAt: now,
        updatedAt: now,
      };
      store.upsert(entry);
    }

    store.close();
  }
}

function mergeIntoEgoTemplate(soulContent: string): string {
  // Preserve the soul content and append the EGO template fields that are missing
  const hasIdentity = /^#\s*identity/im.test(soulContent);
  const hasPrinciples = /^#\s*principles/im.test(soulContent);
  const hasEvolution = /^#\s*evolution/im.test(soulContent);

  let result = soulContent.trimEnd() + '\n';

  if (!hasIdentity) {
    result += '\n# Identity\nname: Agent\ncreature: robot\nemoji: 🤖\n';
  }
  if (!hasPrinciples) {
    result += '\n# Principles\n- Be helpful\n- Be honest\n';
  }
  if (!hasEvolution) {
    result += '\n# Evolution Goals\n- Improve task accuracy\n';
  }

  return result;
}
