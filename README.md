<p align="center">
  <h1 align="center">🤖 OPC Agent</h1>
  <p align="center"><strong>Open Agent Framework — Build, test, and run AI Agents for business workstations</strong></p>
  <p align="center">
    <a href="https://www.npmjs.com/package/opc-agent"><img src="https://img.shields.io/npm/v/opc-agent?color=blue" alt="npm"></a>
    <a href="https://github.com/anthropic-lab/opc-agent/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-green" alt="license"></a>
    <a href="https://github.com/anthropic-lab/opc-agent/actions"><img src="https://img.shields.io/badge/tests-passing-brightgreen" alt="tests"></a>
    <a href="https://www.npmjs.com/package/opc-agent"><img src="https://img.shields.io/npm/dm/opc-agent?color=orange" alt="downloads"></a>
  </p>
</p>

---

OPC Agent is a **TypeScript-first framework** for building production AI agents. Define your agent in a single YAML file (OAD — Open Agent Definition), connect any LLM provider, deploy to any channel.

## ⚡ Quick Start (30 seconds)

```bash
# Install
npm install -g opc-agent

# Create your first agent
opc init my-agent
cd my-agent

# Run it
opc run
```

Your agent is now live at `http://localhost:3000` with a beautiful web chat UI.

## ✨ Features

### 🔌 Multi-Provider LLM Support
```yaml
# oad.yaml
spec:
  provider:
    default: deepseek
    allowed: [openai, deepseek, qwen, anthropic, ollama]
  model: deepseek-chat
```

Supports **OpenAI**, **DeepSeek**, **Anthropic**, **Qwen**, **Ollama** (local), and any OpenAI-compatible API.

### 📡 Multi-Channel Deployment
```yaml
spec:
  channels:
    - type: web        # Beautiful chat UI
      port: 3000
    - type: telegram   # Telegram bot
    - type: websocket  # Real-time WebSocket
    - type: slack       # Slack integration
    - type: email       # Email channel
    - type: wechat      # WeChat Official Account
    - type: voice       # Voice (STT/TTS)
    - type: webhook     # Incoming webhooks
```

### 🧠 Knowledge Base (RAG)
```typescript
import { KnowledgeBase } from 'opc-agent';

const kb = new KnowledgeBase('./docs');
await kb.addFile('product-manual.pdf');
// Agent automatically uses KB for context
```

### 🔧 Plugin System
```yaml
spec:
  plugins:
    - name: logging
    - name: analytics
    - name: rate-limit
      config: { maxPerMinute: 60 }
```

Built-in plugins: `logging`, `analytics`, `rate-limit`. Custom plugins support lifecycle hooks: `onInit`, `onMessage`, `onResponse`, `onError`, `onShutdown`.

### 🔒 Security
- Input sanitization (XSS, injection prevention)
- API key rotation & management
- CORS configuration
- Helmet-style security headers
- Content Security Policy
- Auth middleware with session isolation

### 🧪 Agent Testing
```bash
opc test              # Run test cases
opc test --watch      # Watch mode
```

```yaml
# tests/greeting.yaml
- input: "Hello"
  expect:
    contains: ["hello", "hi"]
    maxLatencyMs: 5000
```

### 🎭 Multi-Agent Orchestration
```typescript
import { Orchestrator } from 'opc-agent';

const orchestrator = new Orchestrator({
  agents: [triageAgent, salesAgent, supportAgent],
  strategy: 'route-by-intent',
});
```

### 📊 Built-in Analytics & Monitoring
- `/api/health` — Health check
- `/api/metrics` — Prometheus-compatible metrics
- `/api/dashboard` — Real-time dashboard UI
- Conversation export (JSON, Markdown, CSV)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   OAD (YAML)                     │
│          Agent Definition & Config               │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Channels │  │ Plugins  │  │   Security   │  │
│  │ web,tg,  │  │ logging, │  │  sanitize,   │  │
│  │ ws,slack │  │ analytics│  │  CORS, auth  │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │           │
│  ┌────▼──────────────▼───────────────▼────────┐ │
│  │              Agent Runtime                  │ │
│  │   ┌─────────┐ ┌────────┐ ┌─────────────┐  │ │
│  │   │ Memory  │ │ Skills │ │  Knowledge   │  │ │
│  │   └─────────┘ └────────┘ └─────────────┘  │ │
│  └────────────────────┬───────────────────────┘ │
│                       │                          │
│  ┌────────────────────▼───────────────────────┐ │
│  │            LLM Providers                    │ │
│  │  OpenAI · DeepSeek · Anthropic · Ollama    │ │
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

## 📖 CLI Reference

| Command | Description |
|---------|-------------|
| `opc init [name]` | Create a new agent project |
| `opc run` | Start the agent |
| `opc dev` | Start in development mode (auto-reload) |
| `opc test` | Run agent test cases |
| `opc validate` | Validate OAD configuration |
| `opc deploy hermes` | Deploy to Hermes cloud |
| `opc plugin list` | List available plugins |
| `opc plugin add <name>` | Add a plugin to config |
| `opc migrate` | Migrate OAD to latest schema |
| `opc marketplace publish` | Publish to marketplace |

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes with tests
4. Run tests: `npm test`
5. Submit a pull request

### Development Setup

```bash
git clone https://github.com/anthropic-lab/opc-agent.git
cd opc-agent
npm install
npm run build
npm test
```

## 📄 License

[Apache License 2.0](LICENSE) — Use it freely in commercial and open source projects.

---

<p align="center">Built with ❤️ by the OPC team</p>
