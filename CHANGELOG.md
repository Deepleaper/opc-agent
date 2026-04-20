# Changelog

All notable changes to OPC Agent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [4.1.16] - 2025-04-18

### Added
- Full TUI terminal chat with streaming, markdown rendering, and slash commands
- One-line install script for macOS/Linux (`install.sh`) and Windows (`install.ps1`)
- `opc doctor` now checks tool availability and wiring (tools health check)

### Fixed
- TUI input handling and display improvements

## [4.1.15] - 2025-04-15

### Added
- 20 new integration tools: Jira, Slack, Notion, Linear, Confluence, Trello, Asana, Zendesk, HubSpot, Salesforce, and more
- Total built-in tools count reaches **53**

## [4.1.14] - 2025-04-12

### Fixed
- Process keep-alive reliability — agents no longer exit unexpectedly on channel disconnect
- 33 built-in tools fully wired to runtime (previously some were declared but not connected)

## [4.1.12] - 2025-04-08

### Added
- Memory compaction — distilled memory reduces storage and improves recall relevance
- Automatic deduplication of similar memory entries

## [4.1.11] - 2025-04-05

### Added
- Knowledge Evolve Engine v2.1 — improved clustering, deduplication, and refinement pipeline
- Ollama-local knowledge distillation (zero API cost)

## [4.1.8] - 2025-03-28

### Added
- Voice message support (STT/TTS)
- Whisper integration for speech-to-text
- Azure Speech and Volcano Engine TTS providers
- Voice channel support in Telegram and Web UI

## [4.1.7] - 2025-03-22

### Added
- 40 built-in skills: productivity, knowledge, creative, and developer skill packs
- ProactiveAgent — agents can initiate conversations based on triggers and schedules
- `opc skill list` and `opc skill add` CLI commands

## [4.1.6] - 2025-03-18

### Added
- SQLite persistent memory with full-text search (FTS5)
- AgentSkills.io format support for skill discovery and sharing
- Memory search across conversations with relevance ranking

### Changed
- Default memory provider switched from JSON file to SQLite

## [4.1.5] - 2025-03-14

### Added
- SkillLearner — agents can learn new skills from demonstrations
- UserProfiler — automatic user preference tracking and personalization

## [4.1.4] - 2025-03-10

### Added
- `.npmignore` for cleaner package publishing
- Local cron scheduler (no external dependencies)
- FileBackedStore for persistent key-value storage

### Fixed
- Package size reduced by 60% with proper npmignore

## [4.1.3] - 2025-03-06

### Added
- Smart model recommendation based on task complexity and available providers
- `opc setup` auto-detects local Ollama models

## [4.1.2] - 2025-03-02

### Changed
- Ollama-first UX overhaul — local models are now the default, cloud providers optional
- `opc init` defaults to Ollama if detected, guides API key setup otherwise

### Fixed
- Ollama connection reliability on slow startup

## [4.1.1] - 2025-02-26

### Changed
- Studio UI improvements: better agent card layout, real-time status indicators
- Dark mode support in Studio

### Fixed
- Studio WebSocket reconnection on network interruption

## [4.1.0] - 2025-02-20

### Added
- Initial CLI with `opc init`, `opc run`, `opc chat`, `opc studio` commands
- Web-based Studio GUI at `http://localhost:4000`
- OAD (Open Agent Definition) YAML configuration format
- Multi-channel support: Telegram, Discord, Slack, WeChat, Email
- OpenAI, Anthropic, Ollama, Azure model providers
- Basic memory with learn/recall cycle
- MCP Protocol server and client
- A2A Protocol support
- OpenTelemetry tracing
- `opc doctor` with 13 health checks
- `opc eval` evaluation framework
