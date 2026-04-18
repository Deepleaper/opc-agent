import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export type RefType = 'file' | 'folder' | 'url' | 'git-diff' | 'git-log';

export interface ContextRef {
  type: RefType;
  path: string;
  content?: string;
}

export interface Message {
  role: string;
  content: string;
  [key: string]: unknown;
}

const MAX_CONTENT_LENGTH = 5000;

function truncate(text: string, max: number = MAX_CONTENT_LENGTH): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n...[truncated, ${text.length - max} chars omitted]`;
}

export class ContextRefResolver {
  /**
   * Parse @-references from text without resolving content.
   */
  parseRefs(text: string): ContextRef[] {
    const refs: ContextRef[] = [];
    const patterns: [RegExp, RefType, (m: RegExpMatchArray) => string][] = [
      [/@file:(\S+)/g, 'file', (m) => m[1]],
      [/@folder:(\S+)/g, 'folder', (m) => m[1]],
      [/@url:(https?:\/\/\S+)/g, 'url', (m) => m[1]],
      [/@git-diff\b/g, 'git-diff', () => 'git-diff'],
      [/@git-log:(\d+)/g, 'git-log', (m) => m[1]],
      [/@git-log\b(?!:)/g, 'git-log', () => '10'],
    ];

    for (const [regex, type, extract] of patterns) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        refs.push({ type, path: extract(match) });
      }
    }
    return refs;
  }

  /**
   * Resolve content for each ref. Returns new array with content filled in.
   */
  async resolveRefs(refs: ContextRef[]): Promise<ContextRef[]> {
    return Promise.all(refs.map(async (ref) => {
      try {
        const content = await this.resolveOne(ref);
        return { ...ref, content: truncate(content) };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ...ref, content: `[Error resolving @${ref.type}:${ref.path}]: ${msg}` };
      }
    }));
  }

  private async resolveOne(ref: ContextRef): Promise<string> {
    switch (ref.type) {
      case 'file':
        return fs.readFileSync(ref.path, 'utf-8');
      case 'folder':
        return this.listDir(ref.path);
      case 'url':
        return await this.fetchUrl(ref.path);
      case 'git-diff':
        return execSync('git diff', { encoding: 'utf-8', timeout: 10000 });
      case 'git-log': {
        const n = parseInt(ref.path) || 10;
        return execSync(`git log --oneline -${n}`, { encoding: 'utf-8', timeout: 10000 });
      }
      default:
        return `[Unknown ref type: ${ref.type}]`;
    }
  }

  private listDir(dirPath: string, prefix: string = '', depth: number = 0): string {
    if (depth > 5) return prefix + '...(max depth)\n';
    if (!fs.existsSync(dirPath)) throw new Error(`Directory not found: ${dirPath}`);
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    let result = '';
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      result += `${prefix}${entry.isDirectory() ? '📁 ' : '📄 '}${entry.name}\n`;
      if (entry.isDirectory()) {
        result += this.listDir(path.join(dirPath, entry.name), prefix + '  ', depth + 1);
      }
    }
    return result;
  }

  private async fetchUrl(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const text = await res.text();
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Inject resolved refs as system messages before the user's last message.
   */
  injectRefs(messages: Message[], refs: ContextRef[]): Message[] {
    if (refs.length === 0) return messages;

    const resolvedRefs = refs.filter(r => r.content);
    if (resolvedRefs.length === 0) return messages;

    const contextMessages: Message[] = resolvedRefs.map(ref => ({
      role: 'system',
      content: `[Context from @${ref.type}:${ref.path}]\n\`\`\`\n${ref.content}\n\`\`\``,
    }));

    // Insert before the last user message
    const result = [...messages];
    let lastUserIdx = -1;
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i].role === 'user') { lastUserIdx = i; break; }
    }

    if (lastUserIdx >= 0) {
      result.splice(lastUserIdx, 0, ...contextMessages);
    } else {
      result.push(...contextMessages);
    }

    return result;
  }
}
