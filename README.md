# OPC Agent

**Open Agent Framework — Build, test, and run AI Agents for business workstations.**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)

OPC Agent is an open-source framework for building production-ready AI agents. It provides a declarative agent definition format (OAD), pluggable skills, multi-channel support, and a progressive trust model for safe deployment.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   OPC Agent                      │
├─────────────┬──────────┬────────────────────────┤
│   Channels  │  Skills  │       Memory           │
│  ┌────────┐ │ ┌──────┐ │  ┌──────────────────┐  │
│  │  Web   │ │ │ FAQ  │ │  │  Short-term       │  │
│  │  WS    │ │ │Custom│ │  │  Long-term        │  │
│  │  CLI   │ │ │ ...  │ │  └──────────────────┘  │
│  └────────┘ │ └──────┘ │                        │
├─────────────┴──────────┴────────────────────────┤
│              Agent Runtime                       │
│  ┌──────────┐ ┌────────┐ ┌────────────────────┐ │
│  │ Lifecycle│ │ Router │ │   LLM Providers    │ │
│  │ Manager  │ │        │ │ OpenAI/DeepSeek/   │ │
│  │          │ │        │ │ Qwen via agentkits │ │
│  └──────────┘ └────────┘ └────────────────────┘ │
├─────────────────────────────────────────────────┤
│              DTV Framework                       │
│  Data (read-only) │ Trust (sandbox→listed) │ Value│
└─────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install
npm install -g opc-agent

# Create a new agent project
opc init my-agent --template customer-service

# Enter the project
cd my-agent

# Validate the agent definition
opc build

# Test in sandbox
opc test

# Run the agent
opc run
```

## OAD — Open Agent Definition

Agents are defined using a declarative YAML format:

```yaml
apiVersion: opc/v1
kind: Agent
metadata:
  name: my-agent
  version: 1.0.0
  description: "My first agent"
spec:
  provider:
    default: deepseek
    allowed: [openai, deepseek, qwen]
  model: deepseek-chat
  systemPrompt: "You are a helpful assistant."
  skills:
    - name: faq-lookup
      description: "Look up FAQ answers"
  channels:
    - type: web
      port: 3000
  memory:
    shortTerm: true
    longTerm: false
  dtv:
    trust:
      level: sandbox
    value:
      metrics: [response_time, satisfaction_score]
```

## Programmatic Usage

```typescript
import { BaseAgent, AgentRuntime, WebChannel } from 'opc-agent';

// Option 1: Use runtime with OAD file
const runtime = new AgentRuntime();
await runtime.loadConfig('oad.yaml');
await runtime.initialize();
await runtime.start();

// Option 2: Build programmatically
const agent = new BaseAgent({
  name: 'my-agent',
  systemPrompt: 'You are helpful.',
  provider: 'deepseek',
  model: 'deepseek-chat',
});

agent.registerSkill(myCustomSkill);
agent.bindChannel(new WebChannel(3000));

await agent.init();
await agent.start();
```

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Agent** | Autonomous AI entity with lifecycle (init → ready → running → stopped) |
| **Skill** | Modular capability (FAQ, ticket creation, etc.) |
| **Channel** | User interface (Web HTTP, WebSocket, CLI) |
| **Memory** | Short-term (session) and long-term (persistent) |
| **OAD** | Declarative YAML agent definition format |

## DTV Framework

**D**ata — **T**rust — **V**alue: A governance framework for agent operations.

- **Data**: Read-only access to business data via MRGConfig reader
- **Trust**: Progressive levels control capabilities
  - `sandbox` → `verified` → `certified` → `listed`
- **Value**: Metrics tracking for ROI (response time, satisfaction, resolution rate)

## Templates

| Template | Description |
|----------|-------------|
| `customer-service` | FAQ + human handoff, web channel |
| More coming soon... | Sales, IT help desk, content moderation |

## CLI Commands

| Command | Description |
|---------|-------------|
| `opc init [name]` | Initialize a new agent project |
| `opc create <name>` | Create agent from template |
| `opc build` | Validate OAD definition |
| `opc test` | Run in sandbox mode |
| `opc run` | Start agent with channels |
| `opc publish` | Package for registry (coming soon) |

## Comparison

| Feature | OPC Agent | LangChain | AutoGen |
|---------|-----------|-----------|---------|
| Declarative config | ✅ OAD YAML | ❌ | ❌ |
| Trust levels | ✅ 4-tier | ❌ | ❌ |
| Built-in channels | ✅ Web, WS | ❌ | ❌ |
| Business-focused | ✅ | ❌ General | ❌ Research |
| Value tracking | ✅ ROI metrics | ❌ | ❌ |
| TypeScript-first | ✅ | Python | Python |
| Lightweight | ✅ ~5 deps | ❌ Heavy | ❌ Heavy |

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

## License

[Apache-2.0](LICENSE)

---

Built by [Deepleaper](https://github.com/Deepleaper) 🚀
