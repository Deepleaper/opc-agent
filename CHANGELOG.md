# Changelog

All notable changes to OPC Agent will be documented in this file.

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
