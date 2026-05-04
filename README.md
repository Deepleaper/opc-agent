<p align="center">
  <img src="https://raw.githubusercontent.com/Deepleaper/opc-agent/main/assets/logo.png" width="120" alt="OPC Agent Logo">
</p>

<h1 align="center">OPC Agent</h1>

<p align="center">
  <strong>Your AI agent that runs 100% locally. Zero cloud. Zero cost. Self-learning.</strong><br>
  <strong>纯本地 AI Agent。零云端、零费用、越用越聪明。</strong>
</p>

<p align="center">
  <a href="https://pypi.org/project/opc-agent/"><img src="https://img.shields.io/pypi/v/opc-agent?color=%2334D058&label=PyPI" alt="PyPI"></a>
  <a href="https://pypi.org/project/opc-agent/"><img src="https://img.shields.io/pypi/pyversions/opc-agent" alt="Python"></a>
  <a href="https://pypi.org/project/opc-agent/"><img src="https://img.shields.io/pypi/dm/opc-agent" alt="Downloads"></a>
  <a href="https://github.com/Deepleaper/opc-agent/stargazers"><img src="https://img.shields.io/github/stars/Deepleaper/opc-agent?style=social" alt="Stars"></a>
  <a href="https://github.com/Deepleaper/opc-agent/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green" alt="License"></a>
  <a href="https://github.com/Deepleaper/opc-agent/actions"><img src="https://img.shields.io/github/actions/workflow/status/Deepleaper/opc-agent/ci.yml?label=CI" alt="CI"></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-api">API</a> •
  <a href="#-roadmap">Roadmap</a> •
  <a href="#中文说明">中文说明</a>
</p>

---

