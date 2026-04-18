<div align="center">

# 🤖 OPC Agent

**Agent OS — AI Agent 全生命周期操作系统**

[![npm](https://img.shields.io/npm/v/opc-agent)](https://www.npmjs.com/package/opc-agent)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-204_passing-green)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Version](https://img.shields.io/badge/version-2.0.0-brightgreen)]()

[快速开始](#快速开始) · [CLI 命令](#cli-命令) · [渠道](#11-个渠道) · [English](#english)

</div>

---

## 💡 一句话介绍

> **不只是 Harness，是比 Harness 高一维的 Agent OS。**
> 从创建到运行到监控，一个工具搞定 Agent 全生命周期。

## 🎯 和竞品的区别

| | LangChain | CrewAI | AutoGen | Hermes Agent | **OPC Agent** |
|---|---|---|---|---|---|
| 创建 | 写代码 | 写代码 | 写代码 | CLI | **`opc init` 一键** |
| 配置 | Python/代码 | Python | Python | YAML | **YAML 声明式** |
| 测试 | 自己搭 | 无 | 无 | 基础 | **内置测试框架** |
| 渠道 | 自己接 | 无 | 无 | 有限 | **11 渠道开箱即用** |
| 监控 | 自己搭 | 无 | 无 | 基础 | **Traces + Score** |
| 记忆 | 自己管 | 简单 | 简单 | 无 | **DeepBrain 集成** |
| 守护进程 | 无 | 无 | 无 | 无 | **`opc start/stop/status`** |
| 定时任务 | 无 | 无 | 无 | 无 | **内置 Cron 调度** |
| 技能学习 | 无 | 无 | 无 | 无 | **自主技能习得** |
| 子 Agent | 无 | 有 | 有 | 无 | **并行子 Agent 系统** |
| MCP | 无 | 无 | 无 | 无 | **MCP Client 集成** |

**框架管"怎么跑"，Agent OS 管"全过程"。**

## 快速开始

```bash
# 最快方式（无需全局安装）
npx opc-agent init my-agent
cd my-agent
npm install
opc chat

# 或全局安装
npm install -g opc-agent
opc init my-agent
cd my-agent
opc dev
```

## 🆕 v2.0.0 新特性

### 🖥️ 交互式 CLI (`opc chat`)
全功能 TUI：流式输出、斜杠命令、历史记录，直接在终端和 Agent 对话。

### 🔄 守护进程模式
```bash
opc start          # 后台启动 Agent
opc status         # 查看运行状态
opc stop           # 停止 Agent
```

### ⏰ Cron 调度器
OAD 配置中声明定时任务，Agent 自动按计划执行：
```yaml
scheduler:
  jobs:
    - cron: "0 9 * * *"
      task: daily-report
```

### 🧠 自主技能学习
Agent 从经验中自动创建和改进技能，越用越强。

### 🤖 子 Agent 系统
并行派生子 Agent 处理复杂任务，支持任务委派和结果汇总。

### 🔧 内置工具
文件操作、Web 抓取、Shell 执行、日期时间 — 开箱即用，无需额外配置。

### 🔌 MCP Client
通过 JSON-RPC 连接外部 MCP 服务器，扩展 Agent 能力边界。

### 📄 SOUL.md + CONTEXT.md
用 Markdown 定义 Agent 人格和项目上下文，人性化配置。

## OAD 声明式配置

不用写代码，用 YAML 定义 Agent：

```yaml
id: customer-service
name: 客服专员
version: "1.0.0"

model: deepseek-chat
systemPrompt: |
  你是一个专业的客服...

skills:
  - ticket-management
  - knowledge-base-search

channels:
  - type: web
    priority: primary
  - type: telegram
    priority: secondary
  - type: wechat
    priority: secondary

memory:
  shortTerm: true
  longTerm:
    provider: deepbrain
```

## CLI 命令

```bash
opc init <name>           # 创建新 Agent
opc chat                  # 交互式对话（TUI）
opc dev                   # 开发模式（热重载）
opc run                   # 生产运行
opc start                 # 守护进程启动
opc stop                  # 停止守护进程
opc status                # 查看运行状态
opc jobs                  # 查看定时任务
opc skills                # 查看已学技能
opc info                  # Agent 信息
opc build                 # 构建
opc test                  # 运行测试
opc analytics             # 数据分析
opc brain [--url ...]     # 查看记忆状态
opc logs [-f]             # 查看 Traces 日志
opc score                 # 查看性能评分
opc search <query>        # 搜索
opc deploy                # 部署
opc publish               # 发布
opc install <skill>       # 安装技能
opc plugin <name>         # 管理插件
opc tool <name>           # 管理工具
opc workflow <name>       # 工作流
opc migrate               # 迁移
```

## 11 个渠道

一套代码，部署到任意渠道：

| 渠道 | 状态 | 说明 |
|------|------|------|
| 🌐 Web | ✅ | 网页聊天 |
| 📱 Telegram | ✅ | Bot API |
| 💬 Slack | ✅ | Slack App |
| 🎮 Discord | ✅ | Discord Bot |
| 📧 Email | ✅ | IMAP/SMTP |
| 💚 微信 | ✅ | 企业微信/个人微信 |
| 🔵 飞书 | ✅ | 飞书机器人 |
| 🎤 Voice | ✅ | 语音通话 |
| 🔌 WebSocket | ✅ | 实时双向 |
| 🪝 Webhook | ✅ | HTTP 回调 |
| 📡 API | ✅ | REST API |

## 核心特性

| 类别 | 特性 |
|------|------|
| 📋 **配置** | OAD 声明式定义、YAML 配置 |
| 📡 **渠道** | 11 个渠道统一接入 |
| 🧪 **测试** | 内置测试框架、163 tests |
| 🔌 **插件** | 可扩展技能和工具系统 |
| 📊 **监控** | Traces 行为采集、Score 评分 |
| 🧠 **记忆** | DeepBrain 集成、自动学习 |
| 🌍 **国际化** | 内置 i18n 支持 |
| 🚀 **部署** | OpenClaw 等平台一键部署 |
| 📈 **分析** | Analytics 数据分析 |
| 🔄 **流式** | Streaming 实时响应 |

## 架构

```
┌─────────────────────────────────────────┐
│              OPC Agent OS                │
├──────────┬──────────┬───────────────────┤
│  创建     │  运行     │  监控              │
│ opc init │ 11 渠道   │ Traces            │
│ OAD 配置  │ 插件系统  │ Score             │
│ 测试框架  │ 流式响应  │ Analytics          │
├──────────┴──────────┴───────────────────┤
│              DeepBrain 记忆               │
│         learn ← Traces → recall          │
└─────────────────────────────────────────┘
```

## 🔗 生态

| 项目 | 定位 | 关系 |
|------|------|------|
| [deepbrain](https://github.com/Deepleaper/deepbrain) | Agent 记忆引擎 | Traces → learn() |
| **opc-agent** | Agent OS | ← 你在这里 |
| [agentkits](https://github.com/Deepleaper/agentkits) | 带记忆的 OpenRouter | 模型调用层 |
| [agent-workstation](https://github.com/Deepleaper/agent-workstation) | 虚拟工位模板 | `opc init --template` |

## License

Apache-2.0

---

<a name="english"></a>

## English

## 💡 What Is OPC Agent?

> **Not just a Harness — it's an Agent OS, one dimension above Harness frameworks.**
> From creation to runtime to monitoring, one tool for the entire Agent lifecycle.

## 🎯 How It Differs from Harness Frameworks

| | LangChain | CrewAI | AutoGen | **OPC Agent** |
|---|---|---|---|---|
| Creation | Write code | Write code | Write code | **`opc init` one command** |
| Configuration | Python/code | Python | Python | **YAML declarative** |
| Testing | DIY | None | None | **Built-in test framework** |
| Channels | DIY | None | None | **11 channels out-of-the-box** |
| Monitoring | DIY | None | None | **Traces + Score** |
| Memory | DIY | Basic | Basic | **DeepBrain integration** |

**Frameworks manage "how to run." Agent OS manages "the entire process."**

## Quick Start

```bash
# Fastest way (no global install)
npx opc-agent init my-agent
cd my-agent
npm install
opc chat

# Or install globally
npm install -g opc-agent
opc init my-agent
cd my-agent
opc dev
```

## OAD Declarative Configuration

Define your Agent with YAML — no code required:

```yaml
id: customer-service
name: Customer Service Rep
version: "1.0.0"

model: deepseek-chat
systemPrompt: |
  You are a professional customer service agent...

skills:
  - ticket-management
  - knowledge-base-search

channels:
  - type: web
    priority: primary
  - type: telegram
    priority: secondary
  - type: wechat
    priority: secondary

memory:
  shortTerm: true
  longTerm:
    provider: deepbrain
```

## CLI Commands

```bash
opc init <name>           # Create a new Agent
opc dev                   # Development mode (hot reload)
opc test                  # Run tests
opc run                   # Production run
opc logs [-f]             # View Traces logs
opc brain [--url ...]     # View memory status
opc score                 # View performance score
```

## 11 Channels

One codebase, deploy to any channel:

| Channel | Status | Description |
|---------|--------|-------------|
| 🌐 Web | ✅ | Web chat |
| 📱 Telegram | ✅ | Bot API |
| 💬 Slack | ✅ | Slack App |
| 🎮 Discord | ✅ | Discord Bot |
| 📧 Email | ✅ | IMAP/SMTP |
| 💚 WeChat | ✅ | Enterprise/Personal WeChat |
| 🔵 Feishu | ✅ | Feishu (Lark) Bot |
| 🎤 Voice | ✅ | Voice call |
| 🔌 WebSocket | ✅ | Real-time bidirectional |
| 🪝 Webhook | ✅ | HTTP callback |
| 📡 API | ✅ | REST API |

## Full Feature Set

| Category | Features |
|----------|----------|
| 📋 **Configuration** | OAD declarative definition, YAML config |
| 📡 **Channels** | 11 channels, unified access |
| 🧪 **Testing** | Built-in test framework, 204 tests |
| 🔌 **Plugins** | Extensible skills and tools system |
| 📊 **Monitoring** | Traces behavior collection, Score rating |
| 🧠 **Memory** | DeepBrain integration, auto-learning |
| 🌍 **i18n** | Built-in internationalization support |
| 🚀 **Deployment** | One-click deploy on OpenClaw and other platforms |
| 📈 **Analytics** | Data analytics |
| 🔄 **Streaming** | Real-time streaming responses |

## Architecture

```
┌─────────────────────────────────────────┐
│              OPC Agent OS                │
├──────────┬──────────┬───────────────────┤
│  Create   │  Run      │  Monitor         │
│ opc init  │ 11 Chan.  │ Traces           │
│ OAD Config│ Plugins   │ Score            │
│ Test Fwk  │ Streaming │ Analytics        │
├──────────┴──────────┴───────────────────┤
│           DeepBrain Memory               │
│         learn ← Traces → recall          │
└─────────────────────────────────────────┘
```

## 🔗 Ecosystem

| Project | Role | Relationship |
|---------|------|-------------|
| [deepbrain](https://github.com/Deepleaper/deepbrain) | Agent Memory Engine | Traces → learn() |
| **opc-agent** | Agent OS | ← You are here |
| [agentkits](https://github.com/Deepleaper/agentkits) | OpenRouter with Memory | Model call layer |
| [agent-workstation](https://github.com/Deepleaper/agent-workstation) | Virtual Role Templates | `opc init --template` |

## License

Apache-2.0
thub.com/Deepleaper/agentkits) | OpenRouter with Memory | Model call layer |
| [agent-workstation](https://github.com/Deepleaper/agent-workstation) | Virtual Role Templates | `opc init --template` |

## License

Apache-2.0
