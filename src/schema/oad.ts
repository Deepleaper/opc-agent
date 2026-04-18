import { z } from 'zod';

// ─── OAD Schema v1 ───────────────────────────────────────────

export const SkillRefSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

export const WorkflowStepSchema: z.ZodType<any> = z.lazy(() => z.object({
  id: z.string(),
  type: z.enum(['skill', 'tool', 'agent', 'condition', 'parallel']),
  name: z.string(),
  config: z.record(z.unknown()).optional(),
  condition: z.string().optional(),
  branches: z.object({ if: z.array(WorkflowStepSchema), else: z.array(WorkflowStepSchema).optional() }).optional(),
  parallel: z.array(WorkflowStepSchema).optional(),
  timeout: z.number().optional(),
  retries: z.number().optional(),
}));

export const WorkflowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.string().optional(),
  steps: z.array(WorkflowStepSchema).default([]),
  onError: z.enum(['stop', 'skip', 'retry']).optional(),
});

export const VoiceSchema = z.object({
  enabled: z.boolean().default(false),
  sttProvider: z.string().optional(),
  ttsProvider: z.string().optional(),
  language: z.string().optional(),
});

export const WebhookSchema = z.object({
  path: z.string().optional(),
  secret: z.string().optional(),
  retryAttempts: z.number().optional(),
});

export const HITLSchema = z.object({
  enabled: z.boolean().default(false),
  requireApproval: z.array(z.string()).default([]),
  defaultTimeoutMs: z.number().default(60000),
  defaultAction: z.enum(['approve', 'deny']).default('deny'),
});

export const PluginRefSchema = z.object({
  name: z.string(),
  config: z.record(z.unknown()).optional(),
});

export const AuthSchema = z.object({
  enabled: z.boolean().default(false),
  apiKeys: z.array(z.string()).default([]),
  sessionIsolation: z.boolean().default(true),
});

export const ChannelSchema = z.object({
  type: z.enum(['web', 'websocket', 'telegram', 'cli', 'voice', 'webhook', 'wechat', 'feishu', 'email', 'slack', 'discord']),
  port: z.number().optional(),
  config: z.record(z.unknown()).optional(),
});

export const LongTermMemorySchema = z.object({
  provider: z.enum(['in-memory', 'deepbrain']).default('in-memory'),
  collection: z.string().optional(),
  config: z.object({
    database: z.string().optional(),
    embeddingProvider: z.string().optional(),
    autoLearn: z.boolean().optional(),
    autoRecall: z.boolean().optional(),
    evolveInterval: z.number().optional(),
  }).passthrough().optional(),
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

export const MCPServerSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
});

export const MCPServeSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(['stdio', 'http']).default('stdio'),
  port: z.number().default(3002),
  exposedTools: z.array(z.string()).optional(),
});

export const ToolsSchema = z.object({
  builtin: z.array(z.string()).optional(),
  mcp: z.array(MCPServerSchema).optional(),
});

export const TelemetrySchema = z.object({
  enabled: z.boolean().default(false),
  exporter: z.enum(['console', 'file', 'otlp']).default('console'),
  endpoint: z.string().optional(),
  filePath: z.string().optional(),
  maxSpans: z.number().optional(),
});

export const AGUIProtocolSchema = z.object({
  enabled: z.boolean().default(false),
  path: z.string().default('/agui'),
});

export const ProtocolsSchema = z.object({
  a2a: z.object({
    enabled: z.boolean().default(false),
    port: z.number().optional(),
  }).optional(),
  agui: AGUIProtocolSchema.optional(),
  mcp: MCPServeSchema.optional(),
});

export const GuardrailRuleSchema = z.object({
  name: z.string(),
  type: z.enum(['regex', 'keyword', 'llm', 'custom']),
  action: z.enum(['block', 'warn', 'redact', 'log']),
  config: z.record(z.any()).optional(),
});

export const GuardrailsSchema = z.object({
  input: z.array(GuardrailRuleSchema).optional(),
  output: z.array(GuardrailRuleSchema).optional(),
});

export const SpecSchema = z.object({
  provider: ProviderSchema.optional(),
  model: z.string().default('deepseek-chat'),
  systemPrompt: z.string().optional(),
  skills: z.array(SkillRefSchema).default([]),
  channels: z.array(ChannelSchema).default([]),
  memory: MemorySchema.optional(),
  tools: ToolsSchema.optional(),
  dtv: DTVSchema.optional(),
  room: RoomSchema.optional(),
  streaming: z.union([z.boolean(), StreamingSchema]).default(false),
  locale: z.enum(['en', 'zh-CN']).optional(),
  workflows: z.array(WorkflowSchema).optional(),
  voice: VoiceSchema.optional(),
  webhook: WebhookSchema.optional(),
  hitl: HITLSchema.optional(),
  auth: AuthSchema.optional(),
  telemetry: TelemetrySchema.optional(),
  protocols: ProtocolsSchema.optional(),
  plugins: z.array(PluginRefSchema).optional(),
  guardrails: GuardrailsSchema.optional(),
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
export type TrustLevelType = string;
