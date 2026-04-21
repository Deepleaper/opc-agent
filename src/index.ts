// OPC Agent — Open Agent Framework
export * from './core/types';
export { agentLoop } from './core/agent-loop';
export { DeepBrain } from './deepbrain/provider';
export { ModelRouter } from './providers/router';
export { ToolRegistry } from './tools/registry';
export { loadSkillIndex, loadSkillFull } from './skills/loader';
export { matchSkills } from './skills/matcher';
export { BaseAgent } from './core/agent';
export { AgentRuntime, truncateOutput } from './core/runtime';
export { Logger } from './core/logger';
export { loadOAD, validateOAD } from './core/config';
export { fetchModelList, detectSystem, recommendModels, clearModelCache, cacheInfo } from './core/model-recommender';
export type { ModelRec } from './core/model-recommender';
export { OADSchema } from './schema/oad';
export type { OADDocument, Metadata, Spec } from './schema/oad';
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
export type { SandboxConfig, SandboxRestrictions, ValidationResult, SandboxStatus } from './core/sandbox';
export { ApprovalManager } from './security/approval';
export type { ApprovalPolicy, ApprovalRequest as SecurityApprovalRequest } from './security/approval';
export { KeyManager } from './security/keys';
export { Analytics } from './analytics';

// v0.4.0 modules
export { WorkflowEngine } from './core/workflow';
export type { WorkflowDefinition, WorkflowStep, WorkflowResult, StepResult } from './core/workflow';
export { GraphWorkflowEngine, WorkflowBuilder, parseOADWorkflow } from './core/workflow-graph';
export type { WorkflowContext, GraphWorkflowStep, GraphWorkflow, GraphWorkflowResult, OADWorkflowDef, OADWorkflowStepDef } from './core/workflow-graph';
export { AgentRegistry, AgentCardRegistry } from './core/a2a';
export type { A2ARequest, A2AResponse, AgentCapability, AgentRegistration, AgentCard } from './core/a2a';
export { A2AHttpServer, A2AHttpClient, NetworkRegistry } from './core/a2a-http';
export type { A2AHttpServerConfig, RemoteAgent } from './core/a2a-http';
export { HITLManager } from './core/hitl';
export type { ApprovalRequest, ApprovalResponse, HITLConfig } from './core/hitl';
export { VoiceProcessor, createVoiceProcessor } from './channels/voice';
export type { VoiceConfig } from './channels/voice';
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

// v0.9.0 channels
export { DingTalkChannel } from './channels/dingtalk';
export type { DingTalkChannelConfig } from './channels/dingtalk';
export { MattermostChannel } from './channels/mattermost';
export type { MattermostChannelConfig } from './channels/mattermost';
export { GoogleChatChannel } from './channels/googlechat';
export type { GoogleChatChannelConfig } from './channels/googlechat';
export { TwitchChannel } from './channels/twitch';
export type { TwitchChannelConfig } from './channels/twitch';
export { IRCChannel } from './channels/irc';
export type { IRCChannelConfig } from './channels/irc';

// v0.9.0 core
export { ContextDiscovery } from './core/context-discovery';
export type { ContextFile } from './core/context-discovery';
export { SessionManager } from './core/session-manager';
export type { Session } from './core/session-manager';
export { HeartbeatManager } from './core/heartbeat';
export type { HeartbeatConfig } from './core/heartbeat';
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
export type { PluginManifest, Plugin } from './plugins';
export { loggerPlugin } from './plugins/logger';
export { rateLimiterPlugin, createRateLimiterPlugin as createEnhancedRateLimiterPlugin } from './plugins/rate-limiter';
export { contentFilterPlugin, createContentFilterPlugin } from './plugins/content-filter';

// v2.1.0 — Guardrails
export { GuardrailManager, createGuardrailsFromConfig } from './security/guardrails';
export type { GuardrailConfig, GuardrailRule, GuardrailResult, GuardrailViolation } from './security/guardrails';

