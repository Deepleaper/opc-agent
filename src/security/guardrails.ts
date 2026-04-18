/**
 * Guardrails Module - v2.1.0
 * Input/output guardrails for LLM safety: PII, toxicity, injection, compliance.
 */

// ── Types ───────────────────────────────────────────────────

export interface GuardrailConfig {
  input?: GuardrailRule[];
  output?: GuardrailRule[];
}

export interface GuardrailRule {
  name: string;
  type: 'regex' | 'keyword' | 'llm' | 'custom';
  action: 'block' | 'warn' | 'redact' | 'log';
  config?: Record<string, any>;
}

export interface GuardrailResult {
  passed: boolean;
  blocked: boolean;
  warned: boolean;
  redacted: boolean;
  message?: string;
  redactedText?: string;
  violations: GuardrailViolation[];
}

export interface GuardrailViolation {
  rule: string;
  action: string;
  detail: string;
}

// ── Built-in Patterns ───────────────────────────────────────

const PII_PATTERNS: Record<string, RegExp> = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?above\s+instructions/i,
  /system\s*prompt\s*:/i,
  /you\s+are\s+now\s+(?:a|an|the)\s+/i,
  /act\s+as\s+(?:a|an)\s+/i,
  /pretend\s+(?:you(?:'re|\s+are)\s+)?/i,
  /new\s+instruction[s]?\s*:/i,
  /override\s+(?:your\s+)?(?:instructions|rules|guidelines)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
];

const TOXICITY_KEYWORDS = [
  'kill yourself', 'kys', 'go die', 'hate you',
  'stupid idiot', 'worthless', 'piece of shit',
];

const COMPLIANCE_PATTERNS = [
  { pattern: /(?:you\s+should\s+)?(?:buy|sell|invest\s+in)\s+(?:stocks?|crypto|bitcoin)/i, label: 'financial advice' },
  { pattern: /(?:you\s+(?:have|probably\s+have)|diagnos(?:e|is))\s+(?:\w+\s+){0,3}(?:disease|syndrome|disorder|cancer)/i, label: 'medical diagnosis' },
  { pattern: /(?:legal(?:ly)?|sue|lawsuit|court)\s+(?:you\s+should|advice)/i, label: 'legal advice' },
];

// ── Rule Executors ──────────────────────────────────────────

function checkPII(text: string, action: string): { violations: GuardrailViolation[]; redactedText: string } {
  const violations: GuardrailViolation[] = [];
  let redacted = text;
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    const cloned = new RegExp(pattern.source, pattern.flags);
    const matches = text.match(cloned);
    if (matches) {
      violations.push({ rule: 'pii-detector', action, detail: `Found ${type}: ${matches.length} match(es)` });
      redacted = redacted.replace(cloned, '[REDACTED]');
    }
  }
  return { violations, redactedText: redacted };
}

function checkInjection(text: string): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      violations.push({ rule: 'prompt-injection', action: 'block', detail: `Matched pattern: ${pattern.source}` });
      break; // one is enough
    }
  }
  return violations;
}

function checkToxicity(text: string, extraKeywords?: string[]): GuardrailViolation[] {
  const lower = text.toLowerCase();
  const keywords = [...TOXICITY_KEYWORDS, ...(extraKeywords ?? [])];
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) {
      return [{ rule: 'toxicity', action: 'block', detail: `Matched keyword: "${kw}"` }];
    }
  }
  return [];
}

function checkTopicRestriction(text: string, config?: Record<string, any>): GuardrailViolation[] {
  const denyTopics: string[] = config?.denyTopics ?? [];
  const lower = text.toLowerCase();
  for (const topic of denyTopics) {
    if (lower.includes(topic.toLowerCase())) {
      return [{ rule: 'topic-restrictor', action: 'block', detail: `Blocked topic: "${topic}"` }];
    }
  }
  return [];
}

