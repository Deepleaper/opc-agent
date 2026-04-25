# Getting Started

## Installation

### One-Line Install (Recommended)

::: code-group

```bash [macOS / Linux]
curl -fsSL https://raw.githubusercontent.com/nicepkg/opc-agent/main/install.sh | bash
```

```powershell [Windows]
irm https://raw.githubusercontent.com/nicepkg/opc-agent/main/install.ps1 | iex
```

:::

### Manual Install

```bash
npm install -g opc-agent
```

Verify:

```bash
opc --version
# opc-agent v4.1.1
```

## Create an Agent

### Interactive Mode

```bash
opc init my-agent
```

This launches an interactive wizard that walks you through choosing a role, model provider, and channels.

### From a Template

```bash
opc init my-agent --role customer-service
```

See all available templates:

```bash
opc init --list-roles
```

Built-in roles: `customer-service`, `sales-assistant`, `knowledge-base`, `code-reviewer`, `hr-recruiter`, `project-manager`, `content-writer`, `legal-assistant`, `financial-advisor`, `executive-assistant`, `data-analyst`, `teacher`.

## Run Your Agent

```bash
cd my-agent
npm install
opc run
```

This starts the agent runtime and automatically opens **OPC Studio** at [http://localhost:4000](http://localhost:4000).

### CLI Chat

For quick testing without the web UI:

```bash
opc chat
```

### Studio Only

To launch Studio separately:

```bash
opc studio
```

## Project Structure

After `opc init`, your project looks like:

```
my-agent/
├── oad.yaml          # Agent definition (model, channels, skills, etc.)
├── .env              # API keys and secrets
├── package.json
├── brain-seeds/      # Industry/job/workstation knowledge files
│   └── README.md
├── src/
│   └── skills/       # Custom skill implementations
│       └── example.ts
├── data/             # Runtime data (KB, memory, logs)
└── node_modules/
```

### Key Files

| File | Purpose |
|------|---------|
| `oad.yaml` | Core agent definition — model, provider, channels, skills, workflows |
| `.env` | Environment variables (API keys, secrets) |
| `brain-seeds/` | Knowledge files loaded at startup for the self-evolution system |
| `src/skills/` | Custom TypeScript/JavaScript skills |
| `data/` | Auto-created at runtime for knowledge base, memory, analytics |

## First Run: Model Setup

On first run, Studio auto-detects local [Ollama](https://ollama.ai) instances. If Ollama is running, you can start chatting immediately with local models.

For cloud providers, add your API key to `.env`:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google
GOOGLE_API_KEY=AIza...

# Azure OpenAI
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
```

Then set the provider in `oad.yaml`:

```yaml
spec:
  model: gpt-4o
  provider: openai
```

## Health Check

Verify your environment is properly configured:

```bash
opc doctor
```

This checks Node.js version, installed dependencies, API key validity, and channel connectivity.

## Next Steps

- [Core Concepts](/guide/concepts) — Understand self-evolution, OAD, brain seeds, and protocols
- [Configuration](/guide/configuration) — Full `oad.yaml` reference
- [Templates](/guide/templates) — Explore all built-in templates
- [CLI Reference](/api/cli) — Complete command reference
