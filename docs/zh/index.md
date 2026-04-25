---
layout: home
hero:
  name: OPC Agent
  text: 自进化智能体运行时
  tagline: 构建、部署、进化会学习和成长的 AI 智能体 — v4.1.1
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/Deepleaper/opc-agent
features:
  - title: 🧠 自进化
    details: 智能体从交互中学习、回忆知识、持续进化 —— learn → recall → evolve 闭环
  - title: 📝 OAD Schema
    details: 声明式 YAML 智能体定义 —— 模型、通道、技能、工作流、知识种子，一个文件搞定
  - title: 🔌 25+ 通道
    details: Telegram、Slack、微信、Discord、邮件、语音、WhatsApp、LINE、Teams、Web 等
  - title: 🤝 多智能体协作
    details: 辩论、投票、流水线、层级、共享记忆五大协作模式
  - title: 🛠️ 技能与工具
    details: 可扩展技能系统，支持 MCP、A2A、AG-UI 协议
  - title: 🚀 一键安装
    details: "curl -fsSL .../install.sh | bash — 或 npm install -g opc-agent — 60 秒上手"
---

## 快速安装

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

## 创建你的第一个智能体

```bash
opc init my-agent --role customer-service
cd my-agent && npm install
opc run   # Studio 自动打开 http://localhost:4000
```

→ [完整入门指南](/zh/guide/getting-started)