> **OPC Agent** is an open-source, fully local AI agent powered by [Ollama](https://ollama.com). It runs entirely on your machine — no API keys, no subscriptions, no data leaving your laptop. Built-in **DeepBrain** self-learning engine means it gets smarter with every conversation. ~1,300 lines of Python. That's it.
>
> Think of it as **"ChatGPT that runs on your MacBook, remembers everything, and costs nothing."**

---

## Why OPC Agent?

|  | ChatGPT / Claude | Local LLM (raw Ollama) | **OPC Agent** |
|---|:---:|:---:|:---:|
| Monthly cost | $20+ | $0 | **$0** |
| Data privacy | ❌ Cloud servers | ✅ Local | **✅ Local** |
| Works offline | ❌ | ✅ | **✅** |
| Remembers you | ⚠️ Limited | ❌ | **✅ Auto-learning** |
| Web UI | ✅ | ❌ | **✅** |
| Self-improving | ❌ | ❌ | **✅ DeepBrain L0-L1** |
| Setup effort | Sign up + pay | Pull model + code | **`pip install` + go** |

---

## 🚀 Quick Start

```bash
# 1. Install Ollama (local AI runtime)
curl -fsSL https://ollama.com/install.sh | sh   # macOS / Linux
# Windows: https://ollama.com/download

# 2. Install OPC Agent
pip install opc-agent

# 3. Initialize (auto-detects Ollama, picks best model for your hardware)
opc-agent init

# 4. Launch
opc-agent start
```

Open **http://localhost:3000** → done. No account. No API key. No credit card.

---

## ✨ Features

### 🧠 DeepBrain Self-Learning Engine
Not just a chat wrapper — OPC Agent **learns from every conversation**.

```
You: "Our stack is React + TypeScript, team of 8"

     ┌─────────────────────────────────────────┐
     │  DeepBrain auto-extracts:                │
     │  [fact] Tech stack: React + TypeScript    │
     │  [fact] Team size: 8                      │
     └─────────────────────────────────────────┘

Next session:
You: "Write a frontend component"
AI: → Directly gives React + TypeScript code (remembers your context)
```

- **L0 — Extract**: Local Ollama async-extracts key facts after each conversation
- **L1 — Recall**: Keyword-matched knowledge injected into context before each reply
- Knowledge stored in local SQLite (`~/.opc/brain.db`), auto-dedup & decay

### 🖥️ Web UI
- Markdown + syntax highlighting
- Streaming real-time output
- Multi-conversation management

### 🎯 Smart Model Recommendation
- Detects your hardware (RAM / VRAM)
- Recommends the optimal model automatically

### 📁 Fully Customizable Workspace
```
~/.opc/workspace/
├── SOUL.md      # AI personality
├── MEMORY.md    # Bootstrap memories
└── TOOLS.md     # Tool descriptions
```

### 🔒 100% Local & Private
- Zero network requests after setup
- All data stays in `~/.opc/`
- Works completely air-gapped

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                    OPC Agent v0.2.0                   │
│                   (~1,300 lines Python)               │
├──────────────┬───────────────┬───────────────────────┤
│   Web UI     │   REST API    │   WebSocket /ws/chat  │
│  (Browser)   │  /api/*       │   (Streaming)         │
├──────────────┴───────────────┴───────────────────────┤
│                  Agent Core                           │
│         ┌─────────────┐  ┌──────────────┐            │
│         │  Conversation│  │  Workspace   │            │
│         │  Manager     │  │  (SOUL/MEM)  │            │
│         └──────┬───────┘  └──────────────┘            │
│                │                                      │
│         ┌──────▼──────────────────────┐               │
│         │  🧠 DeepBrain Engine        │               │
│         │  L0: Extract → L1: Recall   │               │
│         │  brain.db (SQLite)          │               │
│         └──────┬──────────────────────┘               │
│                │                                      │
├────────────────▼──────────────────────────────────────┤
│              Ollama (Local LLM Runtime)               │
│        llama3 │ qwen2.5 │ mistral │ deepseek │ ...   │
└──────────────────────────────────────────────────────┘
        Runs on: MacBook Pro / Mac Mini / Linux PC
                  No cloud. No GPU required.
```

---

## 📡 API

Full REST API — embed OPC Agent in your own apps:

```bash
# System
GET  /api/system/status          # Health check
POST /api/system/setup           # Initial setup

# Models
GET  /api/models                 # List available
GET  /api/models/recommend       # Smart recommendation
POST /api/models/pull            # Pull new model
PUT  /api/models/active          # Switch active model

# Conversations
GET    /api/conversations        # List all
POST   /api/conversations        # Create new
GET    /api/conversations/{id}   # Get details
DELETE /api/conversations/{id}   # Delete

# Knowledge (DeepBrain)
GET  /api/brain/entries          # All learned knowledge
GET  /api/brain/stats            # Brain statistics

# Real-time Chat
WS   /ws/chat                    # WebSocket streaming
```

<details>
<summary><strong>Python example</strong></summary>

```python
import httpx, websockets, asyncio, json

# Create conversation
r = httpx.post("http://localhost:3000/api/conversations", json={"title": "test"})
cid = r.json()["id"]

# Stream chat via WebSocket
async def chat():
    async with websockets.connect("ws://localhost:3000/ws/chat") as ws:
        await ws.send(json.dumps({"conversation_id": cid, "message": "Hello!"}))
        async for msg in ws:
            data = json.loads(msg)
            if data["type"] == "token":
                print(data["content"], end="", flush=True)
            elif data["type"] == "done":
                break

asyncio.run(chat())
```

</details>

---

## 💻 System Requirements

| | Minimum | Recommended |
|---|---|---|
| Python | 3.10 | 3.12+ |
| RAM | 8 GB | 16 GB+ |
| Ollama | Required | Latest |
| GPU | Not required | Speeds up inference |
| OS | macOS / Linux / Windows | macOS (Apple Silicon) |

**Model ↔ RAM guide:**

| RAM | Model | Experience |
|---|---|---|
| 8 GB | `qwen2.5:3b` | Basic conversations |
| 16 GB | `qwen2.5:7b` | Good quality |
| 32 GB | `qwen2.5:14b` | Excellent |
| 64 GB+ | `qwen2.5:32b` | Near GPT-4 level |

---

## ⚙️ Configuration

```yaml
# ~/.opc/config.yaml (auto-generated on first run)
ollama:
  base_url: http://localhost:11434
  model: qwen2.5:7b

server:
  port: 3000
  host: 0.0.0.0

brain:
  enabled: true
  auto_extract: true
  max_context: 2000
```

---

## 🗺️ Roadmap

- [x] Web UI with streaming chat
- [x] DeepBrain self-learning engine (L0-L1)
- [x] Smart model recommendation
- [x] Full REST API
- [x] Customizable workspace (SOUL / MEMORY / TOOLS)
- [ ] RAG document Q&A
- [ ] Plugin system
- [ ] Voice input
- [ ] Mobile PWA
- [ ] Multi-modal (vision)

---

## 🌐 Ecosystem

```
  ┌─────────────────────────────────────────────────┐
  │  🚀 Leaper Agent — Self-evolving AI workforce   │
  │     Multi-LLM · Telegram/Feishu · 6-layer mem   │
  ├─────────────────────────────────────────────────┤
  │  🤖 OPC Agent — Local AI agent  ← YOU ARE HERE  │
  │     Ollama · Web UI · DeepBrain L0-L1            │
  ├─────────────────────────────────────────────────┤
  │  🧠 OPC DeepBrain — Knowledge engine (lib)      │
  │     Standalone memory layer for any agent        │
  └─────────────────────────────────────────────────┘
```

| I need… | Use this |
|---|---|
| Just a knowledge engine | [opc-deepbrain](https://github.com/Deepleaper/opc-deepbrain) |
| A local AI agent | **OPC Agent** (this repo, includes DeepBrain) |
| Professional AI workforce | [Leaper Agent](https://github.com/Deepleaper/leaper-agent) · [中文](https://github.com/Deepleaper/leaper-agent-cn) |

---

## 🤝 Contributing

Contributions welcome! The codebase is intentionally small (~1,300 lines) — easy to understand, easy to contribute.

```bash
git clone https://github.com/Deepleaper/opc-agent.git
cd opc-agent
pip install -e ".[dev]"
```

---

## 📄 License

[MIT](LICENSE) — use freely, commercial use welcome.

---

<br>

<h2 id="中文说明">🇨🇳 中文说明</h2>

**OPC Agent** 是一个完全开源、纯本地运行的 AI Agent。

### 核心卖点

- **💰 零费用** — 不需要 API Key，不需要订阅，永久免费
- **🔒 零云端** — 数据从不离开你的电脑，完全离线可用
- **🧠 会学习** — 内置 DeepBrain 自学习引擎，越用越聪明
- **⚡ 超轻量** — 仅 ~1,300 行 Python 代码，一条命令安装

### 快速开始

```bash
# 安装 Ollama（本地 AI 引擎）
curl -fsSL https://ollama.com/install.sh | sh

# 安装 OPC Agent
pip install opc-agent

# 初始化（自动检测硬件，推荐最优模型）
opc-agent init

# 启动
opc-agent start
```

打开 **http://localhost:3000** — 你的私人 AI 助手已上线 🎉

### 与 Leaper Agent 的区别

| | OPC Agent | Leaper Agent |
|---|---|---|
| 定位 | 个人本地助手 | 专业 AI 员工团队 |
| 费用 | 免费 | 按需付费 |
| LLM | Ollama 本地模型 | 多 LLM（GPT-4/Claude 等） |
| 界面 | Web UI | Telegram / 飞书 / API |
| 记忆 | DeepBrain L0-L1 | 完整六层记忆系统 |
| 适合 | 个人用户、隐私敏感场景 | 企业、专业团队 |

**简单说：要零成本 + 隐私优先 → OPC Agent；要专业级 AI 员工 → [Leaper Agent](https://github.com/Deepleaper/leaper-agent)**

---

<p align="center">
  <a href="https://github.com/Deepleaper"><strong>Deepleaper 跃盟开源</strong></a><br>
  <sub>AI superpowers for everyone. 让每个人都有 AI 超能力。</sub>
</p>

<p align="center">
  ⭐ Star this repo if OPC Agent is useful to you!
</p>
