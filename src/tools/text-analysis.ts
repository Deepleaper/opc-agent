import type { MCPTool, MCPToolResult } from './mcp';

/**
 * Text Analysis Tool — v0.8.0
 * Summarize, translate (stub), sentiment analysis as an LLM function tool.
 * Note: For production, connect to actual LLM/NLP APIs. This provides basic built-in analysis.
 */
export const TextAnalysisTool: MCPTool = {
  name: 'text_analysis',
  description: 'Analyze text: word count, character count, reading time, keyword extraction, basic sentiment, and language detection.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['stats', 'keywords', 'sentiment', 'detect_language', 'truncate', 'split_sentences'],
        description: 'Analysis operation to perform',
      },
      text: {
        type: 'string',
        description: 'Text to analyze',
      },
      maxLength: {
        type: 'number',
        description: 'Max length for truncate operation',
      },
      topN: {
        type: 'number',
        description: 'Number of top keywords to extract (default: 10)',
      },
    },
    required: ['operation', 'text'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    try {
      const op = String(input.operation);
      const text = String(input.text ?? '');

      switch (op) {
        case 'stats': {
          const words = text.split(/\s+/).filter(Boolean);
          const sentences = text.split(/[.!?。！？]+/).filter(Boolean);
          const readingTimeMin = Math.ceil(words.length / 200);
          return {
            content: JSON.stringify({
              characters: text.length,
              words: words.length,
              sentences: sentences.length,
              paragraphs: text.split(/\n\s*\n/).filter(Boolean).length,
              readingTimeMinutes: readingTimeMin,
            }, null, 2),
          };
        }

        case 'keywords': {
          const topN = Number(input.topN ?? 10);
          const words = text.toLowerCase().replace(/[^\w\s\u4e00-\u9fff]/g, '').split(/\s+/).filter(Boolean);
          const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'not', 'with', 'this', 'that', 'it', 'be', 'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'from', 'by', 'as', 'if', 'so', 'than']);
          const freq: Record<string, number> = {};
          for (const w of words) {
            if (w.length < 2 || stopWords.has(w)) continue;
            freq[w] = (freq[w] ?? 0) + 1;
          }
          const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, topN);
          return { content: JSON.stringify(sorted.map(([word, count]) => ({ word, count })), null, 2) };
        }

        case 'sentiment': {
          // Basic lexicon-based sentiment
          const positiveWords = new Set(['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'happy', 'best', 'awesome', 'perfect', 'brilliant', 'outstanding', 'superb', 'beautiful', 'nice', 'enjoy', 'like', 'positive', 'success']);
          const negativeWords = new Set(['bad', 'terrible', 'awful', 'horrible', 'hate', 'worst', 'poor', 'ugly', 'fail', 'wrong', 'sad', 'angry', 'frustrating', 'disappointing', 'negative', 'annoying', 'broken', 'useless', 'boring', 'painful']);

          const words = text.toLowerCase().split(/\s+/);
          let pos = 0, neg = 0;
          for (const w of words) {
            if (positiveWords.has(w)) pos++;
            if (negativeWords.has(w)) neg++;
          }
          const total = pos + neg || 1;
          const score = (pos - neg) / total; // -1 to 1
          const label = score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral';
          return {
            content: JSON.stringify({ score: Math.round(score * 100) / 100, label, positive: pos, negative: neg }, null, 2),
          };
        }

        case 'detect_language': {
          // Simple heuristic
          const hasChinese = /[\u4e00-\u9fff]/.test(text);
          const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff]/.test(text);
          const hasKorean = /[\uac00-\ud7af]/.test(text);
          const hasArabic = /[\u0600-\u06ff]/.test(text);
          const lang = hasChinese ? 'zh' : hasJapanese ? 'ja' : hasKorean ? 'ko' : hasArabic ? 'ar' : 'en';
          return { content: JSON.stringify({ detected: lang, confidence: 'heuristic' }) };
        }

        case 'truncate': {
          const maxLen = Number(input.maxLength ?? 100);
          const truncated = text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
          return { content: truncated };
        }

        case 'split_sentences': {
          const sentences = text.match(/[^.!?。！？]+[.!?。！？]+/g) ?? [text];
          return { content: JSON.stringify(sentences.map((s) => s.trim()), null, 2) };
        }

        default:
          return { content: `Unknown operation: ${op}`, isError: true };
      }
    } catch (err) {
      return { content: `Error: ${(err as Error).message}`, isError: true };
    }
  },
};
