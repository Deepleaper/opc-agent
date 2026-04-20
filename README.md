<div align="center">

# ⚡ OPC Agent

**Open Agent Framework — Build, run, and evolve AI agents from your terminal.**

[![npm](https://img.shields.io/npm/v/opc-agent)](https://www.npmjs.com/package/opc-agent)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

[Quick Start](#-quick-start) · [Features](#-features) · [Architecture](#-architecture) · [Configuration](#-configuration) · [CLI](#-cli-commands) · [中文文档](README.zh-CN.md)

</div>

---

## 🚀 Quick Start

```bash
npm install -g opc-agent
opc init
opc run
```

Or one-line install (includes Node.js + optional Ollama):

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.sh | bash

# Windows PowerShell
irm https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.ps1 | iex
```

Then open Studio at **http://localhost:4000** or chat in terminal:

```bash
opc chat
```

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🤖 | **53 Built-in Tools** | File, shell, web, browser, vision, GitHub, Jira, Slack, and more |
| 🎨 | **Studio GUI** | Visual agent management at `http://localhost:4000` |
| 💬 | **TUI Terminal Chat** | Streaming responses, markdown rendering, slash commands |
| 🧠 | **Knowledge Evolve Engine** | Local Ollama-powered zero-cost knowledge distillation |
| 📱 | **15+ Channels** | Telegram, Discord, Slack, WeChat, Email, WhatsApp, LINE, Teams… |
| 🔧 | **40 Built-in Skills** | Productivity, knowledge, creative, developer skill packs |
| 📋 | **OAD Config** | Declarative YAML agent definition (`oad.yaml`) |
| 🏥 | **Doctor** | 13 health checks — model, tools, channels, memory |
| ⏰ | **Cron Scheduler** | Scheduled tasks + proactive agent triggers |
| 🔌 | **MCP Protocol** | Model Context Protocol server & client |
| 🗣️ | **Voice (STT/TTS)** | Whisper, Azure Speech, Volcano Engine |
| 📊 | **A2A Protocol** | Google Agent-to-Agent interoperability |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   Channels                       │
│  Telegram · Discord · Slack · WeChat · Email … │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│               OPC Agent Runtime                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Tool Exec│  │  Skills  │  │ Memory/Know  │  │
│  │ (53 tools)│  │(40 skills)│  │ Evolve Engine│  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Cron    │  │  Voice   │  │  MCP / A2A   │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│                 LLM Providers                    │
│  OpenAI · Anthropic · Ollama · Azure · Gemini   │
└─────────────────────────────────────────────────┘
```

---

## ⚙️ Configuration

Agents are defined with a single `oad.yaml` file:

```yaml
name: my-agent
description: Customer support agent
model:
  provider: ollama
  model: llama3.1
channels:
  - type: telegram
    token: ${TELEGRAM_BOT_TOKEN}
  - type: web
    port: 4000
tools:
  - file
  - shell
  - web-fetch
  - browser
skills:
  - weather
  - github
memory:
  provider: sqlite
cron:
  - schedule: "0 9 * * *"
    task: "Check and summarize overnight emails"
```

---

## 🖥️ CLI Commands

| Command | Description |
|---------|-------------|
| `opc init [name]` | Create a new agent project |
| `opc run` | Start agent with all configured channels |
| `opc chat` | Interactive TUI chat in terminal |
| `opc studio` | Launch Studio GUI (port 4000) |
| `opc doctor` | Run 13 health checks |
| `opc setup` | Configure model provider & API keys |
| `opc eval` | Run evaluation test suite |
| `opc traces` | View OpenTelemetry traces |
| `opc publish` | Publish agent to npm |
| `opc skill list` | List available skills |
| `opc skill add <name>` | Add a skill to agent |
| `opc cron list` | List scheduled tasks |

---

## 📱 Channels

OPC Agent connects to **15+ messaging platforms** out of the box:

| Channel | Status | Channel | Status |
|---------|--------|---------|--------|
| Telegram | ✅ | Discord | ✅ |
| Slack | ✅ | WeChat | ✅ |
| Email (IMAP/SMTP) | ✅ | WhatsApp | ✅ |
| LINE | ✅ | Teams | ✅ |
| Feishu/Lark | ✅ | DingTalk | ✅ |
| Web UI | ✅ | WebSocket | ✅ |
| Webhook | ✅ | REST API | ✅ |
| Voice | ✅ | SMS (Twilio) | ✅ |

---

## 🔧 Tools (53)

### Core (8)
`file-read` · `file-write` · `file-list` · `shell-exec` · `web-fetch` · `web-search` · `browser` · `vision`

### Developer (12)
`git-status` · `git-diff` · `git-commit` · `github-issue` · `github-pr` · `github-search` · `npm-search` · `code-analyze` · `test-run` · `lint` · `deploy` · `docker`

### Productivity (8)
`calendar` · `email-send` · `email-read` · `reminder` · `note` · `todo` · `timer` · `translate`

### Integration (13)
`jira-issue` · `jira-search` · `slack-send` · `slack-read` · `notion-page` · `notion-search` · `linear-issue` · `confluence` · `trello` · `asana` · `zendesk` · `hubspot` · `salesforce`

### Knowledge (7)
`memory-store` · `memory-recall` · `knowledge-learn` · `knowledge-evolve` · `rag-query` · `embedding` · `summarize`

### Media (5)
`image-generate` · `image-describe` · `audio-transcribe` · `tts-speak` · `screenshot`

---

## 📊 Comparison

| Feature | OPC Agent | Hermes Agent | OpenClaw |
|---------|-----------|-------------|----------|
| Built-in tools | 53 | ~10 | 30+ |
| GUI (Studio) | ✅ | ❌ | ✅ |
| TUI Chat | ✅ | ❌ | ✅ |
| Channels | 15+ | 3 | 15+ |
| Built-in skills | 40 | ❌ | 40 |
| Knowledge evolution | ✅ | ❌ | ✅ |
| Voice (STT/TTS) | ✅ | ❌ | ✅ |
| MCP Protocol | ✅ | ✅ | ✅ |
| A2A Protocol | ✅ | ❌ | ✅ |
| Cron scheduler | ✅ | ❌ | ✅ |
| One-line install | ✅ | ❌ | ✅ |
| Health checks | 13 | ❌ | ✅ |
| Local-first (Ollama) | ✅ | ❌ | ✅ |
| Open source | Apache-2.0 | Proprietary | Apache-2.0 |

> **OPC Agent** is the open-source core runtime. **OpenClaw** is the full platform built on top of it.

---

## 🧠 Knowledge Evolve Engine

OPC Agent includes a built-in knowledge evolution pipeline that runs **entirely local** with Ollama:

```
Conversations → Learn → Cluster → Deduplicate → Distill → Evolved Knowledge
```

- **Zero API cost** — uses local Ollama models for distillation
- **Automatic** — learns from every conversation, evolves on schedule
- **Tiered memory** — short-term (conversation) → long-term (distilled) → evolved (refined)
- **Full-text search** — SQLite FTS5 for instant recall across all memory

```bash
opc knowledge evolve          # Trigger manual evolution
opc knowledge stats           # View knowledge base stats
opc knowledge search "query"  # Search across all knowledge
```

---

## 🎨 Studio

Launch the visual management dashboard:

```bash
opc studio
```

Studio provides:
- **Agent overview** — status, model, channels, tools at a glance
- **Live chat** — test your agent in the browser
- **Configuration editor** — edit `oad.yaml` visually
- **Logs & traces** — real-time log streaming and OpenTelemetry traces
- **Skill browser** — discover and install skills
- **Cron manager** — create and monitor scheduled tasks

---

## 🏥 Doctor

Run comprehensive health checks:

```bash
opc doctor
```

```
✅ Model provider connected (ollama/llama3.1)
✅ 53/53 tools available
✅ Memory store healthy (SQLite, 1,247 entries)
✅ Telegram channel connected
✅ Cron scheduler running (3 jobs)
⚠️  No TTS provider configured
✅ Disk space OK (12.3 GB free)
...
```

13 checks covering: model connectivity, tool wiring, channel status, memory health, disk space, Node.js version, package updates, and more.

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
git clone https://github.com/Deepleaper/opc-agent.git
cd opc-agent
npm install
npm run build
npm test
```

---

## 📄 License

[Apache-2.0](LICENSE) © [Deepleaper](https://github.com/Deepleaper)

---

<div align="center">

**If OPC Agent helps you build better agents, give us a ⭐**

[GitHub](https://github.com/Deepleaper/opc-agent) · [npm](https://www.npmjs.com/package/opc-agent) · [Docs](https://opc-agent.dev)

</div>
