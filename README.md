<div align="center">

# 🤖 OPC Agent

### Your 100% Local AI Agent — Zero Cloud, Zero Cost, Total Privacy

### 纯本地 AI Agent — 零云依赖、零成本、完全隐私

[![PyPI version](https://img.shields.io/pypi/v/opc-agent.svg)](https://pypi.org/project/opc-agent/)
[![Downloads](https://img.shields.io/pypi/dm/opc-agent.svg)](https://pypi.org/project/opc-agent/)
[![GitHub stars](https://img.shields.io/github/stars/deepleaper/opc-agent.svg)](https://github.com/deepleaper/opc-agent/stargazers)
[![License](https://img.shields.io/badge/License-BSL--1.1-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://python.org)

[Website](https://www.deepleaper.com) · [Quick Start](#-quick-start) · [Docs](#-usage) · [vs Leaper Agent](#-opc-agent-vs-leaper-agent)

</div>

---

## ✨ Why OPC Agent? / 为什么选 OPC Agent？

**OPC Agent** is a fully local AI agent powered by [Ollama](https://ollama.com). No API keys, no cloud, no subscriptions. Your data never leaves your machine — and the agent **gets smarter** over time with built-in [DeepBrain](https://github.com/deepleaper/opc-deepbrain) memory.

- 🔒 **100% Local** — Runs entirely on your Mac, PC, or Linux. No internet required after setup.
- 💰 **Zero Cost** — No API fees, no subscriptions. Just your hardware.
- 🧠 **Self-Learning Memory** — Built-in DeepBrain 6-layer memory. Your agent remembers and evolves.
- 🛡️ **Privacy First** — Your conversations, your data, your machine. Period.
- ⚡ **Simple Setup** — `pip install` + `ollama pull` = ready to go.

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- [Ollama](https://ollama.com) installed and running

### Install & Run

```bash
# 1. Install
pip install opc-agent

# 2. Init — auto-detects your device & pulls the best model
opc init

# 3. Start!
opc start
```

`opc init` automatically:
- 🔍 **Detects your hardware** — Apple Silicon, NVIDIA GPU, AMD GPU, or CPU-only
- 📦 **Pulls the best model** — matches model size to your GPU/RAM
- 🧠 **Sets up DeepBrain** — pulls embedding model for memory search

| Your Device | Model Selected | Size |
|-------------|---------------|------|
| Mac M4 Pro 48GB | Qwen 2.5 72B | ~40GB |
| Mac M2 16GB | Qwen 2.5 14B | ~9GB |
| NVIDIA RTX 4090 24GB | Qwen 2.5 32B | ~18GB |
| NVIDIA RTX 3060 12GB | Qwen 2.5 14B | ~9GB |
| CPU only 8GB | Qwen 2.5 3B | ~2GB |

No API keys. No config files. No cloud accounts. Zero decisions required.

## 🧠 Built-in DeepBrain Memory

OPC Agent includes [DeepBrain](https://github.com/deepleaper/opc-deepbrain) — a 6-layer self-evolving knowledge engine:

```
⚡ Flash → 📝 Short-Term → 📚 Long-Term → 🏗️ Consolidated → 🗄️ Archived → 🔮 Meta
```

Your agent automatically:
- **Remembers** key facts from conversations
- **Consolidates** patterns across sessions
- **Promotes** validated knowledge to long-term storage
- **Evolves** its understanding over time

All stored in a local SQLite database. No cloud sync. No data leakage.

## 📖 Usage

```bash
# Initialize (check Ollama + models)
opc init

# Start agent (opens Web UI in browser)
opc start

# Open chat in browser (starts server if needed)
opc chat

# Check status
opc status

# Stop agent
opc stop
```

### Web UI

OPC Agent runs as a local web server with a chat UI at `http://localhost:3000`.
Features: conversation history, model switching, DeepBrain memory integration.

### Configuration

```bash
# All data stored locally
~/.opc/
```

```
~/.opc/
├── brain.db           # DeepBrain knowledge store
├── conversations.db   # Chat history
├── config.json        # Settings
└── agents/            # Agent workspaces
```

## ⚖️ OPC Agent vs Leaper Agent

| | OPC Agent | Leaper Agent |
|---|-----------|-------------|
| **LLM** | Ollama (local models) | OpenAI / Claude / Gemini |
| **Internet Required** | No | Yes (API calls) |
| **Cost** | $0 | Pay-per-token |
| **Privacy** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Model Quality** | Good (local models) | Best (GPT-4, Claude 3.5) |
| **Multi-Agent** | ❌ | ✅ |
| **Telegram Bot** | ❌ | ✅ |
| **Best For** | Privacy, offline, zero-cost | Power users, teams, integrations |

**Want cloud models?** → Check out [Leaper Agent](https://github.com/deepleaper/leaper-agent)
**在中国？** → Check out [Leaper Agent CN](https://github.com/deepleaper/leaper-agent-cn)

## 🖥️ Supported Platforms

| Platform | Status |
|----------|--------|
| macOS (Apple Silicon) | ✅ Recommended |
| macOS (Intel) | ✅ |
| Linux (x86_64) | ✅ |
| Windows 10/11 | ✅ |

## 📄 License

[BSL-1.1](LICENSE) — see LICENSE for details.

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md).

📧 Questions? [tech@deepleaper.com](mailto:tech@deepleaper.com)

---

<div align="center">

**Built with ❤️ by [Deepleaper Technology / 跃盟科技](https://www.deepleaper.com)**

*Local AI that remembers. Private AI that evolves.*

</div>