// v3.1.0 — Exec Approvals + Elevated + Secrets
export { ExecApprovalManager } from './security/approvals';
export type { ExecApprovalPolicy, ExecApprovalRequest, ExecApprovalHistory, ApprovalRequestCallback } from './security/approvals';
export { ElevatedManager } from './security/elevated';
export type { ElevationMode, ElevationAuditEntry } from './security/elevated';
export { SecretsManager } from './security/secrets';
export type { SecretsStore } from './security/secrets';

// v3.1.0 — Hooks + Audio
export { HookManager, ALL_HOOK_EVENTS } from './core/hooks';
export type { HookEvent, HookContext, HookHandler } from './core/hooks';
export { AudioProcessor } from './core/audio';
export type { AudioFormat, TranscribeOptions, SynthesizeOptions, TranscribeResult, SynthesizeResult } from './core/audio';

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
export { TraceCollector, ConsoleExporter as TraceConsoleExporter, DeepBrainExporter } from './traces';
export type { Span as TraceSpan, SpanEvent as TraceSpanEvent, TraceExporter as ITraceExporter } from './traces';

// v1.8.0 — Telemetry (OTel-compatible)
export { Tracer, ConsoleExporter, FileExporter, OTLPHttpExporter, generateTraceId, generateSpanId } from './telemetry';
export type { Span, SpanEvent, Metric, TraceExporter } from './telemetry';

// v1.3.1 — Sub-agent management
export { SubAgentManager } from './core/subagent';
export type { SubAgentConfig, SubAgentResult } from './core/subagent';

// v1.4.0 modules
export { Scheduler, parseCron, cronMatches } from './core/scheduler';
export type { CronJob, JobHandler } from './core/scheduler';

// v1.5.0 — built-in tools + MCP client
export { getBuiltinTools, getBuiltinToolsByName, rlTools, homeAssistantTools, configureHomeAssistant, webSearchTools, webSearchTool, webReadTool } from './tools/builtin';
export { webSearch, parseDuckDuckGoHTML, type SearchResult as WebSearchResult, type WebSearchConfig, type SearchEngine } from './tools/web-search';
export { scrapeUrl, extractReadableContent, type ScrapedContent } from './tools/web-scraper';
export { MCPClient } from './tools/mcp-client';
export type { MCPServerConfig } from './tools/mcp-client';

// v1.6.0 — publish/pack/install
export { AgentPackager, AgentPublisher, AgentInstaller } from './publish';
export type { PackageManifest, PublishOptions } from './publish';

// v1.7.0 - Studio
export { StudioServer } from './studio/server';
export type { StudioConfig } from './studio/server';

// v1.9.0 — Google A2A Protocol
export { A2AServer, A2AClient, oadToAgentCard, JSON_RPC_ERRORS } from './protocols/a2a';
export type {
  A2AAgentCard, A2AAgentSkill, A2ATask, A2ATaskStatus, A2ATaskState,
  A2AMessage, A2AMessagePart, A2AArtifact,
} from './protocols/a2a';

// v1.9.0 — MCP Server (expose agents as MCP tools)
export { MCPServer } from './protocols/mcp/server';
export type { MCPServerConfig as MCPServerConf, MCPServerToolDefinition, MCPResourceDefinition, MCPPromptDefinition } from './protocols/mcp/types';
export { agentToMCPTools, agentToMCPResources } from './protocols/mcp/agent-tools';

// v1.8.0 - Eval
export { AgentEvaluator } from './eval';
export type { EvalCase, EvalResult, EvalSuite, EvalReport } from './eval';

// v1.9.0 — AG-UI Protocol (Agent-User Interaction)
export { AGUIServer, AGUIEventEmitter, AGUIClient } from './protocols/agui';
export { AGUI_EVENT_TYPES, isValidEventType } from './protocols/agui';
// v2.0.0 - Multi-agent collaboration patterns
export { DebatePattern, VotingPattern, PipelinePattern, HierarchyPattern, SharedContext, ConversationProtocol } from './core/collaboration';
export type { DebateResult, DebateArgument, VoteResult, VoteEntry, PipelineResult, PipelineStageResult, HierarchyResult, WorkerResult } from './core/collaboration';

