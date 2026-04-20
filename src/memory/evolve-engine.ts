/**
 * KnowledgeEvolveEngine — Two-layer knowledge distillation
 *
 * Layer 1: Agent private refinement (local Ollama, zero cost)
 *   Conversations → extract insights → distill → write back to agent memory
 *   Key: memory never grows, only gets more refined
 *
 * Layer 2: Workstation shared refinement (AgentKits cloud model, paid)
 *   Multiple agents' refined knowledge → cross-agent fusion → shared workstation layer
 *   Key: one agent learns, all agents benefit
 *
 * Core principle:
 *   - Layer 1 ALWAYS uses local Ollama (zero cost)
 *   - Layer 2 uses AgentKits/cloud model (paid, higher quality)
 *   - Agent memory = distilled experience, NOT raw conversation history
 */

import * as fs from 'fs';
import * as path from 'path';

export interface EvolveConfig {
  enabled: boolean;
  /** Ollama model for evolve (default: auto-detect best local model) */
  localModel?: string;
  /** Ollama base URL (default: http://localhost:11434/v1) */
  ollamaUrl?: string;
  /** Evolve after N conversations (default: 10) */
  conversationThreshold?: number;
  /** Periodic evolve interval in ms (default: 6h) */
  intervalMs?: number;
  /** Max knowledge pages per tier (default: 100) */
  maxPagesPerTier?: number;
}

export interface KnowledgePage {
  slug: string;
  content: string;
  tier: 'workstation' | 'job' | 'industry';
  source: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  tags: string[];
}

export interface EvolveResult {
  extracted: number;
  deduplicated: number;
  promoted: number;
  compacted: boolean;
  errors: string[];
}

// Prompts for local LLM — kept short for small models
const EXTRACT_PROMPT = `Extract key knowledge from this conversation. Output JSON array of insights.
Each insight: { "title": "short title", "content": "key information", "tags": ["tag1"], "confidence": 0.0-1.0 }
Only extract reusable knowledge (facts, procedures, preferences), not casual chat.
If nothing worth saving, return [].

Conversation:
`;

const DEDUP_PROMPT = `Compare these two knowledge entries. Are they about the same topic?
If yes, merge them into one better entry. If no, return null.
Respond JSON only: { "isDuplicate": boolean, "merged": { "title": string, "content": string, "confidence": number } | null }

Entry A:
{A}

Entry B:
{B}
`;

const DISTILL_PROMPT = `Distill these workstation-level knowledge entries into a higher-level summary suitable for the {TARGET_TIER} tier.
Remove agent-specific details, keep universal patterns.
Output JSON: { "title": string, "content": string, "tags": [string], "confidence": number }

Entries:
{ENTRIES}
`;

/** Layer 1: Compact agent memory — distill raw conversations into refined experience */
const MEMORY_COMPACT_PROMPT = `You are a memory compactor. Given these conversation memories, distill them into a concise, refined summary.

Rules:
- Keep ONLY reusable knowledge: user preferences, facts, procedures, decisions
- Remove: greetings, small talk, debugging attempts, repeated questions
- Merge similar topics into single entries
- Output a markdown document with ## sections, each a distinct knowledge item
- Be concise: aim for 30% of original length
- Preserve exact names, numbers, dates, technical details
- Write in the same language as the input

Current memory:
{MEMORY}

Output ONLY the refined markdown, no explanation.`;

export class KnowledgeEvolveEngine {
  private config: EvolveConfig;
  private ollamaUrl: string;
  private model: string;
  private knowledgeDir: string;
  private conversationCount: number = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(agentDir: string, config: Partial<EvolveConfig> = {}) {
    this.config = {
      enabled: config.enabled !== false,
      localModel: config.localModel,
      ollamaUrl: config.ollamaUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      conversationThreshold: config.conversationThreshold ?? 10,
      intervalMs: config.intervalMs ?? 6 * 60 * 60 * 1000, // 6h
      maxPagesPerTier: config.maxPagesPerTier ?? 100,
    };
    this.ollamaUrl = this.config.ollamaUrl!;
    this.model = this.config.localModel || '';
    this.knowledgeDir = path.join(agentDir, '.opc', 'knowledge');
    fs.mkdirSync(this.knowledgeDir, { recursive: true });
  }

