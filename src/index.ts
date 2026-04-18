// OPC Agent — Open Agent Framework
export { BaseAgent } from './core/agent';
export { AgentRuntime, truncateOutput } from './core/runtime';
export { Logger } from './core/logger';
export { loadOAD, validateOAD } from './core/config';
export { OADSchema } from './schema/oad';
export type { OADDocument, Metadata, Spec } from './schema/oad';
export type { IAgent, IChannel, ISkill, Message, AgentContext, SkillResult, MemoryStore, AgentState } from './core/types';
export { BaseChannel } from './channels';
export { WebChannel } from './channels/web';
export { TelegramChannel } from './channels/telegram';
export { WebSocketChannel } from './channels/websocket';
export { BaseSkill } from './skills/base';
export { SkillRegistry } from './skills';
export { InMemoryStore } from './memory';
export { DeepBrainMemoryStore } from './memory/deepbrain';
export { createProvider, SUPPORTED_PROVIDERS } from './providers';

// v0.3.0 new modules
export { Room } from './core/room';
export type { RoomMessage } from './core/room';
export { MCPToolRegistry, createMCPTool } from './tools/mcp';
export type { MCPTool, MCPToolDefinition, MCPToolResult } from './tools/mcp';
export { PluginManager } from './plugins';
export type { IPlugin, PluginHooks } from './plugins';
export { Sandbox } from './core/sandbox';
export type { SandboxConfig, SandboxRestrictions } from './core/sandbox';
export { Analytics } from './analytics';

// v0.4.0 modules
export { WorkflowEngine } from './core/workflow';
export type { WorkflowDefinition, WorkflowStep, WorkflowResult, StepResult } from './core/workflow';
export { AgentRegistry } from './core/a2a';
export type { A2ARequest, A2AResponse, AgentCapability, AgentRegistration } from './core/a2a';
export { HITLManager } from './core/hitl';
export type { ApprovalRequest, ApprovalResponse, HITLConfig } from './core/hitl';
export { VoiceChannel } from './channels/voice';
export type { VoiceChannelConfig, STTProvider, TTSProvider } from './channels/voice';
export { WebhookChannel } from './channels/webhook';
export type { WebhookConfig, WebhookPayload } from './channels/webhook';
export { VersionManager } from './core/versioning';
export type { VersionEntry, Migration } from './core/versioning';
export { ConnectionPool, RequestBatcher, LazyLoader } from './core/performance';
export type { AnalyticsSnapshot } from './analytics';
export { t, setLocale, getLocale, detectLocale, addMessages } from './i18n';
export type { Locale } from './i18n';

// v0.5.0+ modules
export { KnowledgeBase } from './core/knowledge';
export { deployToHermes } from './deploy/hermes';
export type { HermesDeployOptions, HermesDeployResult } from './deploy/hermes';

// v0.7.0 modules
export { createAuthMiddleware, getActiveSessions } from './core/auth';
export type { AuthConfig, AuthSession } from './core/auth';
// v0.8.0 modules
export { Orchestrator } from './core/orchestrator';
export type { AgentNode, OrchestratorWorkflow, OrchestratorConfig, HandoffRequest } from './core/orchestrator';
export { AgentPipeline, compose } from './core/compose';
export type { ComposableAgent, ComposeOptions } from './core/compose';
export { EmailChannel } from './channels/email';
export type { EmailChannelConfig, EmailMessage } from './channels/email';
export { SlackChannel } from './channels/slack';
export type { SlackChannelConfig, SlashCommandConfig, SlashCommandPayload } from './channels/slack';
export { WeChatChannel } from './channels/wechat';
export type { WeChatChannelConfig, WeChatMessage, TemplateMessageData } from './channels/wechat';
export { CalculatorTool } from './tools/calculator';
export { DateTimeTool } from './tools/datetime';
export { JsonTransformTool } from './tools/json-transform';
export { TextAnalysisTool } from './tools/text-analysis';

export { HttpSkill } from './skills/http';
export { WebhookTriggerSkill } from './skills/webhook-trigger';
export type { WebhookTarget } from './skills/webhook-trigger';
export { SchedulerSkill } from './skills/scheduler';
export type { ScheduledTask } from './skills/scheduler';
export { DocumentSkill } from './skills/document';
export type { DocumentChunk } from './skills/document';
export { SkillLearner, skillToMarkdown, parseSkillMarkdown } from './skills/auto-learn';
export type { LearnedSkill } from './skills/auto-learn';

// v0.9.0 modules
export { runTests, loadTestCases, formatReport } from './testing';
export type { TestCase, TestResult, TestReport } from './testing';
export { AnalyticsEngine } from './core/analytics-engine';
export type { AnalyticsEvent, AnalyticsStats } from './core/analytics-engine';
export { RateLimiter } from './core/rate-limiter';
export { LLMCache } from './core/cache';
export type { CacheConfig, CacheEntry } from './core/cache';
export { getSupportedLocales } from './i18n';
export { createDataAnalystConfig } from './templates/data-analyst';
export { createTeacherConfig } from './templates/teacher';

// v1.0.0 modules
export { OPCError, ProviderError, ValidationError, ConfigError, ChannelError, PluginError, RateLimitError, SecurityError, TimeoutError, wrapError, formatErrorForUser } from './core/errors';
export { sanitizeInput, detectInjection, securityHeaders, corsMiddleware, APIKeyManager, inputValidation } from './core/security';
export type { SecurityHeadersConfig, CORSConfig, APIKeyEntry } from './core/security';
export { createLoggingPlugin, createAnalyticsPlugin, createRateLimitPlugin } from './plugins';
export type { PluginManifest } from './plugins';

// v1.1.0 modules
export { FeishuChannel } from './channels/feishu';
export type { FeishuChannelConfig } from './channels/feishu';
export { DiscordChannel } from './channels/discord';
export type { DiscordChannelConfig } from './channels/discord';
export { ProcessWatcher } from './core/watch';
export type { WatchPattern, WatchMatch, WatchOptions } from './core/watch';

// v1.2.0 modules
export { ToolGateway } from './tools/gateway';
export type { ToolGatewayConfig, GatewayToolName } from './tools/gateway';
export { StreamingManager, StreamableResponse } from './core/streaming';
export type { StreamChunk, StreamOptions } from './core/streaming';

// v1.3.0 modules
export { TraceCollector, ConsoleExporter, DeepBrainExporter } from './traces';
export type { Span, SpanEvent, TraceExporter } from './traces';

// v1.4.0 modules
export { Scheduler, parseCron, cronMatches } from './core/scheduler';
export type { CronJob, JobHandler } from './core/scheduler';
