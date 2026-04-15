import { BaseSkill } from './base';
import type { AgentContext, Message, SkillResult } from '../core/types';

export interface ScheduledTask {
  id: string;
  name: string;
  cronExpr: string;
  action: string;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

export class SchedulerSkill extends BaseSkill {
  name = 'scheduler';
  description = 'Schedule recurring tasks. Usage: schedule list | schedule add <name> <cron> <action> | schedule remove <id>';
  private tasks: Map<string, ScheduledTask> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  async execute(context: AgentContext, message: Message): Promise<SkillResult> {
    const text = message.content.trim();

    if (/^schedule\s+list$/i.test(text)) {
      if (this.tasks.size === 0) return this.match('No scheduled tasks.');
      const lines = Array.from(this.tasks.values()).map(t =>
        `• ${t.name} (${t.id}) — ${t.cronExpr} — ${t.enabled ? '✅' : '❌'} — Last: ${t.lastRun ? new Date(t.lastRun).toISOString() : 'never'}`
      );
      return this.match(`Scheduled tasks:\n${lines.join('\n')}`);
    }

    const addMatch = text.match(/^schedule\s+add\s+(\S+)\s+(".*?"|\S+)\s+(.+)$/i);
    if (addMatch) {
      const [, name, cronExpr, action] = addMatch;
      const id = `task_${Date.now().toString(36)}`;
      const task: ScheduledTask = {
        id, name, cronExpr: cronExpr.replace(/"/g, ''), action, enabled: true,
      };
      this.tasks.set(id, task);
      // Simple interval-based scheduling (parse cron for interval in minutes)
      const intervalMs = this.parseCronToInterval(task.cronExpr);
      if (intervalMs > 0) {
        const timer = setInterval(() => {
          task.lastRun = Date.now();
        }, intervalMs);
        this.timers.set(id, timer);
      }
      return this.match(`Task scheduled: ${name} (${id}) — ${task.cronExpr} → "${action}"`);
    }

    const rmMatch = text.match(/^schedule\s+remove\s+(\S+)$/i);
    if (rmMatch) {
      const id = rmMatch[1];
      const timer = this.timers.get(id);
      if (timer) clearInterval(timer);
      this.timers.delete(id);
      const removed = this.tasks.delete(id);
      return this.match(removed ? `Task ${id} removed.` : `Task ${id} not found.`);
    }

    return this.noMatch();
  }

  private parseCronToInterval(expr: string): number {
    // Simple: support "every Xm" or "every Xh" or basic intervals
    const m = expr.match(/every\s+(\d+)\s*(m|min|h|hr|s|sec)/i);
    if (m) {
      const val = parseInt(m[1]);
      const unit = m[2].toLowerCase();
      if (unit.startsWith('h')) return val * 3600_000;
      if (unit.startsWith('m')) return val * 60_000;
      if (unit.startsWith('s')) return val * 1000;
    }
    return 0; // Unknown cron format, no auto-schedule
  }

  destroy(): void {
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
  }
}
