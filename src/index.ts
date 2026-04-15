// OPC Agent — Open Agent Framework
export { BaseAgent } from './core/agent';
export { AgentRuntime, truncateOutput } from './core/runtime';
export { Logger } from './core/logger';
export { loadOAD, validateOAD } from './core/config';
export { OADSchema } from './schema/oad';
export type { OADDocument, Metadata, Spec, DTVConfig, TrustLevelType } from './schema/oad';
export type { IAgent, IChannel, ISkill, Message, AgentContext, SkillResult, MemoryStore, AgentState } from './core/types';
export { BaseChannel } from './channels';
export { WebChannel } from './channels/web';
export { TelegramChannel } from './channels/telegram';
export { WebSocketChannel } from './channels/websocket';
export { BaseSkill } from './skills/base';
export { SkillRegistry } from './skills';
export { InMemoryStore } from './memory';
export { DeepBrainMemoryStore } from './memory/deepbrain';
export { TrustManager } from './dtv/trust';
export { ValueTracker } from './dtv/value';
export { MRGConfigReader } from './dtv/data';
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
export { publishAgent, installAgent } from './marketplace';
export type { AgentManifest, PublishOptions, InstallOptions } from './marketplace';

// v0.7.0 modules
export { createAuthMiddleware, getActiveSessions } from './core/auth';
export type { AuthConfig, AuthSession } from './core/auth';
export { HttpSkill } from './skills/http';
export { WebhookTriggerSkill } from './skills/webhook-trigger';
export type { WebhookTarget } from './skills/webhook-trigger';
export { SchedulerSkill } from './skills/scheduler';
export type { ScheduledTask } from './skills/scheduler';
export { DocumentSkill } from './skills/document';
export type { DocumentChunk } from './skills/document';
