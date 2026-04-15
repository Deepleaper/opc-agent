import { BaseSkill } from '../skills/base';
import type { AgentContext, Message, SkillResult } from '../core/types';


export class BlogWriterSkill extends BaseSkill {
  name = 'blog-writer';
  description = 'Help write blog posts with SEO optimization';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('blog') || lower.includes('article') || lower.includes('post')) {
      return this.match(
        'I can help write blog posts! Please share the topic, target audience, and any keywords you\'d like to include for SEO.',
        0.8,
      );
    }
    return this.noMatch();
  }
}

export class SocialMediaSkill extends BaseSkill {
  name = 'social-media';
  description = 'Create social media content';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('social') || lower.includes('tweet') || lower.includes('linkedin')) {
      return this.match(
        'I can create social media content! Tell me the platform (Twitter/LinkedIn/etc.), topic, and tone you prefer.',
        0.8,
      );
    }
    return this.noMatch();
  }
}

export function createContentWriterConfig() {
  return {
    apiVersion: 'opc/v1',
    kind: 'Agent',
    metadata: {
      name: 'content-writer',
      version: '1.0.0',
      description: 'Content Writer — blog posts, social media, SEO optimization',
      author: 'Deepleaper',
      license: 'Apache-2.0',
    },
    spec: {
      model: 'deepseek-chat',
      systemPrompt: 'You are a content writing assistant. Help create blog posts, social media content, and optimize for SEO. Be creative, engaging, and audience-aware.',
      skills: [
        { name: 'blog-writer', description: 'Write blog posts' },
        { name: 'social-media', description: 'Create social media content' },
      ],
      channels: [{ type: 'web', port: 3000 }],
    },
  };
}
