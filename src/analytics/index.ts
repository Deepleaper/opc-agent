/**
 * Agent Analytics — track messages, response times, skill usage, errors, tokens.
 */
export interface AnalyticsSnapshot {
  messagesProcessed: number;
  avgResponseTimeMs: number;
  skillUsage: Record<string, number>;
  errorCount: number;
  tokenUsage: { input: number; output: number; total: number };
  uptime: number;
  startedAt: number;
}

export class Analytics {
  private messagesProcessed = 0;
  private totalResponseTimeMs = 0;
  private skillUsage: Record<string, number> = {};
  private errorCount = 0;
  private tokenUsage = { input: 0, output: 0 };
  private startedAt = Date.now();

  recordMessage(responseTimeMs: number): void {
    this.messagesProcessed++;
    this.totalResponseTimeMs += responseTimeMs;
  }

  recordSkillUsage(skillName: string): void {
    this.skillUsage[skillName] = (this.skillUsage[skillName] ?? 0) + 1;
  }

  recordError(): void {
    this.errorCount++;
  }

  recordTokens(input: number, output: number): void {
    this.tokenUsage.input += input;
    this.tokenUsage.output += output;
  }

  getSnapshot(): AnalyticsSnapshot {
    return {
      messagesProcessed: this.messagesProcessed,
      avgResponseTimeMs: this.messagesProcessed > 0
        ? Math.round(this.totalResponseTimeMs / this.messagesProcessed)
        : 0,
      skillUsage: { ...this.skillUsage },
      errorCount: this.errorCount,
      tokenUsage: {
        input: this.tokenUsage.input,
        output: this.tokenUsage.output,
        total: this.tokenUsage.input + this.tokenUsage.output,
      },
      uptime: Date.now() - this.startedAt,
      startedAt: this.startedAt,
    };
  }

  reset(): void {
    this.messagesProcessed = 0;
    this.totalResponseTimeMs = 0;
    this.skillUsage = {};
    this.errorCount = 0;
    this.tokenUsage = { input: 0, output: 0 };
    this.startedAt = Date.now();
  }
}
