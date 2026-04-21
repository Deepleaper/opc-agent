// L3 skill verifier — quality validation and lifecycle management for auto-discovered skills
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import type { DeepBrainProvider } from '../core/types';
import type { ModelRouter } from '../providers/router';

export interface VerificationResult {
  skillId: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
  elapsedMs: number;
}

export async function verifySkill(
  skillPath: string,
  testCases: string[],
  router: ModelRouter
): Promise<boolean> {
  let content: string;
  try {
    content = await fs.readFile(skillPath, 'utf-8');
  } catch {
    return false;
  }

  if (!content.trim()) return false;

  // Structural checks: must have title and description at minimum
  const hasTitle = /^#\s+\S+/m.test(content);
  const hasDescription = /##\s+(description|描述)/im.test(content);
  if (!hasTitle || !hasDescription) return false;

  if (testCases.length === 0) {
    return /##\s+(step|steps|步骤)/im.test(content);
  }

  const provider = router.getProvider('l3');
  const verifyPrompt = `你是 Skill 质量验证员。根据以下 skill 定义和测试用例，判断 skill 是否能正确处理这些用例。
只输出 JSON: {"passed": true/false, "reasons": ["..."]}`;

  const response = await provider.chat({
    systemPrompt: verifyPrompt,
    messages: [{
      id: randomUUID(),
      role: 'user',
      content: `Skill:\n${content.slice(0, 1000)}\n\nTest cases:\n${testCases.slice(0, 5).join('\n')}`,
      timestamp: Date.now(),
    }],
  });

  const match = response.message.content.match(/\{[\s\S]*\}/);
  if (!match) return /##\s+(step|steps|步骤)/im.test(content);

  try {
    const parsed = JSON.parse(match[0]) as { passed?: boolean };
    return parsed.passed === true;
  } catch {
    return false;
  }
}

export async function retireStaleSkills(
  brain: DeepBrainProvider,
  maxIdleDays = 30
): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxIdleDays);
  const cutoffStr = cutoff.toISOString();

  const recalled = await brain.recall({
    query: 'skill candidate active skill record',
    topK: 200,
  });

  const retired: string[] = [];

  for (const entry of recalled.entries) {
    let data: { type?: string; name?: string; status?: string; filePath?: string };
    try {
      data = JSON.parse(entry.content) as typeof data;
    } catch {
      continue;
    }
    if (data.type !== 'skill_record') continue;
    if (data.status === 'retired') continue;

    const neverUsed = !entry.lastUsed;
    const idleTooLong = entry.lastUsed ? entry.lastUsed < cutoffStr : true;
    if (!(neverUsed || (idleTooLong && entry.useCount < 2))) continue;

    await brain.store({
      content: JSON.stringify({ ...data, status: 'retired' }),
      source: 'l3',
      layer: 'workstation',
      tags: ['skill', 'retired', String(data.name ?? '')],
      embedding: null,
      maturityScore: 0,
      useCount: entry.useCount,
      lastUsed: entry.lastUsed,
    });

    if (data.filePath) retired.push(data.filePath);
  }

  return retired;
}
