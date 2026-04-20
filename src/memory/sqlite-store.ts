/**
 * SQLite-backed persistent memory store using sql.js (pure JS, no native deps).
 * Supports conversation history with FTS5 full-text search.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Message, MemoryStore } from '../core/types';

let initSqlJs: any;
try {
  initSqlJs = require('sql.js');
} catch {
  // sql.js not installed — will fail gracefully at construction
}

export interface SQLiteStoreOptions {
  /** Path to the .db file. Defaults to .opc/memory.db */
  dbPath?: string;
  /** Max messages per session before pruning oldest. Default 1000 */
  maxMessagesPerSession?: number;
}

export class SQLiteStore implements MemoryStore {
  private db: any = null;
  private dbPath: string;
  private maxMessages: number;
  private kvCache = new Map<string, unknown>();
  private ready: Promise<void>;

  constructor(options: SQLiteStoreOptions = {}) {
    this.dbPath = options.dbPath ?? path.resolve('.opc', 'memory.db');
    this.maxMessages = options.maxMessagesPerSession ?? 1000;
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    if (!initSqlJs) {
      throw new Error('sql.js not installed. Run: npm install sql.js');
    }

    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const SQL = await initSqlJs();

    // Load existing DB or create new
    if (fs.existsSync(this.dbPath)) {
      const buf = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buf);
    } else {
      this.db = new SQL.Database();
    }

    // Create tables
    this.db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        msg_id TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // FTS5 for full-text search (may not be available in all sql.js builds)
    try {
      this.db.run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
          content,
          content_rowid='id',
          content='messages'
        )
      `);

      // Triggers to keep FTS in sync
      this.db.run(`
        CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
          INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
        END
      `);

      this.db.run(`
        CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
          INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
        END
      `);
      (this as any)._hasFTS = true;
    } catch {
      // FTS5 not available — search will use LIKE fallback
      (this as any)._hasFTS = false;
    }

    // Load KV into cache
    const kvRows = this.db.exec('SELECT key, value FROM kv');
    if (kvRows.length > 0) {
      for (const row of kvRows[0].values) {
        try {
          this.kvCache.set(row[0] as string, JSON.parse(row[1] as string));
        } catch {
          this.kvCache.set(row[0] as string, row[1]);
        }
      }
    }

    this.save();
  }

  private save(): void {
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch { /* ignore save errors */ }
  }

  async get(key: string): Promise<unknown> {
    await this.ready;
    return this.kvCache.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.ready;
    this.kvCache.set(key, value);
    const json = JSON.stringify(value);
    this.db.run('INSERT OR REPLACE INTO kv(key, value) VALUES(?, ?)', [key, json]);
    this.save();
  }

  async getConversation(sessionId: string): Promise<Message[]> {
    await this.ready;
    const result = this.db.exec(
      'SELECT msg_id, role, content, timestamp, metadata FROM messages WHERE session_id = ? ORDER BY id ASC',
      [sessionId],
    );
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => ({
      id: row[0] || `msg_${row[3]}`,
      role: row[1] as 'user' | 'assistant' | 'system',
      content: row[2] as string,
      timestamp: row[3] as number,
      metadata: row[4] ? JSON.parse(row[4]) : undefined,
    }));
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    await this.ready;
    this.db.run(
      'INSERT INTO messages(session_id, msg_id, role, content, timestamp, metadata) VALUES(?, ?, ?, ?, ?, ?)',
      [
        sessionId,
        message.id,
        message.role,
        message.content,
        message.timestamp,
        message.metadata ? JSON.stringify(message.metadata) : null,
      ],
    );

    // Prune if over limit
    const countResult = this.db.exec(
      'SELECT COUNT(*) FROM messages WHERE session_id = ?',
      [sessionId],
    );
    if (countResult.length > 0) {
      const count = countResult[0].values[0][0] as number;
      if (count > this.maxMessages) {
        const excess = count - this.maxMessages;
        this.db.run(
          `DELETE FROM messages WHERE id IN (
            SELECT id FROM messages WHERE session_id = ? ORDER BY id ASC LIMIT ?
          )`,
          [sessionId, excess],
        );
      }
    }

    this.save();
  }

  async clear(sessionId?: string): Promise<void> {
    await this.ready;
    if (sessionId) {
      this.db.run('DELETE FROM messages WHERE session_id = ?', [sessionId]);
    } else {
      this.db.run('DELETE FROM messages');
      this.db.run('DELETE FROM kv');
      this.kvCache.clear();
    }
    this.save();
  }

  /**
   * Full-text search across all conversations.
   * Returns matching messages ranked by relevance.
   */
  async search(query: string, limit = 20): Promise<Message[]> {
    await this.ready;

    let result;
    if ((this as any)._hasFTS) {
      result = this.db.exec(
        `SELECT m.msg_id, m.role, m.content, m.timestamp, m.metadata, m.session_id
         FROM messages_fts f
         JOIN messages m ON f.rowid = m.id
         WHERE messages_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
        [query, limit],
      );
    } else {
      // LIKE fallback
      const likeQuery = `%${query}%`;
      result = this.db.exec(
        `SELECT msg_id, role, content, timestamp, metadata, session_id
         FROM messages
         WHERE content LIKE ?
         ORDER BY timestamp DESC
         LIMIT ?`,
        [likeQuery, limit],
      );
    }
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => ({
      id: row[0] || `msg_${row[3]}`,
      role: row[1] as 'user' | 'assistant' | 'system',
      content: row[2] as string,
      timestamp: row[3] as number,
      metadata: { ...(row[4] ? JSON.parse(row[4]) : {}), sessionId: row[5] },
    }));
  }

  /**
   * Get conversation stats.
   */
  async stats(): Promise<{ totalMessages: number; sessions: number; dbSizeKB: number }> {
    await this.ready;
    const msgResult = this.db.exec('SELECT COUNT(*) FROM messages');
    const sessResult = this.db.exec('SELECT COUNT(DISTINCT session_id) FROM messages');
    const totalMessages = msgResult.length > 0 ? (msgResult[0].values[0][0] as number) : 0;
    const sessions = sessResult.length > 0 ? (sessResult[0].values[0][0] as number) : 0;
    let dbSizeKB = 0;
    try {
      const stat = fs.statSync(this.dbPath);
      dbSizeKB = Math.round(stat.size / 1024);
    } catch { /* ignore */ }
    return { totalMessages, sessions, dbSizeKB };
  }

  /**
   * Close the database (for graceful shutdown).
   */
  async close(): Promise<void> {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}
