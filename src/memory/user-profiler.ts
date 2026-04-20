import type { Message } from '../core/types';

export interface UserProfile {
  preferences: Record<string, string>;
  communication_style: string;
  expertise_areas: string[];
  common_requests: string[];
  last_updated: number;
}

const EMPTY_PROFILE: UserProfile = {
  preferences: {},
  communication_style: 'unknown',
  expertise_areas: [],
  common_requests: [],
  last_updated: 0,
};

/**
 * DeepBrain-powered user profiling from conversation signals.
 */
export class UserProfiler {
  private observationCount = 0;
  private signals = {
    languages: new Map<string, number>(),
    techKeywords: new Set<string>(),
    styleSignals: { brief: 0, detailed: 0, formal: 0, casual: 0 },
    requestTypes: new Map<string, number>(),
  };

  private readonly LEARN_INTERVAL = 20;

  /**
   * Detect language mix of a text.
   */
  private detectLanguage(text: string): string {
    let cn = 0, en = 0;
    for (const char of text) {
      const code = char.codePointAt(0) ?? 0;
      if (code >= 0x4e00 && code <= 0x9fff) cn++;
      else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) en++;
    }
    if (cn > 0 && en > 0) return 'mixed';
    if (cn > en) return 'chinese';
    return 'english';
  }

  /**
   * Detect technical level from content.
   */
  private detectTechLevel(text: string): string {
    const expertTerms = /\b(kubernetes|k8s|microservice|architecture|distributed|consensus|raft|paxos|sharding|vector db|embedding|fine-?tun|transformer|CUDA|inference|quantiz|LoRA|RAG)\b/i;
    const intermediateTerms = /\b(API|REST|GraphQL|Docker|CI\/CD|database|deploy|cloud|React|TypeScript|Python|async|cache|redis|nginx)\b/i;

    if (expertTerms.test(text)) return 'expert';
    if (intermediateTerms.test(text)) return 'intermediate';
    return 'beginner';
  }

  /**
   * Detect communication style.
   */
  private detectStyle(text: string): void {
    if (text.length < 50) this.signals.styleSignals.brief++;
    else if (text.length > 300) this.signals.styleSignals.detailed++;

    if (/\b(please|kindly|would you|could you|请问|烦请|麻烦)\b/i.test(text)) {
      this.signals.styleSignals.formal++;
    }
    if (/[!]{2,}|lol|haha|😂|🤣|哈哈|牛|666|👍/i.test(text)) {
      this.signals.styleSignals.casual++;
    }
  }

  /**
   * Extract domain keywords.
   */
  private extractDomainKeywords(text: string): void {
    const techWords = text.match(/\b[A-Z][a-zA-Z]{2,}(?:\.js|\.ts|\.py)?\b/g) ?? [];
    techWords.forEach(w => this.signals.techKeywords.add(w));
    // Chinese tech terms
    const cnTerms = text.match(/(?:人工智能|机器学习|深度学习|大模型|微服务|架构|部署|运维|前端|后端|数据库|缓存|分布式)/g) ?? [];
    cnTerms.forEach(w => this.signals.techKeywords.add(w));
  }

  /**
   * Classify request type.
   */
  private classifyRequest(text: string): string {
    if (/\b(how to|怎么|如何|how do)\b/i.test(text)) return 'how-to';
    if (/\b(why|为什么|原因)\b/i.test(text)) return 'explanation';
    if (/\b(fix|error|bug|报错|出错|failed)\b/i.test(text)) return 'debugging';
    if (/\b(review|评审|看看|check)\b/i.test(text)) return 'review';
    if (/\b(create|build|write|写|创建|生成)\b/i.test(text)) return 'creation';
    return 'general';
  }

  /**
   * Observe a user message and accumulate profile signals.
   */
  async observe(message: Message, brain?: any): Promise<void> {
    if (message.role !== 'user') return;

    const text = message.content;

    // Language
    const lang = this.detectLanguage(text);
    this.signals.languages.set(lang, (this.signals.languages.get(lang) ?? 0) + 1);

    // Style
    this.detectStyle(text);

    // Domain keywords
    this.extractDomainKeywords(text);

    // Request type
    const reqType = this.classifyRequest(text);
    this.signals.requestTypes.set(reqType, (this.signals.requestTypes.get(reqType) ?? 0) + 1);

    this.observationCount++;

    // Periodically persist to brain
    if (brain?.learn && this.observationCount % this.LEARN_INTERVAL === 0) {
      const profile = this.buildProfileFromSignals();
      try {
        await brain.learn(JSON.stringify(profile), { insight_type: 'user_profile' });
      } catch { /* non-critical */ }
    }
  }

  private buildProfileFromSignals(): UserProfile {
    // Language preference
    let topLang = 'english';
    let maxCount = 0;
    for (const [lang, count] of this.signals.languages) {
      if (count > maxCount) { topLang = lang; maxCount = count; }
    }

    // Communication style
    const ss = this.signals.styleSignals;
    const styles = [
      ['brief', ss.brief], ['detailed', ss.detailed],
      ['formal', ss.formal], ['casual', ss.casual],
    ] as const;
    const topStyle = styles.reduce((a, b) => (b[1] > a[1] ? b : a))[0];

    // Top request types
    const topRequests = [...this.signals.requestTypes.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);

    return {
      preferences: { language: topLang },
      communication_style: topStyle,
      expertise_areas: [...this.signals.techKeywords].slice(0, 20),
      common_requests: topRequests,
      last_updated: Date.now(),
    };
  }

  /**
   * Get user profile, optionally from brain recall.
   */
  async getProfile(brain?: any): Promise<UserProfile> {
    // First try local signals
    if (this.observationCount > 0) {
      return this.buildProfileFromSignals();
    }

    // Fallback to brain recall
    if (brain?.recall) {
      try {
        const results = await brain.recall('user profile preferences style');
        if (Array.isArray(results) && results.length > 0) {
          const raw = typeof results[0] === 'string' ? results[0] : results[0].content;
          return { ...EMPTY_PROFILE, ...JSON.parse(raw) };
        }
      } catch { /* ignore parse errors */ }
    }

    return { ...EMPTY_PROFILE };
  }

  /**
   * Enhance a system prompt with user profile context.
   */
  enhance(systemPrompt: string, profile: UserProfile): string {
    const hints: string[] = [];

    if (profile.preferences.language) {
      const langMap: Record<string, string> = {
        chinese: 'User prefers Chinese responses.',
        english: 'User prefers English responses.',
        mixed: 'User uses mixed Chinese/English. Match their style.',
      };
      if (langMap[profile.preferences.language]) hints.push(langMap[profile.preferences.language]);
    }

    if (profile.communication_style && profile.communication_style !== 'unknown') {
      hints.push(`User communication style: ${profile.communication_style}.`);
    }

    if (profile.expertise_areas.length > 0) {
      hints.push(`User expertise: ${profile.expertise_areas.slice(0, 10).join(', ')}.`);
    }

    if (profile.common_requests.length > 0) {
      hints.push(`Common request types: ${profile.common_requests.join(', ')}.`);
    }

    if (hints.length === 0) return systemPrompt;
    return `${systemPrompt}\n\n[User Profile] ${hints.join(' ')}`;
  }

  /**
   * Generate USER.md content from the current profile.
   */
  toMarkdown(profile: UserProfile): string {
    const lines = [
      '# USER.md - Auto-generated User Profile',
      '',
      '> This file is automatically updated by OPC Agent based on conversation patterns.',
      '> You can edit it manually to override any auto-detected preferences.',
      '',
    ];

    if (profile.preferences.language) {
      lines.push(`## Language Preference`);
      lines.push(profile.preferences.language === 'chinese' ? '中文为主' : profile.preferences.language === 'mixed' ? '中英混合' : 'English');
      lines.push('');
    }

    if (profile.communication_style !== 'unknown') {
      lines.push(`## Communication Style`);
      lines.push(profile.communication_style);
      lines.push('');
    }

    if (profile.expertise_areas.length > 0) {
      lines.push(`## Expertise Areas`);
      for (const area of profile.expertise_areas) {
        lines.push(`- ${area}`);
      }
      lines.push('');
    }

    if (profile.common_requests.length > 0) {
      lines.push(`## Common Request Types`);
      for (const req of profile.common_requests) {
        lines.push(`- ${req}`);
      }
      lines.push('');
    }

    lines.push(`## Metadata`);
    lines.push(`- Last Updated: ${new Date(profile.last_updated).toISOString()}`);
    lines.push(`- Observations: ${this.observationCount}`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Save USER.md to the given directory.
   */
  async saveUserMd(dir: string, profile?: UserProfile): Promise<void> {
    const p = profile ?? (this.observationCount > 0 ? this.buildProfileFromSignals() : null);
    if (!p || p.last_updated === 0) return;
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(dir, 'USER.md');
    // Only write if we have meaningful data
    if (p.communication_style === 'unknown' && p.expertise_areas.length === 0) return;
    fs.writeFileSync(filePath, this.toMarkdown(p), 'utf-8');
  }
}
