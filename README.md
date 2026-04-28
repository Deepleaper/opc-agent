# OPC Agent

**Local-first AI Agent for Mac. Zero cloud dependency.**

One command to start. Runs entirely on your machine. Your data never leaves.

```bash
pip install opc-agent
opc start
```

## What is OPC Agent?

OPC Agent (One Personal Computer Agent) is a fully local AI agent that runs on a standard MacBook Pro or Mac Mini. It uses local LLMs via Ollama, stores memories in a local SQLite database, and provides a web UI at `localhost:3000`.

No API keys. No cloud services. No data leaving your machine.

## Features

- **Local LLM inference** via Ollama (qwen2.5, llama3, deepseek, etc.)
- **DeepBrain memory engine** — six-layer self-evolution, all running locally
- **Web UI** — chat, knowledge base, model management, workspace editor
- **40+ tools** — terminal, file operations, code execution, web search (DuckDuckGo)
- **Template system** — pre-configured AI personas (CEO Coach, Code Buddy, Writer, etc.)
- **RAM-aware** — automatically selects the best model for your hardware

## Requirements

- macOS 13+ (Apple Silicon recommended)
- Python ≥ 3.10
- 16GB+ RAM

## Quick Start

```bash
# Install
pip install opc-agent

# Start (auto-detects Ollama, downloads recommended model)
opc start

# Opens browser at localhost:3000
```

## Architecture

```
Browser (localhost:3000)
    │ WebSocket + REST
OPC Server (FastAPI)
    ├─ Chat Engine (Leaper Core)
    ├─ DeepBrain Memory (brain.db)
    ├─ Local Tools (terminal, files, code, search)
    └─ Ollama (local LLM inference)
```

Everything runs on localhost. Zero external connections required.

## License

Apache-2.0 © [Deepleaper](https://www.deepleaper.com)
