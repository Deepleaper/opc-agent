/**
 * Simple cron scheduler — no external dependencies.
 * Supports cron expressions: star, star-slash-N, M-N, M,N for minute/hour/day/month/weekday.
 */

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  task: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

type CronField = { type: 'any' } | { type: 'every'; step: number } | { type: 'list'; values: number[] };

interface ParsedCron {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
}

function parseField(field: string, min: number, max: number): CronField {
  if (field === '*') return { type: 'any' };
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    if (isNaN(step) || step <= 0) throw new Error(`Invalid cron step: ${field}`);
    return { type: 'every', step };
  }
  // Could be comma-separated, each part could be a range
  const values: number[] = [];
  for (const part of field.split(',')) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      if (isNaN(a) || isNaN(b)) throw new Error(`Invalid cron range: ${part}`);
      for (let i = a; i <= b; i++) values.push(i);
    } else {
      const n = parseInt(part, 10);
      if (isNaN(n)) throw new Error(`Invalid cron value: ${part}`);
      values.push(n);
    }
  }
  return { type: 'list', values };
}

export function parseCron(expr: string): ParsedCron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`Invalid cron expression (need 5 fields): ${expr}`);
  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    dayOfMonth: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12),
    dayOfWeek: parseField(parts[4], 0, 6),
  };
}

function fieldMatches(field: CronField, value: number): boolean {
  switch (field.type) {
    case 'any': return true;
    case 'every': return value % field.step === 0;
    case 'list': return field.values.includes(value);
  }
}

export function cronMatches(parsed: ParsedCron, date: Date): boolean {
  return (
    fieldMatches(parsed.minute, date.getMinutes()) &&
    fieldMatches(parsed.hour, date.getHours()) &&
    fieldMatches(parsed.dayOfMonth, date.getDate()) &&
    fieldMatches(parsed.month, date.getMonth() + 1) &&
    fieldMatches(parsed.dayOfWeek, date.getDay())
  );
}

/** Compute approximate next run (scans forward up to 48h). */
function computeNextRun(parsed: ParsedCron, from: Date): Date | undefined {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  const limit = 48 * 60; // 48 hours in minutes
  for (let i = 0; i < limit; i++) {
    if (cronMatches(parsed, d)) return new Date(d);
    d.setMinutes(d.getMinutes() + 1);
  }
  return undefined;
}

export type JobHandler = (job: CronJob) => void | Promise<void>;

export class Scheduler {
  private jobs = new Map<string, CronJob>();
  private parsed = new Map<string, ParsedCron>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private handler: JobHandler;

  constructor(handler: JobHandler) {
    this.handler = handler;
  }

  addJob(job: CronJob): void {
    const p = parseCron(job.schedule);
    this.parsed.set(job.id, p);
    job.nextRun = computeNextRun(p, new Date()) ?? undefined;
    this.jobs.set(job.id, job);
  }

  removeJob(id: string): void {
    this.jobs.delete(id);
    this.parsed.delete(id);
  }

  enableJob(id: string): void {
    const job = this.jobs.get(id);
    if (job) job.enabled = true;
  }

  disableJob(id: string): void {
    const job = this.jobs.get(id);
    if (job) job.enabled = false;
  }

  getJobs(): CronJob[] {
    return Array.from(this.jobs.values());
  }

  getJob(id: string): CronJob | undefined {
    return this.jobs.get(id);
  }

  /** Run a specific job immediately */
  async runJob(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;
    job.lastRun = new Date();
    await this.handler(job);
    const parsed = this.parsed.get(id);
    if (parsed) job.nextRun = computeNextRun(parsed, new Date());
    return true;
  }

  start(): void {
    if (this.timer) return;
    // Check every 60 seconds
    this.timer = setInterval(() => this.tick(), 60_000);
    // Also tick immediately
    this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    const now = new Date();
    for (const [id, job] of this.jobs) {
      if (!job.enabled) continue;
      const parsed = this.parsed.get(id);
      if (!parsed) continue;
      if (cronMatches(parsed, now)) {
        // Avoid double-fire: check lastRun isn't same minute
        if (job.lastRun) {
          const last = job.lastRun;
          if (last.getFullYear() === now.getFullYear() &&
              last.getMonth() === now.getMonth() &&
              last.getDate() === now.getDate() &&
              last.getHours() === now.getHours() &&
              last.getMinutes() === now.getMinutes()) {
            continue;
          }
        }
        job.lastRun = new Date(now);
        job.nextRun = computeNextRun(parsed, now);
        // Fire and forget (log errors)
        Promise.resolve(this.handler(job)).catch((err) => {
          console.error(`[scheduler] Job "${job.name}" failed:`, err);
        });
      }
    }
  }
}
