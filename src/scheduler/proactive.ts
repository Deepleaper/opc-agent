/**
 * Proactive Agent — enables the agent to initiate conversations
 * rather than only responding to user messages.
 *
 * Triggers:
 * 1. Scheduled check-ins (morning summary, task follow-ups)
 * 2. Event-driven (pending task deadlines, reminder triggers)
 * 3. Idle detection (offer help after period of inactivity)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ProactiveConfig {
  enabled: boolean;
  /** Morning summary cron (default: 9:00) */
  morningCheckIn?: string;
  /** Evening wrap-up cron (default: 18:00) */
  eveningWrapUp?: string;
  /** Idle timeout in minutes before offering help */
  idleTimeoutMinutes?: number;
  /** Max proactive messages per day */
  maxDailyMessages?: number;
  /** Channels to send proactive messages to */
  channels?: string[];
}

export interface ProactiveMessage {
  type: 'check-in' | 'follow-up' | 'reminder' | 'idle-offer' | 'insight';
  content: string;
  timestamp: number;
  channel?: string;
}

const DEFAULT_CONFIG: ProactiveConfig = {
  enabled: true,
  morningCheckIn: '0 9 * * *',
  eveningWrapUp: '0 18 * * *',
  idleTimeoutMinutes: 120,
  maxDailyMessages: 5,
};

export class ProactiveAgent {
  private config: ProactiveConfig;
  private dailyMessageCount = 0;
  private lastResetDate = '';
  private lastUserActivity = Date.now();
  private pendingTasks: string[] = [];
  private stateFile: string;
  private messageHandler?: (msg: ProactiveMessage) => void | Promise<void>;

  constructor(config?: Partial<ProactiveConfig>, stateDir = '.opc') {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stateFile = path.resolve(stateDir, 'proactive-state.json');
    this.loadState();
  }

  /** Register handler for outgoing proactive messages */
  onMessage(handler: (msg: ProactiveMessage) => void | Promise<void>): void {
    this.messageHandler = handler;
  }

  /** Call when user sends a message (resets idle timer) */
  recordUserActivity(): void {
    this.lastUserActivity = Date.now();
  }

  /** Add a pending task for follow-up */
  addPendingTask(task: string): void {
    this.pendingTasks.push(task);
    this.saveState();
  }

  /** Remove completed task */
  completeTask(task: string): void {
    this.pendingTasks = this.pendingTasks.filter(t => t !== task);
    this.saveState();
  }

  /** Generate morning check-in message */
  async generateMorningCheckIn(): Promise<string> {
    const date = new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' });
    const parts = [`☀️ 早上好！今天是${date}。`];

    if (this.pendingTasks.length > 0) {
      parts.push(`\n📋 你有 ${this.pendingTasks.length} 个待办事项：`);
      this.pendingTasks.slice(0, 5).forEach((task, i) => {
        parts.push(`  ${i + 1}. ${task}`);
      });
    } else {
      parts.push('\n✅ 目前没有待办事项，今天想做什么？');
    }

    return parts.join('\n');
  }

  /** Generate evening wrap-up message */
  async generateEveningWrapUp(): Promise<string> {
    const parts = ['🌙 今日小结'];

    if (this.pendingTasks.length > 0) {
      parts.push(`\n⏳ 还有 ${this.pendingTasks.length} 个未完成的任务：`);
      this.pendingTasks.slice(0, 3).forEach((task, i) => {
        parts.push(`  ${i + 1}. ${task}`);
      });
      parts.push('\n明天继续加油！💪');
    } else {
      parts.push('\n🎉 所有任务都完成了，休息好！');
    }

    return parts.join('\n');
  }

  /** Check if idle and should offer help */
  async checkIdle(): Promise<ProactiveMessage | null> {
    if (!this.config.idleTimeoutMinutes) return null;
    const idleMs = Date.now() - this.lastUserActivity;
    const timeoutMs = this.config.idleTimeoutMinutes * 60 * 1000;

    if (idleMs > timeoutMs && this.canSend()) {
      return {
        type: 'idle-offer',
        content: '👋 有一阵没聊了，需要我帮你做点什么吗？',
        timestamp: Date.now(),
      };
    }
    return null;
  }

  /** Send a proactive message through the registered handler */
  async send(msg: ProactiveMessage): Promise<boolean> {
    if (!this.canSend()) return false;
    if (this.messageHandler) {
      await this.messageHandler(msg);
      this.dailyMessageCount++;
      this.saveState();
      return true;
    }
    return false;
  }

  /** Check if we can send more proactive messages today */
  private canSend(): boolean {
    if (!this.config.enabled) return false;
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.lastResetDate) {
      this.dailyMessageCount = 0;
      this.lastResetDate = today;
    }
    return this.dailyMessageCount < (this.config.maxDailyMessages ?? 5);
  }

  private loadState(): void {
    try {
      if (fs.existsSync(this.stateFile)) {
        const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
        this.dailyMessageCount = data.dailyMessageCount ?? 0;
        this.lastResetDate = data.lastResetDate ?? '';
        this.pendingTasks = data.pendingTasks ?? [];
        this.lastUserActivity = data.lastUserActivity ?? Date.now();
      }
    } catch { /* ignore */ }
  }

  private saveState(): void {
    try {
      const dir = path.dirname(this.stateFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.stateFile, JSON.stringify({
        dailyMessageCount: this.dailyMessageCount,
        lastResetDate: this.lastResetDate,
        pendingTasks: this.pendingTasks,
        lastUserActivity: this.lastUserActivity,
      }, null, 2));
    } catch { /* ignore */ }
  }

  getConfig(): ProactiveConfig { return { ...this.config }; }
  getPendingTasks(): string[] { return [...this.pendingTasks]; }
  getDailyMessageCount(): number { return this.dailyMessageCount; }
}