export type {
  AGUIEvent, AGUIEventType, AGUIMessage, AGUIRunRequest, AGUIToolCall,
  AGUIToolDefinition, TextMessageStartEvent, TextMessageContentEvent,
  TextMessageEndEvent, ToolCallStartEvent, ToolCallArgsEvent, ToolCallEndEvent,
  StateSnapshotEvent, StateDeltaEvent, MessagesSnapshotEvent,
  RunStartedEvent, RunFinishedEvent, RunErrorEvent,
  StepStartedEvent, StepFinishedEvent, CustomEvent,
} from './protocols/agui';

// v2.1.0 — API Server + Context References
export { APIServer } from './core/api-server';
export type { APIServerConfig } from './core/api-server';
export { ContextRefResolver } from './core/context-refs';
export type { ContextRef, RefType } from './core/context-refs';

// v2.2.0 — Vision
export { VisionManager, detectMimeType } from './core/vision';
export type { ImageInput, VisionResult, VisionManagerConfig } from './core/vision';
export { visionTools, visionAnalyzeTool, visionExtractTextTool, visionCompareTool } from './tools/builtin/vision';

// v2.2.0 — Additional channels
export { WhatsAppChannel } from './channels/whatsapp';
export type { WhatsAppChannelConfig } from './channels/whatsapp';
export { SignalChannel } from './channels/signal';
export type { SignalChannelConfig } from './channels/signal';
export { MatrixChannel } from './channels/matrix';
export type { MatrixChannelConfig } from './channels/matrix';
export { IMessageChannel } from './channels/imessage';
export type { IMessageChannelConfig } from './channels/imessage';
export { LINEChannel } from './channels/line';
export type { LINEChannelConfig } from './channels/line';
export { MSTeamsChannel } from './channels/msteams';
export type { MSTeamsChannelConfig } from './channels/msteams';
export { QQChannel } from './channels/qq';
export type { QQChannelConfig } from './channels/qq';
export { NostrChannel } from './channels/nostr';
export type { NostrChannelConfig } from './channels/nostr';
export { SMSChannel } from './channels/sms';
export type { SMSChannelConfig } from './channels/sms';

// v2.3.0 — Voice Calls + IDE + Node Network + Gateway
export { VoiceCallManager } from './channels/voice-call';
export type { VoiceCallConfig } from './channels/voice-call';
export { IDEBridge } from './core/ide-bridge';
export type { IDEConfig, Diagnostic, TextEdit, Range, SearchOptions, SearchResult as IDESearchResult } from './core/ide-bridge';
export { NodeNetwork } from './core/node-network';
export type { RemoteNode } from './core/node-network';
export { Gateway } from './core/gateway';
export type { AgentConfig as GatewayAgentConfig, ChannelConfig as GatewayChannelConfig, GatewayConfig } from './core/gateway';

// v2.2.0 — Remote Sandbox
export { SandboxManager } from './core/sandbox';
export type { RemoteSandboxConfig, ExecResult } from './core/sandbox';

// v2.2.0 — Profiles
export { ProfileManager } from './core/profiles';
export type { Profile, ProfileConfig } from './core/profiles';

// v2.0.0 - Pre-built tool integrations (20 tools)
export {
  SlackTool, EmailSendTool, WebhookTool,
  NotionTool, GitHubTool, JiraTool, CalendarTool, TrelloTool,
  WebSearchTool, WebScraperTool, DatabaseTool, VectorSearchTool,
  CodeExecutionTool, GitTool, NpmTool,
  ImageGenerationTool, PDFReaderTool, CSVAnalyzerTool,
  SummarizerTool, TranslatorTool,
  getAllIntegrationTools, getIntegrationTool,
} from './tools/integrations';

// v4.1.0 — Priority Queue / Fast Mode + Gateway Registry
export { PriorityQueue, FastModeManager } from './core/priority-queue';
export type { PriorityLevel, PriorityRequest, PriorityConfig, ProviderPriorityEndpoint } from './core/priority-queue';
export { ToolGateway as AdvancedToolGateway, ToolGatewayRegistry } from './core/gateway-registry';
export type { ToolGatewayConfig as AdvancedToolGatewayConfig, GatewayTool as AdvancedGatewayTool, GatewayResult, GatewayStatus } from './core/gateway-registry';
