# Changelog

## [4.2.0] - 2026-04-21

### New Features
- **Priority Queue / Fast Mode** — Priority-aware request routing with per-session `/fast` toggle. Fast-mode requests are processed first and routed through provider priority endpoints (OpenAI, Anthropic, Google). Includes concurrency control, batch tier, and custom provider endpoint registration.
- **Gateway Registry** — Advanced multi-gateway tool provider pattern. Register multiple remote tool gateways with subscription-based access, per-tool quota tracking, auto-retry with backoff, and unified invocation routing across gateways. Complements the existing single-gateway `ToolGateway`.

### Improvements
- New `FastModeManager` for per-session priority state management
- `PriorityQueue` with weighted dequeue, provider concurrency limits, and drain support
- `ToolGatewayRegistry` for routing tool calls across multiple gateway providers

## [2.0.0] - 2026-04-18

### Major Features
- **Interactive CLI** (`opc chat`) — Full TUI with streaming, slash commands, history
- **Daemon Mode** (`opc start/stop/status`) — Run agents as background processes
- **Cron Scheduler** — Built-in job scheduling with cron expressions
- **Autonomous Skill Learning** — Agents create and improve skills from experience
- **Sub-Agent System** — Spawn parallel sub-agents for task delegation
- **Built-in Tools** — File operations, web fetch, shell exec, datetime
- **MCP Client** — Connect to external MCP servers via JSON-RPC
- **Telegram Channel** — Dual-mode (polling + webhook) with Markdown support
- **Discord Channel** — Gateway WebSocket with auto-reconnect
- **Slack Channel** — Real Events API + chat.postMessage
- **SOUL.md + CONTEXT.md** — Agent personality and project context files
- **Analytics** — Wired into runtime for message tracking, skill usage, errors

### Enhanced
- `/health` endpoint returns comprehensive agent info
- `opc init` generates SOUL.md, CONTEXT.md, and richer project templates
- OAD config supports scheduler, learning, and tools sections
- 204 tests passing

### CLI Commands
init, chat, run, dev, start, stop, status, jobs, skills, info, build, test, analytics, brain, logs, score, search, deploy, publish, install, plugin, tool, workflow, migrate

## 1.4.0 (2026-04-18)
- feat: wire Analytics into AgentRuntime (message timing, skill usage, error tracking)
- feat: expose analytics snapshot on /health and /api/dashboard endpoints
- feat: enhanced /health endpoint with agent name, version, uptime, memory type, skills, channels
- feat: Slack channel — real Events API webhook server + chat.postMessage via fetch
- feat: WebChannel metadata setters (version, memory type, skills, channels, analytics provider)
- feat: AgentRuntime.getAnalytics() and getConfig() accessors

## 1.3.1 (2026-04-17)
- fix: remove residual DTV/marketplace references
- fix: duplicate WatchPattern export

## 1.3.0 (2026-04-17)
- feat: Traces collection (OpenTelemetry-style)
- feat: DeepBrain exporter
- feat: brain/logs/score CLI commands

## 1.2.0
- Initial public release
- 11 channels, plugins, analytics
- Declarative OAD configuration
