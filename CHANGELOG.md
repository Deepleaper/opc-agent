# Changelog

All notable changes to OPC Agent will be documented in this file.

## [1.4.0] - 2026-04-19

### Added
- **Fast Mode Router**: Higher-level fast mode abstraction (`FastModeRouter`) for routing requests through priority queues. Supports model pattern matching, turbo/fast/standard tiers, endpoint rewriting (`/fast` suffix or `?priority=` query param), enable/disable toggle, and built-in latency saving metrics tracking. (`src/core/fast-mode.ts`)
- **Cloud Memory Backend**: Fetch-based cloud storage backend (`CloudMemoryBackend`) supporting S3, GCS, and Azure Blob — no SDK dependencies. Provides `upload`, `download`, `list`, `delete`, and bidirectional `sync` with local directories. Implements simplified AWS Signature v4, GCS Bearer, and Azure SharedKey auth headers. (`src/memory/cloud-storage.ts`)

## [1.3.0] - 2026-04-18

### Added
- **Local Web Dashboard**: Lightweight Express-based web dashboard (`Dashboard`) for monitoring agent state locally. Provides REST API endpoints (`/api/health`, `/api/state`, `/api/sessions`, `/api/tools`, `/api/channels`) and a built-in HTML UI with real-time polling. Track sessions, tool invocations, and channel stats. Binds to `127.0.0.1:4100` by default for security. (`src/core/dashboard.ts`)
- **Priority/Fast Mode**: Provider-aware priority routing (`PriorityRouter`) for OpenAI, Anthropic, and Google. Toggle between `standard`, `fast`, and `batch` tiers at runtime. Automatically injects provider-specific priority headers (e.g., `X-OpenAI-Processing-Priority`) for eligible models. Supports per-provider endpoint overrides and model pattern matching. (`src/core/priority.ts`)

## [1.2.0] - 2026-04-17

### Added
- **Tool Gateway**: Managed tool gateway (`ToolGateway`) that wraps multiple tool providers (web-search, image-gen, tts, browser) behind a single authenticated endpoint — no separate API keys needed. Auto-discovers available tools from gateway, falls back to defaults. Gateway tools implement `MCPTool` interface for seamless registry integration. (`src/tools/gateway.ts`)
- **Streaming Support**: SSE-based streaming for real-time agent responses. `StreamingManager` with `createStream()` / `writeChunk()` / `endStream()`. `StreamableResponse` with backpressure handling, event emission, and SSE pipe utility for Express-style HTTP responses. Channels can opt in via `supportsStreaming: true`. (`src/core/streaming.ts`)

## [1.1.0] - 2026-04-16

### Added
- **Feishu/Lark Channel**: Full Feishu bot integration with event subscription webhook, tenant access token caching, text & interactive card messaging, group + P2P support. Also works with Lark international via `apiBase` config. (`src/channels/feishu.ts`)
- **Discord Channel**: Discord bot via Gateway WebSocket with auto-reconnect, heartbeat, message content intent, and 2000-char message splitting. (`src/channels/discord.ts`)
- **ProcessWatcher**: Background process output monitoring with regex pattern matching — watch stdout/stderr for specific patterns (errors, "server ready", build completion) and get instant callbacks without polling. Supports `once` patterns, match history, and dynamic pattern add/remove. Inspired by Hermes Agent's `watch_patterns`. (`src/core/watch.ts`)

## [0.2.0] - 2026-04-15

### Added
- **DeepBrain Integration**: Optional long-term memory backend with semantic search. Config via `memory.longTerm.provider: deepbrain`. Falls back to in-memory if not installed.
- **Telegram Channel**: Basic webhook handler for Telegram Bot API (`src/channels/telegram.ts`).
- **WebSocket Channel**: Real-time bidirectional communication with broadcast (`src/channels/websocket.ts`).
- **Sales Assistant Template**: Product Q&A, lead capture, appointment booking.
- **Knowledge Base Template**: RAG with DeepBrain for answering from company docs.
- **Code Reviewer Template**: Bug detection, style checking, severity ratings.
- **Skill Marketplace Stub**: `opc publish` validates OAD and generates manifest. `opc search` placeholder.
- **OAD Marketplace Fields**: `pricing` (free/freemium/paid/enterprise) and `tags` in marketplace config.
- **Context Size Guard**: Auto-truncate tool outputs exceeding 5000 characters.
- **Conversation History Limit**: Configurable limit (default 50 messages).
- **Graceful Shutdown**: Handles SIGINT/SIGTERM with cleanup.
- **Structured Logging**: Logger with debug/info/warn/error levels.
- **Interactive CLI Init**: `opc init` with prompts and template selection.
- **Dev Mode**: `opc dev` watches files and hot-reloads agent on changes.
- **Agent Info Command**: `opc info` displays agent details from OAD.
- **Colorful CLI Output**: Status indicators and colored text throughout CLI.
- **CONTRIBUTING.md**: Contribution guidelines.
- **CHANGELOG.md**: This file.

### Changed
- OAD `memory.longTerm` now accepts boolean or object with provider config.
- OAD `channels.type` now includes `telegram`.
- CLI version bumped to 0.2.0.

## [0.1.0] - 2026-04-14

### Added
- Initial release
- BaseAgent with lifecycle management
- AgentRuntime for config-driven setup
- OAD Schema v1 with Zod validation
- Web channel (Express)
- InMemoryStore
- Skill system (BaseSkill, SkillRegistry)
- DTV framework (Trust, Value, Data)
- Customer Service template
- CLI: init, create, build, test, run, publish
