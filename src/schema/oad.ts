import { z } from 'zod';

// ─── OAD Schema v1 ───────────────────────────────────────────

export const SkillRefSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

export const ChannelSchema = z.object({
  type: z.enum(['web', 'websocket', 'telegram', 'cli']),
  port: z.number().optional(),
  config: z.record(z.unknown()).optional(),
});

export const LongTermMemorySchema = z.object({
  provider: z.enum(['in-memory', 'deepbrain']).default('in-memory'),
  collection: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

export const MemorySchema = z.object({
  shortTerm: z.boolean().default(true),
  longTerm: z.union([z.boolean(), LongTermMemorySchema]).default(false),
  provider: z.string().optional(),
});

export const TrustLevel = z.enum(['sandbox', 'verified', 'certified', 'listed']);

export const DTVSchema = z.object({
  trust: z.object({
    level: TrustLevel.default('sandbox'),
  }).optional(),
  value: z.object({
    metrics: z.array(z.string()).default([]),
  }).optional(),
});

export const ProviderSchema = z.object({
  default: z.string().default('deepseek'),
  allowed: z.array(z.string()).default(['openai', 'deepseek', 'qwen']),
});

export const MarketplaceSchema = z.object({
  certified: z.boolean().default(false),
  category: z.string().optional(),
  pricing: z.enum(['free', 'freemium', 'paid', 'enterprise']).optional(),
  tags: z.array(z.string()).optional(),
});

export const MetadataSchema = z.object({
  name: z.string(),
  version: z.string().default('1.0.0'),
  description: z.string().optional(),
  author: z.string().optional(),
  license: z.string().default('Apache-2.0'),
  marketplace: MarketplaceSchema.optional(),
});

export const RoomSchema = z.object({
  name: z.string(),
  agents: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
});

export const StreamingSchema = z.object({
  enabled: z.boolean().default(false),
  chunkSize: z.number().optional(),
});

export const SpecSchema = z.object({
  provider: ProviderSchema.optional(),
  model: z.string().default('deepseek-chat'),
  systemPrompt: z.string().optional(),
  skills: z.array(SkillRefSchema).default([]),
  channels: z.array(ChannelSchema).default([]),
  memory: MemorySchema.optional(),
  dtv: DTVSchema.optional(),
  room: RoomSchema.optional(),
  streaming: z.union([z.boolean(), StreamingSchema]).default(false),
  locale: z.enum(['en', 'zh-CN']).optional(),
});

export const OADSchema = z.object({
  apiVersion: z.literal('opc/v1'),
  kind: z.literal('Agent'),
  metadata: MetadataSchema,
  spec: SpecSchema,
});

export type OADDocument = z.infer<typeof OADSchema>;
export type SkillRef = z.infer<typeof SkillRefSchema>;
export type Channel = z.infer<typeof ChannelSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
export type Spec = z.infer<typeof SpecSchema>;
export type DTVConfig = z.infer<typeof DTVSchema>;
export type TrustLevelType = z.infer<typeof TrustLevel>;
