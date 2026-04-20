/**
 * Cron Engine — persistent scheduler with file-based storage.
 * Manages scheduled tasks with cron expressions, persists to ~/.opc/schedules.json,
 * and auto-recovers on startup.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parseCron, cronMatches, Scheduler } from '../core/scheduler';
import type { CronJob, JobHandler } from '../core/scheduler';

export interface ScheduleTask {
  id: string;
  name: string;
  schedule: string;        // cron expression
  description: string;     // natural language description
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  time?: string;           // HH:mm for simple schedules
  outputChannel: 'telegram' | 'email' | 'web';
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRun?: string;
  nextRun?: string;
}

export interface SchedulesStore {
  tasks: ScheduleTask[];
}

function getSchedulesPath(projectDir?: string): string {
  // 使用项目本地路径而不是全局 ~/.opc/，避免新 agent 加载其他项目的任务
  const dir = projectDir ? join(projectDir, '.opc') : join(process.cwd(), '.opc');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'schedules.json');
}

function loadSchedules(): SchedulesStore {
  const p = getSchedulesPath();
  if (existsSync(p)) {
    try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { /* ignore */ }
  }
  return { tasks: [] };
}

function saveSchedules(store: SchedulesStore): void {
  writeFileSync(getSchedulesPath(), JSON.stringify(store, null, 2));
}

/** Convert frequency + time to cron expression */
export function frequencyToCron(frequency: string, time?: string): string {
  const [hour, minute] = (time || '09:00').split(':').map(Number);
  switch (frequency) {
    case 'daily':   return `${minute} ${hour} * * *`;
    case 'weekly':  return `${minute} ${hour} * * 1`;
    case 'monthly': return `${minute} ${hour} 1 * *`;
    default:        return '0 9 * * *'; // fallback
  }
}

/** Compute next run from a cron expression */
function computeNextRun(cronExpr: string): string | undefined {
  try {
    const parsed = parseCron(cronExpr);
    const d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + 1);
    for (let i = 0; i < 48 * 60; i++) {
      if (cronMatches(parsed, d)) return d.toISOString();
      d.setMinutes(d.getMinutes() + 1);
    }
  } catch { /* ignore */ }
  return undefined;
}

export class CronEngine {
  private scheduler: Scheduler;
  private store: SchedulesStore;
  private handler: JobHandler;

  constructor(handler?: JobHandler) {
    this.handler = handler || (async (job) => {
      console.log(`[cron-engine] Executing job: ${job.name} (${job.id})`);
    });
    this.scheduler = new Scheduler(this.handler);
    this.store = loadSchedules();
  }

  /** Initialize and recover persisted tasks */
  start(): void {
    for (const task of this.store.tasks) {
      if (task.enabled) {
        this.scheduler.addJob({
          id: task.id,
          name: task.name,
          schedule: task.schedule,
          task: task.description,
          enabled: true,
        });
      }
    }
    this.scheduler.start();
    console.log(`[cron-engine] Started with ${this.store.tasks.filter(t => t.enabled).length} active tasks`);
  }

  stop(): void {
    this.scheduler.stop();
  }

  listTasks(): ScheduleTask[] {
    // Refresh nextRun
    return this.store.tasks.map(t => ({
      ...t,
      nextRun: t.enabled ? computeNextRun(t.schedule) : undefined,
    }));
  }

  getTask(id: string): ScheduleTask | undefined {
    return this.store.tasks.find(t => t.id === id);
  }

  createTask(input: Omit<ScheduleTask, 'id' | 'createdAt' | 'updatedAt' | 'lastRun' | 'nextRun'>): ScheduleTask {
    const id = `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const schedule = input.schedule || frequencyToCron(input.frequency, input.time);
    const task: ScheduleTask = {
      ...input,
      id,
      schedule,
      createdAt: now,
      updatedAt: now,
      nextRun: input.enabled ? computeNextRun(schedule) : undefined,
    };
    this.store.tasks.push(task);
    saveSchedules(this.store);

    if (task.enabled) {
      this.scheduler.addJob({
        id: task.id,
        name: task.name,
        schedule: task.schedule,
        task: task.description,
        enabled: true,
      });
    }
    return task;
  }

  updateTask(id: string, updates: Partial<ScheduleTask>): ScheduleTask | null {
    const idx = this.store.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;

    const task = { ...this.store.tasks[idx], ...updates, id, updatedAt: new Date().toISOString() };
    if (updates.frequency || updates.time) {
      task.schedule = updates.schedule || frequencyToCron(task.frequency, task.time);
    }
    task.nextRun = task.enabled ? computeNextRun(task.schedule) : undefined;
    this.store.tasks[idx] = task;
    saveSchedules(this.store);

    // Update scheduler
    this.scheduler.removeJob(id);
    if (task.enabled) {
      this.scheduler.addJob({
        id: task.id,
        name: task.name,
        schedule: task.schedule,
        task: task.description,
        enabled: true,
      });
    }
    return task;
  }

  deleteTask(id: string): boolean {
    const idx = this.store.tasks.findIndex(t => t.id === id);
    if (idx === -1) return false;
    this.store.tasks.splice(idx, 1);
    saveSchedules(this.store);
    this.scheduler.removeJob(id);
    return true;
  }

  async runTask(id: string): Promise<boolean> {
    const task = this.store.tasks.find(t => t.id === id);
    if (!task) return false;
    task.lastRun = new Date().toISOString();
    saveSchedules(this.store);
    return this.scheduler.runJob(id);
  }
}
