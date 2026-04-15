import { BaseSkill } from './base';
import type { AgentContext, Message, SkillResult } from '../core/types';

export interface WebhookTarget {
  name: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  secret?: string;
}

export class WebhookTriggerSkill extends BaseSkill {
  name = 'webhook-trigger';
  description = 'Trigger external webhooks. Usage: webhook <name> [payload JSON]';
  private targets: Map<string, WebhookTarget> = new Map();

  registerTarget(target: WebhookTarget): void {
    this.targets.set(target.name, target);
  }

  async execute(context: AgentContext, message: Message): Promise<SkillResult> {
    const match = message.content.trim().match(/^webhook\s+(\S+)(?:\s+(.+))?$/is);
    if (!match) return this.noMatch();

    const [, name, payloadStr] = match;
    const target = this.targets.get(name);
    if (!target) {
      const available = Array.from(this.targets.keys()).join(', ') || 'none';
      return this.match(`Unknown webhook "${name}". Available: ${available}`);
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'OPC-Agent/0.7.0',
        ...target.headers,
      };
      if (target.secret) {
        headers['X-Webhook-Secret'] = target.secret;
      }

      const body = payloadStr ?? JSON.stringify({
        agent: context.agentName,
        timestamp: Date.now(),
        trigger: 'manual',
      });

      const res = await fetch(target.url, {
        method: target.method ?? 'POST',
        headers,
        body,
      });

      return this.match(`Webhook "${name}" triggered → ${res.status} ${res.statusText}`);
    } catch (err) {
      return this.match(`Webhook error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
