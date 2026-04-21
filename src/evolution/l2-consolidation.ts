// L2 evolution — AutoDream: merge/trim/reorganize memory entries
import { randomUUID } from 'crypto';
import type { AutoDreamAction, DeepBrainProvider, EvolutionConfig } from '../core/types';
import type { ModelRouter } from '../providers/router';

export async function autoDream(
  brain: DeepBrainProvider,
  router: ModelRouter,
  config: EvolutionConfig
): Promise<AutoDreamAction[]> {
  if (!config.l2.enabled) return [];

  const recalled = await brain.recall({
    query: 'knowledge experience lesson error pattern',
    topK: 50,
  });
  const allKnowledge = recalled.entries;
  if (allKnowledge.length === 0) return [];

  const provider = router.getProvider('l2');
  const consolidatePrompt = `你是记忆管理器。分析以下知识条目，决定哪些该合并（语义重复）、裁剪（过时）、重组（拆分/合并）。
输出 JSON: {"merge":[{"ids":["id1","id2"],"reason":"..."}],"trim":[{"id":"id1","reason":"..."}],"reorganize":[{"id":"id1","newContent":"...","reason":"..."}]}`;

  const response = await provider.chat({
    systemPrompt: consolidatePrompt,
    messages: [{
      id: randomUUID(),
      role: 'user',
      content: JSON.stringify(
        allKnowledge.slice(0, 50).map(e => ({
          id: e.id,
          content: e.content.slice(0, 300),
          layer: e.layer,
          maturityScore: e.maturityScore,
          useCount: e.useCount,
        }))
      ),
      timestamp: Date.now(),
    }],
  });

  const text = response.message.content;
  const parsed = safeParseJSON(text) as {
    merge?: Array<{ ids: string[]; reason: string }>;
    trim?: Array<{ id: string; reason: string }>;
    reorganize?: Array<{ id: string; newContent: string; reason: string }>;
  };

  const actions: AutoDreamAction[] = [];
  const now = new Date().toISOString();

  for (const m of (parsed.merge ?? [])) {
    if (!Array.isArray(m.ids) || m.ids.length < 2) continue;
    const sources = allKnowledge.filter(e => m.ids.includes(e.id));
    if (sources.length === 0) continue;
    await brain.store({
      content: sources.map(e => e.content).join('\n---\n'),
      source: 'l2',
      layer: sources[0].layer,
      tags: [...Array.from(new Set(sources.flatMap(e => e.tags))), 'merged'],
      embedding: null,
      maturityScore: Math.max(...sources.map(e => e.maturityScore)),
      useCount: sources.reduce((s, e) => s + e.useCount, 0),
      lastUsed: now,
    });
    actions.push({ type: 'merge', ids: m.ids });
  }

  for (const t of (parsed.trim ?? [])) {
    if (!t.id) continue;
    const entry = allKnowledge.find(e => e.id === t.id);
    if (!entry) continue;
    await brain.store({
      content: entry.content,
      source: entry.source,
      layer: entry.layer,
      tags: [...entry.tags, '_trimmed'],
      embedding: null,
      maturityScore: 0,
      useCount: entry.useCount,
      lastUsed: entry.lastUsed,
    });
    actions.push({ type: 'trim', ids: [t.id] });
  }

  for (const r of (parsed.reorganize ?? [])) {
    if (!r.id || !r.newContent) continue;
    const entry = allKnowledge.find(e => e.id === r.id);
    if (!entry) continue;
    await brain.store({
      content: r.newContent,
      source: 'l2',
      layer: entry.layer,
      tags: [...entry.tags.filter(t => t !== '_trimmed'), 'reorganized'],
      embedding: null,
      maturityScore: entry.maturityScore,
      useCount: entry.useCount,
      lastUsed: entry.lastUsed,
    });
    actions.push({ type: 'reorganize', ids: [r.id], newContent: r.newContent });
  }

  await brain.evolve('l2', config);

  return actions;
}

function safeParseJSON(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return {};
  }
}
