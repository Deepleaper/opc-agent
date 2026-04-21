import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import initSqlJs from 'sql.js';
import type { KnowledgeEntry, Experience, SkillRecord, EvolutionLog } from '../core/types';

export { randomUUID };

type SqlStatic = Awaited<ReturnType<typeof initSqlJs>>;
type DbInstance = InstanceType<SqlStatic['Database']>;

export interface BrainStoreOptions {
  dbPath: string;
}

export interface FtsResult {
  entry: KnowledgeEntry;
  rank: number; // positive, higher = better match
}

const KNOWLEDGE_SOURCES = new Set(['l1', 'l2', 'l3', 'l4', 'user', 'seed']);
const WORKSTATION_LAYERS = new Set(['workstation', 'job', 'industry']);

function toKnowledgeSource(v: unknown): KnowledgeEntry['source'] {
  return typeof v === 'string' && KNOWLEDGE_SOURCES.has(v)
    ? (v as KnowledgeEntry['source'])
    : 'user';
}

function toWorkstationLayer(v: unknown): KnowledgeEntry['layer'] {
  return typeof v === 'string' && WORKSTATION_LAYERS.has(v)
    ? (v as KnowledgeEntry['layer'])
    : 'workstation';
}

function rowToEntry(row: { [key: string]: unknown }): KnowledgeEntry {
  let embedding: number[] | null = null;
  const emb = row['embedding'];
  if (emb instanceof Uint8Array && emb.byteLength > 0) {
    const fa = new Float32Array(emb.buffer, emb.byteOffset, emb.byteLength / 4);
    embedding = Array.from(fa);
  }
  let tags: string[] = [];
  try {
    tags = JSON.parse(String(row['tags'] ?? '[]'));
  } catch {
    tags = [];
  }
  return {
    id: String(row['id'] ?? ''),
    content: String(row['content'] ?? ''),
    source: toKnowledgeSource(row['source']),
    layer: toWorkstationLayer(row['layer']),
    tags,
    embedding,
    maturityScore: Number(row['maturity_score']) || 0,
    useCount: Number(row['use_count']) || 0,
    lastUsed: String(row['last_used'] ?? ''),
    createdAt: String(row['created_at'] ?? ''),
    updatedAt: String(row['updated_at'] ?? ''),
  };
}

function serializeEmbedding(embedding: number[] | null): Uint8Array | null {
  if (!embedding || embedding.length === 0) return null;
  return new Uint8Array(new Float32Array(embedding).buffer);
}

