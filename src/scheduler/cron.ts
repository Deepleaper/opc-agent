// v2 cron — lightweight cron-expression scheduler for agent proactive tasks

export interface CronJob {
  id: string;
  expression: string;
  handler: () => Promise<void>;
  enabled: boolean;
  lastRunAt?: number;
  nextRunAt?: number;
}

export class CronScheduler {
  private jobs = new Map<string, CronJob>();
  private timers = new Map<string, NodeJS.Timeout>();

  add(job: CronJob): void {
    this.jobs.set(job.id, job);
    if (job.enabled) this.schedule(job);
  }

  remove(id: string): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
    this.jobs.delete(id);
  }

  enable(id: string): void {
    const job = this.jobs.get(id);
    if (job) { job.enabled = true; this.schedule(job); }
  }

  disable(id: string): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    const job = this.jobs.get(id);
    if (job) job.enabled = false;
  }

  list(): CronJob[] {
    return Array.from(this.jobs.values());
  }

  private schedule(job: CronJob): void {
    const ms = nextIntervalMs(job.expression);
    if (ms === null) return;
    const timer = setTimeout(async () => {
      job.lastRunAt = Date.now();
      try { await job.handler(); } catch { /* swallow — caller responsibility */ }
      if (job.enabled) this.schedule(job);
    }, ms);
    this.timers.set(job.id, timer);
    job.nextRunAt = Date.now() + ms;
  }
}

function nextIntervalMs(expression: string): number | null {
  const match = /^@every\s+(\d+)(s|m|h)$/.exec(expression);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  const unit = match[2];
  return n * (unit === 's' ? 1000 : unit === 'm' ? 60_000 : 3_600_000);
}
