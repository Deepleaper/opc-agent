/**
 * Knowledge Base / RAG - Local vector storage with semantic search
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Simple in-memory vector store (PGlite-compatible interface for future migration)
interface VectorEntry {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

interface KnowledgeStore {
  entries: VectorEntry[];
  version: number;
  updatedAt: string;
}

const CHUNK_SIZE = 500; // chars per chunk
const CHUNK_OVERLAP = 50;
const STORE_FILE = '.opc-knowledge.json';

function splitText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  // Split by paragraphs first, then by size
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      // Keep overlap from end of current
      current = current.slice(-overlap) + '\n\n' + para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // If any chunk is still too large, split by sentences
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= chunkSize * 1.5) {
      result.push(chunk);
    } else {
      const sentences = chunk.split(/(?<=[.!?])\s+/);
      let buf = '';
      for (const s of sentences) {
        if (buf.length + s.length > chunkSize && buf) {
          result.push(buf.trim());
          buf = buf.slice(-overlap) + ' ' + s;
        } else {
          buf += (buf ? ' ' : '') + s;
        }
      }
      if (buf.trim()) result.push(buf.trim());
    }
  }
  return result;
}

// Simple TF-IDF-like embedding (no external dependencies)
// For production, replace with real embedding API
function simpleEmbed(text: string): number[] {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const dim = 128;
  const vec = new Array(dim).fill(0);

  for (const word of words) {
    const hash = crypto.createHash('md5').update(word).digest();
    for (let i = 0; i < dim; i++) {
      vec[i] += (hash[i % hash.length] - 128) / 128;
    }
  }

  // Normalize
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / mag);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

export class KnowledgeBase {
  private store: KnowledgeStore;
  private storePath: string;

  constructor(baseDir: string = '.') {
    this.storePath = path.join(baseDir, STORE_FILE);
    this.store = this.load();
  }

  private load(): KnowledgeStore {
    try {
      if (fs.existsSync(this.storePath)) {
        return JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
      }
    } catch { /* ignore */ }
    return { entries: [], version: 1, updatedAt: new Date().toISOString() };
  }

  private save(): void {
    this.store.updatedAt = new Date().toISOString();
    fs.writeFileSync(this.storePath, JSON.stringify(this.store), 'utf-8');
  }

  async addFile(filePath: string): Promise<{ chunks: number }> {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`File not found: ${absPath}`);
    }

    const content = fs.readFileSync(absPath, 'utf-8');
    const filename = path.basename(absPath);

    // Remove existing entries for this file
    this.store.entries = this.store.entries.filter(
      e => e.metadata.source !== filename
    );

    const chunks = splitText(content);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      this.store.entries.push({
        id: `${filename}_${i}_${Date.now()}`,
        content: chunk,
        embedding: simpleEmbed(chunk),
        metadata: {
          source: filename,
          chunkIndex: i,
          totalChunks: chunks.length,
          addedAt: new Date().toISOString(),
        },
      });
    }

    this.save();
    return { chunks: chunks.length };
  }

  async addText(text: string, source: string = 'manual'): Promise<{ chunks: number }> {
    const chunks = splitText(text);
    for (let i = 0; i < chunks.length; i++) {
      this.store.entries.push({
        id: `${source}_${i}_${Date.now()}`,
        content: chunks[i],
        embedding: simpleEmbed(chunks[i]),
        metadata: { source, chunkIndex: i, totalChunks: chunks.length, addedAt: new Date().toISOString() },
      });
    }
    this.save();
    return { chunks: chunks.length };
  }

  async search(query: string, topK: number = 5): Promise<Array<{ content: string; score: number; source: string }>> {
    if (this.store.entries.length === 0) return [];

    const queryEmb = simpleEmbed(query);
    const scored = this.store.entries.map(entry => ({
      content: entry.content,
      score: cosineSimilarity(queryEmb, entry.embedding),
      source: String(entry.metadata.source ?? 'unknown'),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /** Build context string for injection into LLM calls */
  async getContext(query: string, topK: number = 3, minScore: number = 0.1): Promise<string> {
    const results = await this.search(query, topK);
    const relevant = results.filter(r => r.score >= minScore);
    if (relevant.length === 0) return '';

    return `\n\n--- Relevant Knowledge ---\n${relevant.map((r, i) =>
      `[${i + 1}] (source: ${r.source}, relevance: ${(r.score * 100).toFixed(0)}%)\n${r.content}`
    ).join('\n\n')}\n--- End Knowledge ---\n`;
  }

  getStats(): { totalEntries: number; sources: string[]; updatedAt: string } {
    const sources = [...new Set(this.store.entries.map(e => String(e.metadata.source)))];
    return {
      totalEntries: this.store.entries.length,
      sources,
      updatedAt: this.store.updatedAt,
    };
  }

  clear(): void {
    this.store.entries = [];
    this.save();
  }

  removeSource(source: string): number {
    const before = this.store.entries.length;
    this.store.entries = this.store.entries.filter(e => e.metadata.source !== source);
    this.save();
    return before - this.store.entries.length;
  }
}
