# Changelog

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
