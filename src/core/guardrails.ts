import { GuardrailConfig } from './types';

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//i,
  /format\s+[c-z]:/i,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM\s+\w+\s*;?\s*$/i,
  /:\(\)\{ :\|:& \};:/,
  /mkfs\./i,
  /dd\s+if=.*of=\/dev\//i,
];

export function checkInput(
  input: string,
  config?: GuardrailConfig
): { safe: boolean; reason?: string } {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(input)) {
      return { safe: false, reason: `Blocked dangerous pattern: ${pattern.source}` };
    }
  }
  if (config?.blockedPatterns) {
    for (const rule of config.blockedPatterns) {
      const re = rule.pattern instanceof RegExp
        ? rule.pattern
        : new RegExp(rule.pattern, 'i');
      if (re.test(input)) {
        return { safe: false, reason: rule.message ?? `Blocked by rule: ${rule.name}` };
      }
    }
  }
  return { safe: true };
}

export function filterOutput(output: string, config?: GuardrailConfig): string {
  let filtered = output;
  filtered = filtered.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]');
  filtered = filtered.replace(/\b1[3-9]\d{9}\b/g, '[PHONE]');
  if (config?.outputFilters) {
    for (const f of config.outputFilters) {
      const result = f.fn(filtered);
      if (result !== null) filtered = result;
    }
  }
  return filtered;
}

export class Guardrails {
  constructor(private config: GuardrailConfig) {}

  checkInput(input: string): { safe: boolean; reason?: string } {
    if (this.config.maxInputLength && input.length > this.config.maxInputLength) {
      return { safe: false, reason: 'input_too_long' };
    }
    return checkInput(input, this.config);
  }

  filterOutput(output: string): string {
    return filterOutput(output, this.config);
  }
}
