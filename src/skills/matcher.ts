import type { SkillConfig } from '../core/types';

export interface MatchResult {
  skill: SkillConfig;
  score: number;
  reason: string;
}

export async function matchSkills(
  message: string,
  skills: SkillConfig[]
): Promise<MatchResult[]> {
  const queryWords = tokenize(message);
  const results: MatchResult[] = [];

  for (const skill of skills) {
    const { score, reason } = scoreSkill(queryWords, skill);
    if (score >= 0.1) results.push({ skill, score, reason });
  }

  return results.sort((a, b) => b.score - a.score);
}

// Index-based matching for L0 skill index (no LLM)
export function matchSkillIndex(
  query: string,
  index: { name: string; description: string; path: string }[],
  topK = 3
): { name: string; path: string; score: number }[] {
  const queryLower = query.toLowerCase();
  const queryWords = tokenize(query);

  const scored = index.map((entry) => {
    let score = 0;
    const nameLower = entry.name.toLowerCase();
    const descWords = tokenize(entry.description);

    // Exact / partial name match
    if (nameLower === queryLower) score += 1.0;
    else if (nameLower.includes(queryLower)) score += 0.8;

    // Per-word desc matches (TF-IDF-lite)
    for (const word of queryWords) {
      if (descWords.includes(word)) score += 0.5;
      else if (descWords.some((dw) => dw.includes(word) || word.includes(dw))) score += 0.2;
    }

    return { name: entry.name, path: entry.path, score };
  });

  return scored
    .filter((s) => s.score >= 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function topMatch(results: MatchResult[], threshold = 0.5): MatchResult | null {
  const sorted = [...results].sort((a, b) => b.score - a.score);
  return sorted[0]?.score >= threshold ? sorted[0] : null;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[\s,，。！？、\-_/\\]+/).filter(Boolean);
}

function scoreSkill(
  queryWords: string[],
  skill: SkillConfig
): { score: number; reason: string } {
  const nameWords = tokenize(skill.name);
  const descWords = tokenize(skill.description);
  let score = 0;
  const reasons: string[] = [];

  for (const qw of queryWords) {
    if (nameWords.includes(qw)) {
      score += 1.0;
      reasons.push(`name:${qw}`);
    } else if (descWords.includes(qw)) {
      score += 0.5;
      reasons.push(`desc:${qw}`);
    } else if (descWords.some((dw) => dw.includes(qw))) {
      score += 0.2;
    }
  }

  return { score, reason: reasons.join(',') || 'no_match' };
}
