<div align="center">

# ⚡ OPC Agent — 瞬知 Studio

**Your AI workforce, running locally. Zero cloud cost to start.**

One computer. One command. Your own AI agents — learning, evolving, working 24/7.

[![npm](https://img.shields.io/npm/v/opc-agent/alpha)](https://www.npmjs.com/package/opc-agent)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

[Quick Start](#-quick-start) · [Features](#-features) · [Architecture](#-architecture) · [CLI](#-cli-commands) · [中文](README.zh-CN.md)

</div>

---

## 🚀 Quick Start

### One-Line Install (recommended)

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.sh | bash

# Windows (PowerShell)
irm https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.ps1 | iex
```

This automatically installs Node.js, OPC Agent, Ollama, and a recommended AI model based on your hardware.

### Or install manually

```bash
npm install -g opc-agent@alpha
opc setup        # Interactive setup wizard
```

### Get started in 30 seconds

```bash
opc chat          # Chat in terminal
opc studio        # Open web UI → localhost:4000
opc run           # Start everything: Agent + Telegram + Web + Studio
```

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🧠 **Self-Evolving** | 4-layer evolution engine: Experience → Memory → Skills → Group knowledge |
| 💰 **Zero Cost Start** | Runs 100% locally with Ollama. No API key needed. |
| 🎨 **Studio UI** | Web-based management at localhost:4000 — models, channels, knowledge, templates |
| 📱 **Multi-Channel** | Telegram, Web, WeChat, Feishu, Discord, Slack, Email |
| 🔧 **40 Built-in Skills** | File ops, web search, code execution, image generation, and more |
| 🤖 **A2A Protocol** | Agent-to-agent communication for multi-agent workflows |
| 📦 **All-in-One** | DeepBrain (knowledge) + AgentKits (models) + Workstation (templates) |
| 🔒 **Privacy First** | Your data stays on your machine. No telemetry. |

---

## 🏗 Architecture

```
┌──────────────────────────────────────────┐
│              OPC Agent CLI               │
│   opc chat · opc studio · opc run       │
├──────────────────────────────────────────┤
│  Agent Loop    │  Self-Evolution (L1-L4) │
│  Context       │  L1 Experience Compile  │
│  Assembly      │  L2 Memory Consolidate  │
│                │  L3 Skill Discovery     │
│                │  L4 Group Evolution     │
├──────────────────────────────────────────┤
│  DeepBrain     │ AgentKits  │Workstation │
│  (Knowledge)   │ (Models)   │(Templates) │
│  SQLite+FTS5   │ Ollama/API │ Industry   │
├──────────────────────────────────────────┤
│  Channels                                │
│  Telegram │ Web │ WeChat │ Feishu │ ...  │
└──────────────────────────────────────────┘
```

### How it works

1. **You talk** → Agent receives message via any channel
2. **Agent thinks** → Context assembly + tool selection + LLM reasoning
3. **Agent acts** → Executes tools, calls APIs, generates content
4. **Agent learns** → Every interaction feeds the evolution engine
5. **Agent evolves** → Knowledge distills upward: experience → memory → skills

---

## 💻 CLI Commands

| Command | Description |
|---------|-------------|
| `opc setup` | Interactive setup wizard |
| `opc init [name]` | Create new agent project |
| `opc chat` | Terminal chat with agent |
| `opc studio` | Open Studio web UI (port 4000) |
| `opc run` | Start all services (Agent + channels + Studio) |
| `opc brain stats` | Show knowledge base statistics |
| `opc brain recall <query>` | Semantic search in knowledge |
| `opc brain learn <file>` | Import document into knowledge |
| `opc doctor` | Diagnose installation issues |

---

## 🔧 Configuration

After `opc setup`, all configuration lives in Studio UI (localhost:4000):

- **Models** — Switch between Ollama models, add cloud API keys
- **Channels** — Configure Telegram bot, WeChat, Feishu, etc.
- **Knowledge** — Drag & drop documents, manage DeepBrain
- **Templates** — Browse industry/job/workstation templates
- **Agent Settings** — Edit personality, skills, model assignments

Config files: `~/.opc/config.json` (global), `oad.yaml` (per agent)

---

## 📖 Model Support

### Local (Ollama) — Zero Cost
Auto-detected and recommended based on your RAM:

| RAM | Recommended Model | Size |
|-----|------------------|------|
| ≤3 GB | qwen2.5:0.5b | 400MB |
| ≤7 GB | qwen2.5:1.5b | 1.0GB |
| ≤15 GB | qwen2.5:7b | 4.7GB |
| ≤31 GB | qwen2.5:14b | 9.0GB |
| 32+ GB | qwen2.5:32b | 19GB |

### Cloud (via AgentKits)
Configure in Studio → Models: OpenAI, DeepSeek, Anthropic, Qwen, Google Gemini

---

## 🌐 Multi-Channel

| Channel | Setup |
|---------|-------|
| 💬 Web Chat | Built-in, localhost:3000 |
| 📱 Telegram | Add bot token in Studio |
| 💬 WeChat | Add app credentials in Studio |
| 🐦 Feishu | Add app credentials in Studio |
| 🎮 Discord | Add bot token in Studio |
| 💼 Slack | Add bot token in Studio |
| 📧 Email | Add SMTP config in Studio |

---

## 🧬 Self-Evolution

OPC Agent gets smarter over time through 4 layers of evolution:

- **L1 — Experience Compilation**: Raw interactions → structured insights (local Ollama)
- **L2 — Memory Consolidation**: Insights → refined knowledge (cloud AgentKits)
- **L3 — Skill Discovery**: Patterns → auto-generated skills (cloud AgentKits)
- **L4 — Group Evolution**: Individual knowledge → shared wisdom (local Ollama)

All L1/L4 processing runs locally at zero cost. L2/L3 uses cloud models for higher quality.

---

## 📦 Project Structure

```
~/.opc/                     # Global config
  config.json               # Settings
  agents/                   # Agent data

my-agent/                   # Agent workspace
  EGO.md                    # Agent personality
  DEEPBRAIN.md              # Knowledge summary
  oad.yaml                  # Agent definition
  .opc/
    brain.db                # Knowledge database
    skills/                 # Auto-generated skills
    evolution/              # Evolution logs
```

---

## 🤝 Contributing

```bash
git clone https://github.com/Deepleaper/opc-agent.git
cd opc-agent
npm install
npx tsc                    # Build
npx vitest run             # Test (1100+ tests)
```

---

## 📄 License

Apache-2.0 © [Deepleaper](https://github.com/Deepleaper)

---

<div align="center">

**Built by [Deepleaper](https://www.deepleaper.com)** — Making AI work for everyone.

⭐ Star this repo if OPC Agent helps you!

</div>
