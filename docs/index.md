---
layout: home
hero:
  name: OPC Agent
  text: The Self-Evolving Agent Runtime
  tagline: Build, deploy, and evolve AI agents that learn and grow — v4.1.1
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/Deepleaper/opc-agent
features:
  - title: 🧠 Self-Evolution
    details: Agents learn from interactions, recall knowledge, and evolve over time via the learn → recall → evolve loop
  - title: 📝 OAD Schema
    details: Declarative YAML-based agent definition — model, channels, skills, workflows, brain seeds, all in one file
  - title: 🔌 25+ Channels
    details: Telegram, Slack, WeChat, Discord, Email, Voice, WhatsApp, LINE, Teams, Web, WebSocket, and more
  - title: 🤝 Agent Collaboration
    details: Multi-agent patterns — Debate, Voting, Pipeline, Hierarchy, and Shared Memory
  - title: 🛠️ Skills & Tools
    details: Extensible skill system with MCP, A2A, and AG-UI protocol support
  - title: 🚀 One-Line Install
    details: "curl -fsSL .../install.sh | bash — or npm install -g opc-agent — up and running in 60 seconds"
---

## Quick Install

::: code-group

```bash [macOS / Linux]
curl -fsSL https://raw.githubusercontent.com/nicepkg/opc-agent/main/install.sh | bash
```

```powershell [Windows]
irm https://raw.githubusercontent.com/nicepkg/opc-agent/main/install.ps1 | iex
```

```bash [npm]
npm install -g opc-agent
```

:::

## Create Your First Agent

```bash
opc init my-agent --role customer-service
cd my-agent && npm install
opc run   # Studio opens at http://localhost:4000
```

→ [Full Getting Started Guide](/guide/getting-started)
