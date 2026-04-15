# Core Concepts

## Agent

An Agent is an autonomous AI entity with a defined lifecycle:

```
init → ready → running → stopped
```

Each agent has a name, system prompt, skills, channels, and memory.

## Skill

Skills are modular capabilities an agent can use. Each skill:
- Has a `name` and `description`
- Receives the conversation context and current message
- Returns whether it handled the message and with what confidence

Built-in skills include FAQ lookup and human handoff.

## Channel

Channels are the interfaces through which users interact with agents:
- **Web** — HTTP API with `/chat` endpoint and SSE streaming
- More channels (WebSocket, CLI, Slack) coming soon

## Memory

Agents have two types of memory:
- **Short-term** — Conversation history within a session
- **Long-term** — Persistent knowledge across sessions (coming soon)

## DTV (Data / Trust / Value)

The DTV framework governs agent operations:

### Data
Read-only access to business data. Agents can read configurations but cannot modify source systems.

### Trust
Progressive trust levels control agent capabilities:
- **sandbox** — No network, limited capabilities
- **verified** — Identity confirmed, basic capabilities
- **certified** — Security audited, full capabilities
- **listed** — Published in OPC marketplace

### Value
Metrics tracking for agent performance and ROI:
- Response time, satisfaction scores, resolution rates
- Automated reporting and dashboards
