import { BaseSkill } from './base';
import type { AgentContext, Message, SkillResult } from '../core/types';

export class HttpSkill extends BaseSkill {
  name = 'http';
  description = 'Make HTTP requests to external APIs. Usage: http GET|POST|PUT|DELETE <url> [body]';

  async execute(context: AgentContext, message: Message): Promise<SkillResult> {
    const text = message.content.trim();
    const match = text.match(/^http\s+(GET|POST|PUT|PATCH|DELETE)\s+(\S+)(?:\s+(.+))?$/is);
    if (!match) return this.noMatch();

    const [, method, url, bodyStr] = match;

    try {
      const opts: RequestInit = {
        method: method.toUpperCase(),
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'OPC-Agent/0.7.0' },
      };

      if (bodyStr && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        opts.body = bodyStr;
      }

      const res = await fetch(url, opts);
      const contentType = res.headers.get('content-type') ?? '';
      const body = contentType.includes('json') ? JSON.stringify(await res.json(), null, 2) : await res.text();

      const truncated = body.length > 4000 ? body.slice(0, 4000) + '\n...[truncated]' : body;
      return this.match(`HTTP ${res.status} ${res.statusText}\n\n${truncated}`);
    } catch (err) {
      return this.match(`HTTP Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
