/**
 * Analytics Engine - Persistent analytics with JSON file storage.
 * Tracks every message, LLM call, tool use, and error with timestamps.
 */
import * as fs from 'fs';
import * as path from 'path';

export interface AnalyticsEvent {
  type: 'message' | 'llm_call' | 'tool_use' | 'error';
  timestamp: number;
  data: Record<string, any>;
}

export interface AnalyticsStats {
  totalMessages: number;
  totalLLMCalls: number;
  totalToolUses: number;
  totalErrors: number;
  avgResponseTimeMs: number;
  totalTokens: { input: number; output: number; total: number };
  topSkills: { name: string; count: number }[];
  topErrors: { message: string; count: number }[];
  messagesPerDay: Record<string, number>;
  period: { from: number; to: number };
}

export class AnalyticsEngine {
  private dataDir: string;
  private eventsFile: string;
  private events: AnalyticsEvent[] = [];

  constructor(dataDir: string = '.') {
    this.dataDir = path.resolve(dataDir, 'data');
    this.eventsFile = path.join(this.dataDir, 'analytics.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.eventsFile)) {
        const raw = fs.readFileSync(this.eventsFile, 'utf-8');
        this.events = JSON.parse(raw);
      }
    } catch {
      this.events = [];
    }
  }

  private save(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    // Keep last 10000 events to prevent unbounded growth
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }
    fs.writeFileSync(this.eventsFile, JSON.stringify(this.events, null, 2));
  }

  track(type: AnalyticsEvent['type'], data: Record<string, any>): void {
    this.events.push({ type, timestamp: Date.now(), data });
    this.save();
  }

  trackMessage(userId: string, responseTimeMs: number, tokensIn: number, tokensOut: number): void {
    this.track('message', { userId, responseTimeMs, tokensIn, tokensOut });
  }

  trackLLMCall(provider: string, model: string, tokensIn: number, tokensOut: number, latencyMs: number): void {
    this.track('llm_call', { provider, model, tokensIn, tokensOut, latencyMs });
  }

  trackToolUse(toolName: string, success: boolean, latencyMs: number): void {
    this.track('tool_use', { toolName, success, latencyMs });
  }

  trackError(error: string, context?: string): void {
    this.track('error', { error, context });
  }

  getStats(fromTs?: number, toTs?: number): AnalyticsStats {
    const now = Date.now();
    const from = fromTs ?? 0;
    const to = toTs ?? now;
    const filtered = this.events.filter(e => e.timestamp >= from && e.timestamp <= to);

    const messages = filtered.filter(e => e.type === 'message');
    const llmCalls = filtered.filter(e => e.type === 'llm_call');
    const toolUses = filtered.filter(e => e.type === 'tool_use');
    const errors = filtered.filter(e => e.type === 'error');

    // Avg response time
    const totalResponseTime = messages.reduce((sum, e) => sum + (e.data.responseTimeMs ?? 0), 0);
    const avgResponseTimeMs = messages.length > 0 ? Math.round(totalResponseTime / messages.length) : 0;

    // Total tokens
    const totalTokensIn = llmCalls.reduce((sum, e) => sum + (e.data.tokensIn ?? 0), 0);
    const totalTokensOut = llmCalls.reduce((sum, e) => sum + (e.data.tokensOut ?? 0), 0);

    // Top skills (from tool_use)
    const skillCounts: Record<string, number> = {};
    for (const e of toolUses) {
      const name = e.data.toolName ?? 'unknown';
      skillCounts[name] = (skillCounts[name] ?? 0) + 1;
    }
    const topSkills = Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Top errors
    const errorCounts: Record<string, number> = {};
    for (const e of errors) {
      const msg = e.data.error ?? 'unknown';
      errorCounts[msg] = (errorCounts[msg] ?? 0) + 1;
    }
    const topErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }));

    // Messages per day
    const messagesPerDay: Record<string, number> = {};
    for (const e of messages) {
      const day = new Date(e.timestamp).toISOString().slice(0, 10);
      messagesPerDay[day] = (messagesPerDay[day] ?? 0) + 1;
    }

    return {
      totalMessages: messages.length,
      totalLLMCalls: llmCalls.length,
      totalToolUses: toolUses.length,
      totalErrors: errors.length,
      avgResponseTimeMs,
      totalTokens: { input: totalTokensIn, output: totalTokensOut, total: totalTokensIn + totalTokensOut },
      topSkills,
      topErrors,
      messagesPerDay,
      period: { from, to },
    };
  }

  getRecentEvents(limit: number = 50): AnalyticsEvent[] {
    return this.events.slice(-limit);
  }

  clear(): void {
    this.events = [];
    this.save();
  }

  /**
   * Format stats for CLI display.
   */
  static formatStats(stats: AnalyticsStats): string {
    const lines: string[] = [];
    lines.push('');
    lines.push('══════════════════════════════════════════');
    lines.push('  OPC Agent Analytics');
    lines.push('══════════════════════════════════════════');
    lines.push('');
    lines.push(`  📨 Messages:        ${stats.totalMessages}`);
    lines.push(`  🤖 LLM Calls:       ${stats.totalLLMCalls}`);
    lines.push(`  🔧 Tool Uses:        ${stats.totalToolUses}`);
    lines.push(`  ❌ Errors:           ${stats.totalErrors}`);
    lines.push(`  ⏱  Avg Response:     ${stats.avgResponseTimeMs}ms`);
    lines.push(`  🪙 Tokens:           ${stats.totalTokens.total} (in: ${stats.totalTokens.input}, out: ${stats.totalTokens.output})`);
    lines.push('');
    if (stats.topSkills.length > 0) {
      lines.push('  Top Skills:');
      for (const s of stats.topSkills.slice(0, 5)) {
        lines.push(`    • ${s.name}: ${s.count}`);
      }
      lines.push('');
    }
    if (stats.topErrors.length > 0) {
      lines.push('  Top Errors:');
      for (const e of stats.topErrors.slice(0, 3)) {
        lines.push(`    • ${e.message}: ${e.count}`);
      }
      lines.push('');
    }
    lines.push('──────────────────────────────────────────');
    return lines.join('\n');
  }
}