function checkLength(text: string, config?: Record<string, any>): GuardrailViolation[] {
  const maxChars = config?.maxChars ?? 10000;
  if (text.length > maxChars) {
    return [{ rule: 'length-limit', action: 'warn', detail: `Response length ${text.length} exceeds max ${maxChars}` }];
  }
  return [];
}

function checkLanguage(text: string, config?: Record<string, any>): GuardrailViolation[] {
  const allowed: string[] = config?.allowedLanguages ?? [];
  if (allowed.length === 0) return [];
  // Simple heuristic: check if text contains CJK characters
  const hasCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text);
  const hasLatin = /[a-zA-Z]{3,}/.test(text);
  if (allowed.includes('en') && !allowed.includes('zh') && hasCJK && !hasLatin) {
    return [{ rule: 'language-filter', action: 'block', detail: 'Non-allowed language detected' }];
  }
  if (allowed.includes('zh') && !allowed.includes('en') && hasLatin && !hasCJK) {
    return [{ rule: 'language-filter', action: 'block', detail: 'Non-allowed language detected' }];
  }
  return [];
}

function checkCompliance(text: string): GuardrailViolation[] {
  for (const { pattern, label } of COMPLIANCE_PATTERNS) {
    if (pattern.test(text)) {
      return [{ rule: 'compliance-filter', action: 'block', detail: `Potential ${label} detected` }];
    }
  }
  return [];
}

// ── Guardrail Manager ───────────────────────────────────────

export class GuardrailManager {
  private config: GuardrailConfig;

  constructor(config: GuardrailConfig) {
    this.config = config;
  }

  async checkInput(message: string): Promise<GuardrailResult> {
    return this.runRules(message, this.config.input ?? []);
  }

  async checkOutput(response: string): Promise<GuardrailResult> {
    return this.runRules(response, this.config.output ?? []);
  }

  private async runRules(text: string, rules: GuardrailRule[]): Promise<GuardrailResult> {
    const allViolations: GuardrailViolation[] = [];
    let blocked = false;
    let warned = false;
    let redacted = false;
    let redactedText = text;
    let blockMessage = '';

    for (const rule of rules) {
      let violations: GuardrailViolation[] = [];

      switch (rule.name) {
        case 'pii-detector': {
          const result = checkPII(text, rule.action);
          violations = result.violations;
          if (violations.length > 0 && rule.action === 'redact') {
            redacted = true;
            redactedText = result.redactedText;
          }
          break;
        }
        case 'prompt-injection':
          violations = checkInjection(text);
          break;
        case 'toxicity':
          violations = checkToxicity(text, rule.config?.keywords);
          break;
        case 'topic-restrictor':
          violations = checkTopicRestriction(text, rule.config);
          break;
        case 'length-limit':
          violations = checkLength(text, rule.config);
          break;
        case 'language-filter':
          violations = checkLanguage(text, rule.config);
          break;
        case 'compliance-filter':
          violations = checkCompliance(text);
          break;
        default:
          // Unknown rule — skip
          break;
      }

      if (violations.length > 0) {
        // Override action from rule config
        violations = violations.map(v => ({ ...v, action: rule.action }));
        allViolations.push(...violations);

        if (rule.action === 'block') {
          blocked = true;
          blockMessage = `Message blocked by ${rule.name}: ${violations[0].detail}`;
        } else if (rule.action === 'warn') {
          warned = true;
        }
      }
    }

    return {
      passed: allViolations.length === 0,
      blocked,
      warned,
      redacted,
      message: blocked ? blockMessage : undefined,
      redactedText: redacted ? redactedText : undefined,
      violations: allViolations,
    };
  }
}

// ── Factory from OAD config ─────────────────────────────────

export function createGuardrailsFromConfig(config: {
  input?: Array<{ name: string; type: string; action: string; config?: any }>;
  output?: Array<{ name: string; type: string; action: string; config?: any }>;
}): GuardrailManager {
  return new GuardrailManager({
    input: config.input as GuardrailRule[],
    output: config.output as GuardrailRule[],
  });
}