  /** Auto-detect best local Ollama model for evolve tasks */
  async detectLocalModel(): Promise<string> {
    if (this.model) return this.model;
    try {
      const tagsUrl = this.ollamaUrl.replace('/v1', '/api/tags');
      const res = await fetch(tagsUrl);
      if (!res.ok) return 'qwen2.5:0.5b';
      const data = await res.json() as any;
      const models = (data.models || []).map((m: any) => m.name) as string[];
      // Prefer larger models for better distillation
      const preferred = ['qwen2.5:32b', 'qwen2.5:14b', 'qwen2.5:7b', 'llama3.1:8b', 'qwen2.5:3b', 'qwen2.5:1.5b', 'qwen2.5:0.5b'];
      for (const p of preferred) {
        if (models.includes(p)) { this.model = p; return p; }
      }
      if (models.length > 0) { this.model = models[0]; return models[0]; }
    } catch { /* Ollama not running */ }
    this.model = 'qwen2.5:0.5b';
    return this.model;
  }

  /** Call local Ollama model */
  private async callLocal(prompt: string, system?: string): Promise<string> {
    const model = await this.detectLocalModel();
    const messages: any[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    try {
      const res = await fetch(`${this.ollamaUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 1000 }),
      });
      if (!res.ok) return '';
      const data = await res.json() as any;
      return data.choices?.[0]?.message?.content || '';
    } catch {
      return '';
    }
  }

  /** Extract knowledge from conversation messages */
  async extractFromConversation(messages: Array<{ role: string; content: string }>): Promise<KnowledgePage[]> {
    if (messages.length < 2) return [];

    const conversationText = messages
      .slice(-20) // Last 20 messages max
      .map(m => `${m.role}: ${m.content.substring(0, 200)}`)
      .join('\n');

    const response = await this.callLocal(
      EXTRACT_PROMPT + conversationText,
      'You are a knowledge extraction engine. Output valid JSON arrays only.'
    );

    const pages: KnowledgePage[] = [];
    try {
      const match = response.match(/\[[\s\S]*\]/);
      if (!match) return [];
      const insights = JSON.parse(match[0]);
      if (!Array.isArray(insights)) return [];

      for (const insight of insights) {
        if (!insight.title || !insight.content) continue;
        if ((insight.confidence || 0) < 0.3) continue;

        const slug = this.slugify(insight.title);
        pages.push({
          slug,
          content: `## ${insight.title}\n\n${insight.content}`,
          tier: 'workstation',
          source: 'conversation',
          confidence: insight.confidence || 0.5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usageCount: 1,
          tags: insight.tags || [],
        });
      }
    } catch { /* Parse error, skip */ }

    // Save extracted pages
    for (const page of pages) {
      this.savePage(page);
    }

