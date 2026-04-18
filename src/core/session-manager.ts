import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Message } from './types';

export interface Session {
  id: string;
  agentId: string;
  channel: string;
  messages: Message[];
  metadata: Record<string, any>;
  createdAt: number;
  lastActivity: number;
  parentId?: string;
  compactedAt?: number;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = storageDir || path.join(process.env.HOME || process.env.USERPROFILE || '~', '.opc', 'sessions');
  }

  create(agentId: string, channel: string, parentId?: string): Session {
    const session: Session = {
      id: crypto.randomUUID(),
      agentId,
      channel,
      messages: [],
      metadata: {},
      createdAt: Date.now(),
      lastActivity: Date.now(),
      parentId,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): Session | null {
    return this.sessions.get(id) || null;
  }

  list(filter?: { agentId?: string; channel?: string; active?: boolean }): Session[] {
    let result = Array.from(this.sessions.values());
    if (filter?.agentId) result = result.filter(s => s.agentId === filter.agentId);
    if (filter?.channel) result = result.filter(s => s.channel === filter.channel);
    if (filter?.active !== undefined) {
      const cutoff = Date.now() - 30 * 60 * 1000; // 30 min
      result = result.filter(s => filter.active ? s.lastActivity > cutoff : s.lastActivity <= cutoff);
    }
    return result;
  }

  addMessage(sessionId: string, message: Message): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    session.messages.push(message);
    session.lastActivity = Date.now();
  }

  async compact(sessionId: string, brain?: any): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (brain && typeof brain.compress === 'function') {
      const compressed = await brain.compress(session.messages);
      session.messages = [{ id: 'compacted', role: 'system', content: compressed, timestamp: Date.now() }];
    } else {
      // Simple: keep first and last 5 messages
      if (session.messages.length > 10) {
        const first = session.messages.slice(0, 2);
        const last = session.messages.slice(-5);
        session.messages = [...first, { id: 'compacted', role: 'system', content: `[${session.messages.length - 7} messages compacted]`, timestamp: Date.now() }, ...last];
      }
    }
    session.compactedAt = Date.now();
  }

  prune(maxAge: number): number {
    const cutoff = Date.now() - maxAge;
    let pruned = 0;
    for (const [id, session] of this.sessions) {
      if (session.lastActivity < cutoff) {
        this.sessions.delete(id);
        pruned++;
      }
    }
    return pruned;
  }

  getLineage(sessionId: string): Session[] {
    const lineage: Session[] = [];
    let current = this.sessions.get(sessionId);
    while (current) {
      lineage.unshift(current);
      current = current.parentId ? this.sessions.get(current.parentId) || undefined : undefined;
    }
    return lineage;
  }

  fork(sessionId: string): Session {
    const parent = this.sessions.get(sessionId);
    if (!parent) throw new Error(`Session ${sessionId} not found`);
    return this.create(parent.agentId, parent.channel, parent.id);
  }

  export(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const lines = [`# Session ${session.id}`, `Agent: ${session.agentId} | Channel: ${session.channel}`, `Created: ${new Date(session.createdAt).toISOString()}`, ''];
    for (const msg of session.messages) {
      lines.push(`**${msg.role}** (${new Date(msg.timestamp).toISOString()}):`);
      lines.push(msg.content);
      lines.push('');
    }
    return lines.join('\n');
  }

  save(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    for (const [id, session] of this.sessions) {
      fs.writeFileSync(path.join(this.storageDir, `${id}.json`), JSON.stringify(session, null, 2));
    }
  }

  load(): void {
    if (!fs.existsSync(this.storageDir)) return;
    const files = fs.readdirSync(this.storageDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(this.storageDir, file), 'utf-8'));
      this.sessions.set(data.id, data);
    }
  }
}
