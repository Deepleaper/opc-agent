# OPC Agent

**Open Agent Framework** — Build, test, and run AI Agents for business workstations.

[![npm version](https://img.shields.io/npm/v/opc-agent.svg)](https://www.npmjs.com/package/opc-agent)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

## Features

- 🤖 **Agent Framework** — BaseAgent with lifecycle management, skills, and LLM integration
- 📋 **OAD Schema** — Declarative agent definition (YAML/JSON) with validation
- 🧠 **Memory System** — Short-term + long-term memory with DeepBrain integration
- 🔌 **Multi-Channel** — Web, WebSocket, and Telegram channels
- 🛡️ **DTV Framework** — Data, Trust, and Value tracking for agents
- 🎯 **Skill System** — Pluggable skills with registry and priority execution
- 📦 **Templates** — Customer service, sales assistant, knowledge base, code reviewer
- 🚀 **CLI** — Interactive project creation, dev mode, build, test, run

## Quick Start

```bash
# Install globally
npm install -g opc-agent

# Create a new agent project (interactive)
opc init my-agent

# Or with a specific template
opc init my-bot --template sales-assistant

# Run the agent
cd my-agent
opc run
```

## Templates

| Template | Description |
|----------|-------------|
| `customer-service` | FAQ lookup + human handoff |
| `sales-assistant` | Product Q&A + lead capture + appointment booking |
| `knowledge-base` | RAG with DeepBrain semantic search |
| `code-reviewer` | Bug detection + style checking |

## CLI Commands

| Command | Description |
|---------|-------------|
| `opc init [name]` | Create new project (interactive) |
| `opc create <name>` | Create agent from template |
| `opc info` | Show agent info from OAD |
| `opc build` | Validate OAD |
| `opc test` | Run in sandbox mode |
| `opc run` | Start agent with channels |
| `opc dev` | Hot-reload development mode |
| `opc publish` | Validate and generate manifest |
| `opc search <query>` | Search OPC Registry (coming soon) |

## OAD Schema

OAD (Open Agent Definition) is a declarative schema for defining agents:

```yaml
apiVersion: opc/v1
kind: Agent
metadata:
  name: my-agent
  version: 1.0.0
  description: "My AI agent"
  marketplace:
    category: support
    pricing: free
    tags: [ai, support]
spec:
  provider:
    default: deepseek
    allowed: [openai, deepseek, qwen]
  model: deepseek-chat
  systemPrompt: "You are a helpful assistant."
  skills:
    - name: faq-lookup
      description: "Answer FAQs"
  channels:
    - type: web
      port: 3000
    - type: telegram
      config:
        token: "BOT_TOKEN"
    - type: websocket
      port: 3002
  memory:
    shortTerm: true
    longTerm:
      provider: deepbrain
      collection: my-knowledge
  dtv:
    trust:
      level: sandbox
    value:
      metrics: [response_time]
```

## Memory Providers

### In-Memory (default)
Simple key-value store. Data lost on restart.

### DeepBrain (optional)
Semantic search over past conversations and knowledge. Install `deepbrain` package:

```bash
npm install deepbrain
```

Configure in OAD:
```yaml
memory:
  longTerm:
    provider: deepbrain
    collection: my-collection
```

Falls back to in-memory if deepbrain is not installed.

## Channels

- **Web** — Express HTTP server with `/chat` endpoint and SSE streaming
- **WebSocket** — Real-time bidirectional communication with broadcast
- **Telegram** — Webhook handler for Telegram Bot API

## Programmatic Usage

```typescript
import { BaseAgent, AgentRuntime } from 'opc-agent';

// Quick start
const agent = new BaseAgent({
  name: 'my-agent',
  systemPrompt: 'You are helpful.',
});
await agent.init();

// With skills
agent.registerSkill({
  name: 'greeter',
  description: 'Greet users',
  execute: async (ctx, msg) => {
    if (msg.content.includes('hello')) {
      return { handled: true, response: 'Hi!', confidence: 1.0 };
    }
    return { handled: false, confidence: 0 };
  },
});

// From OAD config
const runtime = new AgentRuntime();
await runtime.loadConfig('oad.yaml');
await runtime.initialize();
await runtime.start();
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Apache-2.0 — see [LICENSE](LICENSE).
