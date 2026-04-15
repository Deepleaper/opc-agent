import { BaseSkill } from './base';
import type { AgentContext, Message, SkillResult } from '../core/types';
import { KnowledgeBase } from '../core/knowledge';

export interface DocumentChunk {
  content: string;
  metadata: {
    filename: string;
    mimeType: string;
    chunkIndex: number;
    totalChunks: number;
  };
}

export class DocumentSkill extends BaseSkill {
  name = 'document';
  description = 'Process uploaded documents (PDF, TXT, MD, DOCX). Chunks content and adds to knowledge base.';
  private knowledgeBase: KnowledgeBase;

  constructor(kbPath: string = '.') {
    super();
    this.knowledgeBase = new KnowledgeBase(kbPath);
  }

  async execute(context: AgentContext, message: Message): Promise<SkillResult> {
    // Check if message has document attachment metadata
    const meta = message.metadata;
    if (!meta?.document) return this.noMatch();

    const { content, filename, mimeType } = meta.document as {
      content: string; filename: string; mimeType: string;
    };

    try {
      const text = this.extractText(content, mimeType ?? this.guessMime(filename));
      const chunks = this.chunk(text, 1000, 100);

      const result = await this.knowledgeBase.addText(
        chunks.map(c => c.content).join('\n\n---\n\n'),
        filename
      );

      return this.match(
        `📄 Processed "${filename}": ${chunks.length} chunks, ${text.length} chars → added to knowledge base (${result.chunks} KB entries)`
      );
    } catch (err) {
      return this.match(`Document processing error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  extractText(content: string, mimeType: string): string {
    // For plain text formats, content is already text
    if (mimeType.includes('text/') || mimeType.includes('markdown')) {
      return content;
    }
    // For other formats, assume base64-encoded or pre-extracted text
    // In a real implementation, you'd use pdf-parse, mammoth, etc.
    return content;
  }

  chunk(text: string, size: number = 1000, overlap: number = 100): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + size, text.length);
      chunks.push({
        content: text.slice(start, end),
        metadata: {
          filename: '',
          mimeType: '',
          chunkIndex: chunks.length,
          totalChunks: 0, // filled after
        },
      });
      start = end - overlap;
      if (start >= text.length) break;
    }
    // Fill totalChunks
    for (const c of chunks) c.metadata.totalChunks = chunks.length;
    return chunks;
  }

  private guessMime(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'txt': return 'text/plain';
      case 'md': return 'text/markdown';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      default: return 'text/plain';
    }
  }

  /** Process raw text content directly (for API uploads) */
  async processText(content: string, filename: string): Promise<{ chunks: number; chars: number }> {
    const chunks = this.chunk(content);
    const result = await this.knowledgeBase.addText(content, filename);
    return { chunks: chunks.length, chars: content.length };
  }
}
