<div align="center">

# ⚡ OPC Agent — 瞬知 Studio

**Your AI workforce, running locally. Zero cloud cost to start.**

One computer. One command. Your own AI employees — working 24/7.

[![npm](https://img.shields.io/npm/v/opc-agent)](https://www.npmjs.com/package/opc-agent)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

[Quick Start](#-quick-start) · [Why OPC](#-why-opc) · [Studio](#-studio) · [Features](#-features) · [Architecture](#-architecture) · [CLI](#-cli-commands) · [中文](README.zh-CN.md)

</div>

---

## 🚀 Quick Start

**One-line install** (includes Node.js + auto-detects Ollama):

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.sh | bash

# Windows (PowerShell)
irm https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.ps1 | iex
```

**Or via npx** (zero install):

```bash
npx opc-agent@latest init
cd my-agent
npx opc-agent studio
```

That's it. Open `http://localhost:4000` — your AI workforce management Studio is live.

---

## 💡 Why OPC

| Pain Point | OPC Solution |
|---|---|
| AI agents need expensive cloud APIs | **Ollama-first**: runs 100% locally with zero cost |
| Complex setup, developer-only tools | **One command** → Studio GUI, no coding needed |
| Agents lose memory between sessions | **DeepBrain**: persistent 3-layer knowledge that evolves |
| One agent, one trick | **202 workstation templates** across 31 industries |
| No way to manage multiple agents | **Studio dashboard** — create, chat, configure, monitor |

---

## 🎨 Studio

OPC Studio is a web-based management GUI for your entire AI workforce.

**5 modules, one interface:**

| Module | What it does |
|---|---|
| 🧑‍💻 **OPC Assistant** | Built-in AI helper (always on top) |
| 🤖 **OPC Agent** | Create agents, chat, configure channels |
| 🧩 **AgentKits** | Model config — Ollama auto-detect + cloud API keys |
| 🧠 **DeepBrain** | Knowledge base — drag-drop docs, auto-categorize, 3-layer browsing |
| 🖥️ **Workstation** | 202 templates across 31 industries — pick a role, deploy an agent |

```bash
npx opc-agent studio    # → http://localhost:4000
```

---

## ✨ Features

### 🧠 Knowledge Evolve Engine
- **3-layer knowledge**: Industry → Job → Workstation (auto-distills upward)
- **Local-first**: uses Ollama models — zero cost evolution
- **Memory compaction**: distills conversations into persistent knowledge
- **DeepBrain integration**: drag-drop documents, auto-categorize

### 💬 Multi-Channel
Connect your agents to users wherever they are:

Telegram · Slack · Discord · WeChat · Feishu · Email · WhatsApp · Web Chat · Voice · IRC · Matrix · SMS · Line · Nostr · MS Teams · Google Chat · DingTalk · QQ · Twitch · Mattermost

### 🔧 53 Built-in Tools

| Category | Tools |
|---|---|
| **Core** (8) | shell, file I/O, web fetch, web search, browser, vision, datetime, calculator |
| **Developer** (12) | git, GitHub, npm, code exec, JSON transform, regex, text analysis, ... |
| **Productivity** (8) | calendar, email, Jira, Notion, Trello, Slack, summarizer, translator |
| **Integration** (13) | database, PDF reader, CSV analyzer, webhook, vector search, image gen, ... |
| **Knowledge** (7) | memory search, memory store, brain query, brain learn, brain evolve, ... |
| **Media** (5) | image generator, document processor, web scraper, Home Assistant, ... |

### 🤝 Protocol Support
- **A2A** (Agent-to-Agent): Google-standard inter-agent communication + HTTP transport
- **MCP** (Model Context Protocol): Anthropic-standard tool integration
- **AG-UI**: Frontend streaming protocol

### 🛡️ Enterprise-Ready
- Sandbox execution, API key encryption, rate limiting
- Content filtering, guardrails, HITL (human-in-the-loop)
- Priority queue with fast mode
- Gateway registry for multi-agent networking

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│          OPC Studio (GUI)           │  ← Management dashboard
├─────────────────────────────────────┤
│           OPC Agent (CLI)           │  ← Runtime + TUI chat
├──────────┬──────────┬───────────────┤
│ AgentKits│ DeepBrain│  Workstation  │
│ (Models) │(Knowledge)│ (Templates)  │
└──────────┴──────────┴───────────────┘
     ↕            ↕            ↕
   Ollama     SQLite/       202 roles
   Cloud      Memory        31 industries
   APIs       Evolve
```

---

## 🖥️ CLI Commands

```bash
opc init                    # Create new agent project
opc run                     # Start agent runtime
opc studio                  # Launch Studio GUI
opc chat                    # TUI terminal chat
opc doctor                  # Health check (13 checks)
opc memory-search <query>   # Search agent memory
opc skills list             # List available skills
opc deploy                  # Deploy to cloud
opc publish                 # Publish to OPC Hub
```

---

## ⚙️ Configuration

Agents are defined in `oad.yaml`:

```yaml
name: customer-support
description: 24/7 AI customer service agent
model: auto                          # auto-selects best available model
language: zh
channels:
  telegram:
    token: ${TELEGRAM_BOT_TOKEN}
  web:
    port: 3000
tools:
  - web-search
  - memory-search
skills:
  - customer-service
  - product-knowledge
```

---

## 🏥 Doctor

13 automated checks for agent health:

```bash
opc doctor
```

Checks: config validity, model connectivity, channel auth, memory persistence, tool availability, Ollama status, disk space, Node.js version, and more.

---

## 📊 Comparison

| Feature | OPC Agent | OpenClaw | Hermes Agent |
|---------|-----------|----------|--------------|
| GUI Management | ✅ Studio | ❌ CLI only | ❌ CLI only |
| Local-first (Ollama) | ✅ Auto-detect | ❌ Cloud-only | ⚠️ Manual |
| Smart Model Recommend | ✅ Hardware-based | ❌ | ❌ |
| Knowledge Evolution | ✅ 3-layer + distill | ❌ | ⚠️ Manual skills |
| Workstation Templates | ✅ 202 / 31 industries | ❌ | ❌ |
| Built-in Tools | ✅ 53 | ⚠️ ~20 | ⚠️ ~10 |
| Channels | ✅ 20 | ⚠️ 5 | ⚠️ 3 |
| A2A + MCP + AG-UI | ✅ All three | ⚠️ MCP only | ❌ |
| One-line Install | ✅ | ✅ | ❌ |
| Doctor Health Check | ✅ 13 checks | ❌ | ❌ |
| Memory Compaction | ✅ Auto-distill | ❌ | ❌ |

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
git clone https://github.com/Deepleaper/opc-agent.git
cd opc-agent
npm install
npm run build
npm run dev
```

---

## 📄 License

Apache-2.0 — see [LICENSE](LICENSE) for details.

**Open-source components:**
- `opc-agent` / `agentkits`: Apache-2.0
- `deepbrain` / `workstation`: LGPL-3.0

---

<div align="center">

**Built by [Deepleaper](https://www.deepleaper.com)** · Powering the AI workforce revolution

⭐ Star us if OPC helps you build better AI agents!

</div>
