// L4 desensitization — strip PII and sensitive data before upward knowledge flow
import type { EvolutionConfig, DesensitizeResult } from '../core/types';

const PHONE_REGEX = /1[3-9]\d{9}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const MONEY_REGEX = /\d+(?:\.\d+)?\s*(?:万|亿|元|美元|USD|RMB)/g;

export async function desensitize(
  content: string,
  _config: EvolutionConfig
): Promise<DesensitizeResult> {
  let result = content;
  const removed: string[] = [];

  result = result.replace(PHONE_REGEX, m => { removed.push(m); return '[手机号]'; });
  result = result.replace(EMAIL_REGEX, m => { removed.push(m); return '[邮箱]'; });
  result = result.replace(MONEY_REGEX, m => { removed.push(m); return '[金额]'; });

  return {
    original: content,
    desensitized: result,
    removedEntities: removed,
  };
}

export async function scanForPII(text: string): Promise<{ hasPII: boolean; types: string[] }> {
  const types: string[] = [];
  if (/1[3-9]\d{9}/.test(text)) types.push('phone');
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) types.push('email');
  if (/\d+(?:\.\d+)?\s*(?:万|亿|元|美元|USD|RMB)/.test(text)) types.push('money');
  return { hasPII: types.length > 0, types };
}
