# ShopBot — Customer Service Demo

A complete e-commerce customer service agent built with OPC Agent, deployable to OpenClaw.

## What's Inside

- `oad.yaml` — Full agent definition with product FAQ, order tracking, complaint handling
- Rich system prompt with personality, escalation rules, and response templates
- Telegram + Web channel configuration

## Quick Start

### 1. Install OPC Agent

```bash
npm install -g opc-agent
```

### 2. Validate the Agent

```bash
cd examples/customer-service-demo
opc info
opc build
```

### 3. Deploy to OpenClaw

**Option A: Generate workspace files**
```bash
opc deploy --target openclaw --output ./shopbot-workspace
```

This creates a complete OpenClaw agent workspace with:
- `IDENTITY.md` — Agent identity
- `SOUL.md` — System prompt and model config
- `AGENTS.md` — Skills, memory, and trust config
- `USER.md` — User preferences template
- `MEMORY.md` — Persistent memory template

**Option B: Deploy and auto-register**
```bash
opc deploy --target openclaw --install
```

This generates the workspace AND registers the agent in `~/.openclaw/openclaw.json`.

### 4. Restart OpenClaw

```bash
openclaw gateway restart
```

### 5. Test in Telegram

Send a message to your OpenClaw Telegram bot. ShopBot will respond!

Try these:
- "What headphones do you sell?"
- "Track my order TS-123456"
- "I want to return my laptop stand"
- "This is unacceptable, I want to speak to a manager"

## Architecture

```
OPC Agent (Development)          OpenClaw (Runtime)
┌─────────────────────┐         ┌──────────────────────┐
│  oad.yaml           │         │  IDENTITY.md         │
│  (agent definition) │──deploy─│  SOUL.md             │
│                     │         │  AGENTS.md           │
│  opc build/test     │         │  USER.md             │
│  opc deploy         │         │  MEMORY.md           │
└─────────────────────┘         │                      │
                                │  ← Telegram/Web →    │
                                └──────────────────────┘
```

OPC Agent is the **development framework**. OpenClaw is the **runtime**.

## Customization

Edit `oad.yaml` to:
- Change the product catalog
- Adjust escalation rules
- Add new skills
- Switch LLM provider/model
- Modify the system prompt personality

Then re-deploy: `opc deploy --target openclaw --install`
