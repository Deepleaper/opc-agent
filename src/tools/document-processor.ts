/**
 * Document Processor - Parse and chunk documents for knowledge learning
 * Supports: PDF, TXT, MD, DOCX, CSV, JSON
 */

export interface DocumentChunk {
  title: string;
  content: string;
  metadata: {
    source: string;
    format: string;
    chunkIndex: number;
    totalChunks?: number;
    page?: number;
  };
}

export interface ProcessedDocument {
  id: string;
  filename: string;
  format: string;
  size: number;
  chunks: DocumentChunk[];
  processedAt: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const CHUNK_TARGET_CHARS = 2000; // ~500 tokens
const CHUNK_MAX_CHARS = 4000; // ~1000 tokens

export class DocumentProcessor {
  /**
   * Process a file buffer into chunks
   */
  async process(buffer: Buffer, filename: string): Promise<ProcessedDocument> {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB (max 50MB)`);
    }

    const ext = filename.split('.').pop()?.toLowerCase() || '';
    let rawText: string;

    switch (ext) {
      case 'pdf':
        rawText = await this.parsePDF(buffer);
        break;
      case 'docx':
        rawText = await this.parseDOCX(buffer);
        break;
      case 'csv':
        rawText = this.parseCSV(buffer.toString('utf-8'));
        break;
      case 'json':
        rawText = this.parseJSON(buffer.toString('utf-8'));
        break;
      case 'txt':
      case 'md':
      case 'markdown':
        rawText = buffer.toString('utf-8');
        break;
      default:
        // Try as plain text
        rawText = buffer.toString('utf-8');
    }

    const chunks = this.chunkText(rawText, filename, ext);

    return {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      filename,
      format: ext,
      size: buffer.length,
      chunks,
      processedAt: new Date().toISOString(),
    };
  }

  private async parsePDF(buffer: Buffer): Promise<string> {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (e: any) {
      throw new Error(`PDF parse failed: ${e.message}`);
    }
  }

  private async parseDOCX(buffer: Buffer): Promise<string> {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (e: any) {
      throw new Error(`DOCX parse failed: ${e.message}`);
    }
  }

  private parseCSV(text: string): string {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length === 0) return '';

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1);

    // Convert CSV to readable text
    return rows.map((row, i) => {
      const values = this.parseCSVLine(row);
      const pairs = headers.map((h, j) => `${h}: ${values[j] || ''}`);
      return `Record ${i + 1}:\n${pairs.join('\n')}`;
    }).join('\n\n');
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  }

  private parseJSON(text: string): string {
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        return data.map((item, i) => `Item ${i + 1}:\n${JSON.stringify(item, null, 2)}`).join('\n\n');
      }
      return JSON.stringify(data, null, 2);
    } catch {
      return text;
    }
  }

  /**
   * Smart chunking: split by headings/paragraphs, respecting size limits
   */
  private chunkText(text: string, filename: string, format: string): DocumentChunk[] {
    if (!text.trim()) return [];

    // Split by markdown headings or double newlines
    const sections = text.split(/\n(?=#{1,3}\s)|(?:\n\s*\n)/).filter(s => s.trim());
    const chunks: DocumentChunk[] = [];
    let currentChunk = '';
    let currentTitle = filename;

    for (const section of sections) {
      const headingMatch = section.match(/^(#{1,3})\s+(.+)/);
      if (headingMatch) {
        currentTitle = headingMatch[2].trim();
      }

      if (currentChunk.length + section.length > CHUNK_MAX_CHARS && currentChunk.length > 0) {
        chunks.push({
          title: currentTitle,
          content: currentChunk.trim(),
          metadata: { source: filename, format, chunkIndex: chunks.length },
        });
        currentChunk = '';
      }

      currentChunk += section + '\n\n';

      if (currentChunk.length >= CHUNK_TARGET_CHARS) {
        chunks.push({
          title: currentTitle,
          content: currentChunk.trim(),
          metadata: { source: filename, format, chunkIndex: chunks.length },
        });
        currentChunk = '';
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        title: currentTitle,
        content: currentChunk.trim(),
        metadata: { source: filename, format, chunkIndex: chunks.length },
      });
    }

    // If we got no chunks from section splitting (e.g. dense text), force-split
    if (chunks.length === 0 && text.trim()) {
      const words = text.split(/\s+/);
      let buf = '';
      for (const w of words) {
        if (buf.length + w.length + 1 > CHUNK_MAX_CHARS && buf) {
          chunks.push({
            title: filename,
            content: buf.trim(),
            metadata: { source: filename, format, chunkIndex: chunks.length },
          });
          buf = '';
        }
        buf += w + ' ';
      }
      if (buf.trim()) {
        chunks.push({
          title: filename,
          content: buf.trim(),
          metadata: { source: filename, format, chunkIndex: chunks.length },
        });
      }
    }

    // Set totalChunks
    for (const c of chunks) c.metadata.totalChunks = chunks.length;
    return chunks;
  }
}