    return pages;
  }

  /** Deduplicate knowledge pages within a tier */
  async deduplicateInTier(tier: 'workstation' | 'job' | 'industry'): Promise<number> {
    const pages = this.loadPages(tier);
    if (pages.length < 2) return 0;

    let deduped = 0;
    const toRemove = new Set<string>();

    for (let i = 0; i < pages.length; i++) {
      if (toRemove.has(pages[i].slug)) continue;
      for (let j = i + 1; j < pages.length; j++) {
        if (toRemove.has(pages[j].slug)) continue;

        const prompt = DEDUP_PROMPT
          .replace('{A}', pages[i].content.substring(0, 300))
          .replace('{B}', pages[j].content.substring(0, 300));

        const response = await this.callLocal(prompt, 'Respond in JSON only.');
        try {
          const match = response.match(/\{[\s\S]*\}/);
          if (!match) continue;
          const result = JSON.parse(match[0]);
          if (result.isDuplicate && result.merged) {
            // Update A with merged content, mark B for removal
            pages[i].content = `## ${result.merged.title}\n\n${result.merged.content}`;
            pages[i].confidence = Math.max(pages[i].confidence, result.merged.confidence || pages[i].confidence);
            pages[i].usageCount += pages[j].usageCount;
            pages[i].updatedAt = new Date().toISOString();
            toRemove.add(pages[j].slug);
            deduped++;
          }
        } catch { continue; }
      }
    }

    // Save results
    for (const page of pages) {
      if (!toRemove.has(page.slug)) {
        this.savePage(page);
      } else {
        this.deletePage(page.slug, tier);
      }
    }

    return deduped;
  }

  /** Promote knowledge upward: workstation → job → industry */
  async promoteKnowledge(): Promise<number> {
    let promoted = 0;

    // Workstation → Job: pages with high confidence + usage
    const wsPages = this.loadPages('workstation')
      .filter(p => p.confidence >= 0.7 && p.usageCount >= 3);

    if (wsPages.length >= 3) {
      const entries = wsPages.slice(0, 10).map(p => p.content.substring(0, 200)).join('\n---\n');
      const prompt = DISTILL_PROMPT
        .replace('{TARGET_TIER}', 'job (岗位)')
        .replace('{ENTRIES}', entries);

      const response = await this.callLocal(prompt, 'Output JSON only.');
      try {
        const match = response.match(/\{[\s\S]*\}/);
        if (match) {
          const result = JSON.parse(match[0]);
          if (result.title && result.content) {
            const page: KnowledgePage = {
              slug: `promoted-${this.slugify(result.title)}`,
              content: `## ${result.title}\n\n${result.content}`,
              tier: 'job',
              source: 'evolve-promotion',
              confidence: result.confidence || 0.8,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              usageCount: 0,
              tags: result.tags || ['promoted'],
            };
            this.savePage(page);
            promoted++;
          }
        }
      } catch { /* skip */ }
    }

    // Job → Industry: high confidence job pages
    const jobPages = this.loadPages('job')
      .filter(p => p.confidence >= 0.85 && p.usageCount >= 5);

    if (jobPages.length >= 3) {
      const entries = jobPages.slice(0, 10).map(p => p.content.substring(0, 200)).join('\n---\n');
      const prompt = DISTILL_PROMPT
        .replace('{TARGET_TIER}', 'industry (行业)')
        .replace('{ENTRIES}', entries);

      const response = await this.callLocal(prompt, 'Output JSON only.');
      try {
        const match = response.match(/\{[\s\S]*\}/);
        if (match) {
          const result = JSON.parse(match[0]);
          if (result.title && result.content) {
            const page: KnowledgePage = {
              slug: `industry-${this.slugify(result.title)}`,
              content: `## ${result.title}\n\n${result.content}`,
              tier: 'industry',
              source: 'evolve-promotion',
              confidence: result.confidence || 0.9,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              usageCount: 0,
              tags: result.tags || ['promoted'],
            };
            this.savePage(page);
            promoted++;
          }
        }
      } catch { /* skip */ }
    }

    return promoted;
  }

  /** Full evolve cycle: extract → dedup → compact memory → promote */
  async evolve(recentMessages?: Array<{ role: string; content: string }>): Promise<EvolveResult> {
    const result: EvolveResult = { extracted: 0, deduplicated: 0, promoted: 0, compacted: false, errors: [] };

    if (!this.config.enabled) return result;

    try {
      // Step 1: Extract from recent conversation
      if (recentMessages && recentMessages.length > 0) {
        const pages = await this.extractFromConversation(recentMessages);
        result.extracted = pages.length;
      }

      // Step 2: Deduplicate within each tier
      result.deduplicated += await this.deduplicateInTier('workstation');
      result.deduplicated += await this.deduplicateInTier('job');

      // Step 3: Compact agent memory (Layer 1 — write refined experience back)
      result.compacted = await this.compactAgentMemory();

      // Step 4: Promote upward
      result.promoted = await this.promoteKnowledge();
    } catch (err: any) {
      result.errors.push(err.message || String(err));
    }

    // Save evolve log
    this.saveEvolveLog(result);
    return result;
  }

  /**
   * Layer 1: Compact agent memory
   * Read MEMORY.md → distill with local model → write back refined version
   * Result: memory never grows, only gets more concentrated
   */
  async compactAgentMemory(): Promise<boolean> {
    const memoryPath = path.join(path.dirname(this.knowledgeDir), 'MEMORY.md');
    // Also check .opc/MEMORY.md
    const altMemoryPath = path.join(this.knowledgeDir, '..', 'MEMORY.md');

    let targetPath = '';
    let content = '';

    for (const p of [memoryPath, altMemoryPath]) {
      if (fs.existsSync(p)) {
        content = fs.readFileSync(p, 'utf-8');
        targetPath = p;
        break;
      }
    }

    // Also compact conversation memory from SQLite if available
    const memoryJsonPath = path.join(path.dirname(this.knowledgeDir), 'memory.json');
    let conversationMemory = '';
    if (fs.existsSync(memoryJsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(memoryJsonPath, 'utf-8'));
        // Extract conversation entries for compaction
        const convEntries = Object.entries(data)
          .filter(([k]) => k.startsWith('conversation:'))
          .map(([, v]: [string, any]) => {
            if (Array.isArray(v)) {
              return v.map((m: any) => `${m.role}: ${m.content?.substring(0, 100)}`).join('\n');
            }
            return String(v).substring(0, 200);
          });
        if (convEntries.length > 0) {
          conversationMemory = convEntries.join('\n---\n');
        }
      } catch { /* ok */ }
    }

    // Need at least some content to compact
    const fullContent = [content, conversationMemory].filter(Boolean).join('\n\n---\n\n');
    if (fullContent.length < 500) return false; // Too short to compact

    // Only compact if content is getting large (>2KB)
    if (fullContent.length < 2000) return false;

    const prompt = MEMORY_COMPACT_PROMPT.replace('{MEMORY}', fullContent.substring(0, 4000));
    const refined = await this.callLocal(prompt);
    if (!refined || refined.length < 100) return false;

    // Safety: don't overwrite if refined is much larger (LLM hallucinated)
    if (refined.length > fullContent.length * 0.8) return false;

    // Write back refined memory
    if (targetPath) {
      // Backup original
      const backupPath = targetPath + '.bak';
      fs.copyFileSync(targetPath, backupPath);
      // Write refined
      const header = `<!-- Auto-refined by OPC Evolve Engine at ${new Date().toISOString()} -->\n<!-- Original backed up to ${path.basename(backupPath)} -->\n\n`;
      fs.writeFileSync(targetPath, header + refined);
    }

    // Save compaction stats
    const statsPath = path.join(this.knowledgeDir, 'compaction-log.json');
    let logs: any[] = [];
    try { logs = JSON.parse(fs.readFileSync(statsPath, 'utf-8')); } catch { /* ok */ }
    logs.push({
      timestamp: new Date().toISOString(),
      originalSize: fullContent.length,
      refinedSize: refined.length,
      ratio: (refined.length / fullContent.length * 100).toFixed(1) + '%',
    });
    if (logs.length > 50) logs = logs.slice(-50);
    fs.writeFileSync(statsPath, JSON.stringify(logs, null, 2));

    return true;
  }

  /** Called after each conversation turn */
  onConversationTurn(messages: Array<{ role: string; content: string }>): void {
    this.conversationCount++;
    if (this.conversationCount >= (this.config.conversationThreshold || 10)) {
      this.conversationCount = 0;
      // Background evolve — don't await, fire and forget
      this.evolve(messages).catch(() => {});
    }
  }

  /** Start periodic evolve timer */
  startPeriodicEvolve(): void {
    if (this.timer) return;
    const interval = this.config.intervalMs || 6 * 60 * 60 * 1000;
    this.timer = setInterval(() => {
      this.evolve().catch(() => {});
    }, interval);
  }

  /** Stop periodic evolve */
  stopPeriodicEvolve(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Get stats for all tiers */
  getStats(): { workstation: number; job: number; industry: number; lastEvolve?: string } {
    return {
      workstation: this.loadPages('workstation').length,
      job: this.loadPages('job').length,
      industry: this.loadPages('industry').length,
      lastEvolve: this.getLastEvolveTime(),
    };
  }

  // ─── File I/O ────────────────────────────────────────────

  private savePage(page: KnowledgePage): void {
    const tierDir = path.join(this.knowledgeDir, page.tier);
    fs.mkdirSync(tierDir, { recursive: true });
    const filePath = path.join(tierDir, `${page.slug}.json`);
    fs.writeFileSync(filePath, JSON.stringify(page, null, 2));
  }

  private loadPages(tier: string): KnowledgePage[] {
    const tierDir = path.join(this.knowledgeDir, tier);
    if (!fs.existsSync(tierDir)) return [];
    return fs.readdirSync(tierDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(tierDir, f), 'utf-8')); }
        catch { return null; }
      })
      .filter((p): p is KnowledgePage => p !== null);
  }

  private deletePage(slug: string, tier: string): void {
    const filePath = path.join(this.knowledgeDir, tier, `${slug}.json`);
    try { fs.unlinkSync(filePath); } catch { /* ok */ }
  }

  private saveEvolveLog(result: EvolveResult): void {
    const logPath = path.join(this.knowledgeDir, 'evolve-log.json');
    let logs: any[] = [];
    try { logs = JSON.parse(fs.readFileSync(logPath, 'utf-8')); } catch { /* ok */ }
    logs.push({ ...result, timestamp: new Date().toISOString() });
    // Keep last 100 entries
    if (logs.length > 100) logs = logs.slice(-100);
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  }

  private getLastEvolveTime(): string | undefined {
    const logPath = path.join(this.knowledgeDir, 'evolve-log.json');
    try {
      const logs = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
      return logs[logs.length - 1]?.timestamp;
    } catch { return undefined; }
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);
  }
}

/**
 * AutoEvolveScheduler — integrates with runtime
 */
export class AutoEvolveScheduler {
  private engine: KnowledgeEvolveEngine;

  constructor(agentDir: string, config?: Partial<EvolveConfig>) {
    this.engine = new KnowledgeEvolveEngine(agentDir, config);
  }

  async start(): Promise<void> {
    await this.engine.detectLocalModel();
    this.engine.startPeriodicEvolve();
  }

  stop(): void {
    this.engine.stopPeriodicEvolve();
  }

  getEngine(): KnowledgeEvolveEngine {
    return this.engine;
  }
}