function escapeFts(query: string): string {
  return query
    .replace(/['"*^~\-+()]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

export class BrainStore {
  private SQL!: SqlStatic;
  private db!: DbInstance;
  private hasFts5 = false;
  private ready = false;

  constructor(private opts: BrainStoreOptions) {}

  async init(): Promise<void> {
    const sqlJsDir = path.dirname(require.resolve('sql.js'));
    this.SQL = await initSqlJs({
      locateFile: (file: string) => path.join(sqlJsDir, file),
    });

    const dir = path.dirname(this.opts.dbPath);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(this.opts.dbPath)) {
      const buf = fs.readFileSync(this.opts.dbPath);
      this.db = new this.SQL.Database(buf);
    } else {
      this.db = new this.SQL.Database();
    }

    this._createSchema();
    this.ready = true;
    this.persist();
  }

  private _createSchema(): void {
    this.db.run(`CREATE TABLE IF NOT EXISTS knowledge (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      source TEXT,
      layer TEXT,
      tags TEXT DEFAULT '[]',
      embedding BLOB,
      maturity_score REAL DEFAULT 0,
      use_count INTEGER DEFAULT 0,
      last_used TEXT,
      created_at TEXT,
      updated_at TEXT
    )`);

    try {
      this.db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
        id UNINDEXED,
        content,
        tags,
        tokenize='unicode61'
      )`);
      this.hasFts5 = true;
    } catch {
      this.hasFts5 = false;
    }

    this.db.run(`CREATE TABLE IF NOT EXISTS experiences (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      summary TEXT,
      lessons TEXT,
      error_patterns TEXT,
      created_at TEXT
    )`);

    this.db.run(`CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      file_path TEXT,
      status TEXT,
      use_count INTEGER DEFAULT 0,
      created_at TEXT
    )`);

    this.db.run(`CREATE TABLE IF NOT EXISTS evolution_log (
      id TEXT PRIMARY KEY,
      layer TEXT,
      action TEXT,
      details TEXT,
      model_used TEXT,
      created_at TEXT
    )`);
  }

  private ensureReady(): void {
    if (!this.ready) throw new Error('BrainStore not initialized — call init() first');
  }

  upsert(entry: KnowledgeEntry): void {
    this.ensureReady();
    const embBlob = serializeEmbedding(entry.embedding);

    this.db.run(
      `INSERT OR REPLACE INTO knowledge
        (id, content, source, layer, tags, embedding, maturity_score, use_count, last_used, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entry.id, entry.content, entry.source, entry.layer,
        JSON.stringify(entry.tags), embBlob,
        entry.maturityScore, entry.useCount, entry.lastUsed,
        entry.createdAt, entry.updatedAt]
    );

    if (this.hasFts5) {
      this.db.run(`DELETE FROM knowledge_fts WHERE id = ?`, [entry.id]);
      this.db.run(
        `INSERT INTO knowledge_fts (id, content, tags) VALUES (?, ?, ?)`,
        [entry.id, entry.content, entry.tags.join(' ')]
      );
    }

    this.persist();
  }

  ftsSearch(query: string, limit = 20): FtsResult[] {
    this.ensureReady();
    const results: FtsResult[] = [];
    const escaped = escapeFts(query);
    if (!escaped) return results;

    if (this.hasFts5) {
      try {
        const stmt = this.db.prepare(
          `SELECT id, rank FROM knowledge_fts WHERE knowledge_fts MATCH ? ORDER BY rank LIMIT ?`
        );
        stmt.bind([escaped, limit]);
        const hits: Array<{ id: string; rank: number }> = [];
        while (stmt.step()) {
          const row = stmt.getAsObject();
          hits.push({ id: String(row['id']), rank: Math.abs(Number(row['rank'])) || 0.001 });
        }
        stmt.free();

        for (const hit of hits) {
          const entry = this.getById(hit.id);
          if (entry) results.push({ entry, rank: hit.rank });
        }
        if (results.length > 0) return results;
      } catch {
        // fall through to LIKE
      }
    }

    // LIKE fallback
    const like = `%${query.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    const stmt = this.db.prepare(
      `SELECT * FROM knowledge WHERE content LIKE ? OR tags LIKE ? LIMIT ?`
    );
    stmt.bind([like, like, limit]);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({ entry: rowToEntry(row), rank: 1 });
    }
    stmt.free();
    return results;
  }

  getAll(): KnowledgeEntry[] {
    this.ensureReady();
    const stmt = this.db.prepare('SELECT * FROM knowledge');
    const results: KnowledgeEntry[] = [];
    while (stmt.step()) {
      results.push(rowToEntry(stmt.getAsObject()));
    }
    stmt.free();
    return results;
  }

  getById(id: string): KnowledgeEntry | null {
    this.ensureReady();
    const stmt = this.db.prepare('SELECT * FROM knowledge WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const entry = rowToEntry(stmt.getAsObject());
      stmt.free();
      return entry;
    }
    stmt.free();
    return null;
  }

  countByLayer(): Record<string, number> {
    this.ensureReady();
    const stmt = this.db.prepare('SELECT layer, COUNT(*) as cnt FROM knowledge GROUP BY layer');
    const result: Record<string, number> = {};
    while (stmt.step()) {
      const row = stmt.getAsObject();
      result[String(row['layer'] ?? '')] = Number(row['cnt']) || 0;
    }
    stmt.free();
    return result;
  }

  countBySource(): Record<string, number> {
    this.ensureReady();
    const stmt = this.db.prepare('SELECT source, COUNT(*) as cnt FROM knowledge GROUP BY source');
    const result: Record<string, number> = {};
    while (stmt.step()) {
      const row = stmt.getAsObject();
      result[String(row['source'] ?? '')] = Number(row['cnt']) || 0;
    }
    stmt.free();
    return result;
  }

  total(): number {
    this.ensureReady();
    const stmt = this.db.prepare('SELECT COUNT(*) as cnt FROM knowledge');
    stmt.step();
    const cnt = Number(stmt.getAsObject()['cnt']) || 0;
    stmt.free();
    return cnt;
  }

  avgMaturity(): number {
    this.ensureReady();
    const stmt = this.db.prepare('SELECT AVG(maturity_score) as avg FROM knowledge');
    stmt.step();
    const avg = Number(stmt.getAsObject()['avg']) || 0;
    stmt.free();
    return avg;
  }

  lastEvolutionTime(): number | undefined {
    this.ensureReady();
    const stmt = this.db.prepare('SELECT MAX(created_at) as last FROM evolution_log');
    stmt.step();
    const val = stmt.getAsObject()['last'];
    stmt.free();
    if (!val) return undefined;
    const ts = Date.parse(String(val));
    return isNaN(ts) ? undefined : ts;
  }

  insertEvolutionLog(log: EvolutionLog): void {
    this.ensureReady();
    this.db.run(
      `INSERT OR REPLACE INTO evolution_log (id, layer, action, details, model_used, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [log.id, log.layer, log.action, JSON.stringify(log.details), log.modelUsed, log.createdAt]
    );
    this.persist();
  }

  insertExperience(exp: Experience): void {
    this.ensureReady();
    this.db.run(
      `INSERT OR REPLACE INTO experiences (id, session_id, summary, lessons, error_patterns, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [exp.id, exp.sessionId, exp.summary,
        JSON.stringify(exp.lessons), JSON.stringify(exp.errorPatterns), exp.createdAt]
    );
    this.persist();
  }

  insertSkill(skill: SkillRecord): void {
    this.ensureReady();
    this.db.run(
      `INSERT OR REPLACE INTO skills (id, name, description, file_path, status, use_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [skill.id, skill.name, skill.description, skill.filePath, skill.status, skill.useCount, skill.createdAt]
    );
    this.persist();
  }

  persist(): void {
    if (!this.db) return;
    const dir = path.dirname(this.opts.dbPath);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.opts.dbPath, Buffer.from(this.db.export()));
  }

  close(): void {
    if (this.db) {
      this.persist();
      this.db.close();
    }
  }
}
