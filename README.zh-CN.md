<div align="center">

# ⚡ OPC Agent

**开源 AI Agent 框架 — 从终端构建、运行、进化你的 AI 智能体**

[![npm](https://img.shields.io/npm/v/opc-agent)](https://www.npmjs.com/package/opc-agent)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

[快速开始](#-快速开始) · [核心特性](#-核心特性) · [架构](#-架构) · [配置](#-配置) · [CLI 命令](#-cli-命令) · [English](README.md)

</div>

---

## 🚀 快速开始

```bash
npm install -g opc-agent
opc init
opc run
```

一键安装（自动配置 Node.js，可选 Ollama 本地模型）：

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.sh | bash

# Windows PowerShell
irm https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.ps1 | iex
```

启动后打开 **http://localhost:4000** 进入 Studio，或直接终端对话：

```bash
opc chat
```

---

## ✨ 核心特性

| | 特性 | 说明 |
|---|---|---|
| 🤖 | **53 个内置工具** | 文件、Shell、网页、浏览器、视觉、GitHub、Jira、Slack 等 |
| 🎨 | **Studio 可视化管理** | `http://localhost:4000`，一键管理 Agent |
| 💬 | **TUI 终端对话** | 流式输出、Markdown 渲染、斜杠命令 |
| 🧠 | **知识进化引擎** | 本地 Ollama 驱动，零成本知识蒸馏 |
| 📱 | **15+ 渠道接入** | Telegram、Discord、Slack、微信、邮件、WhatsApp、飞书… |
| 🔧 | **40 个内置技能** | 效率、知识、创意、开发者技能包 |
| 📋 | **OAD 声明式配置** | 一个 `oad.yaml` 定义整个 Agent |
| 🏥 | **Doctor 健康检查** | 13 项检查：模型、工具、渠道、记忆 |
| ⏰ | **定时调度** | Cron 任务 + 主动式 Agent 触发 |
| 🔌 | **MCP 协议** | Model Context Protocol 服务端和客户端 |
| 🗣️ | **语音交互** | Whisper、Azure Speech、火山引擎 STT/TTS |
| 📊 | **A2A 协议** | Google Agent-to-Agent 互操作 |

---

## 🏗️ 架构

```
┌─────────────────────────────────────────────────┐
│                    渠道层                         │
│  Telegram · Discord · Slack · 微信 · 邮件 …     │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│              OPC Agent 运行时                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ 工具执行  │  │   技能   │  │ 记忆/知识进化 │  │
│  │ (53 工具) │  │(40 技能) │  │    引擎      │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ 定时调度  │  │   语音   │  │  MCP / A2A   │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│                  模型提供商                        │
│  OpenAI · Anthropic · Ollama · Azure · Gemini   │
└─────────────────────────────────────────────────┘
```

---

## ⚙️ 配置

用一个 `oad.yaml` 文件定义 Agent：

```yaml
name: my-agent
description: 客服助手
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
    task: "检查并汇总隔夜邮件"
```

---

## 🖥️ CLI 命令

| 命令 | 说明 |
|------|------|
| `opc init [name]` | 创建新 Agent 项目 |
| `opc run` | 启动 Agent（所有已配置渠道） |
| `opc chat` | 终端交互对话 |
| `opc studio` | 启动 Studio GUI（端口 4000） |
| `opc doctor` | 运行 13 项健康检查 |
| `opc setup` | 配置模型和 API Key |
| `opc eval` | 运行评估测试 |
| `opc traces` | 查看调用链路 |
| `opc publish` | 发布 Agent 到 npm |
| `opc skill list` | 列出可用技能 |
| `opc cron list` | 列出定时任务 |

---

## 📱 渠道支持

| 渠道 | 状态 | 渠道 | 状态 |
|------|------|------|------|
| Telegram | ✅ | Discord | ✅ |
| Slack | ✅ | 微信 | ✅ |
| 邮件 (IMAP/SMTP) | ✅ | WhatsApp | ✅ |
| LINE | ✅ | Teams | ✅ |
| 飞书 | ✅ | 钉钉 | ✅ |
| Web UI | ✅ | WebSocket | ✅ |
| Webhook | ✅ | REST API | ✅ |
| 语音 | ✅ | SMS (Twilio) | ✅ |

---

## 🔧 工具（53 个）

- **核心（8）**：文件读写、Shell、网页抓取、搜索、浏览器、视觉
- **开发（12）**：Git、GitHub、npm、代码分析、测试、部署、Docker
- **效率（8）**：日历、邮件、提醒、笔记、待办、翻译
- **集成（13）**：Jira、Slack、Notion、Linear、Confluence、Trello、Asana、Zendesk、HubSpot、Salesforce
- **知识（7）**：记忆存取、知识学习/进化、RAG 查询、向量化、摘要
- **媒体（5）**：图片生成/描述、语音转文字、TTS、截图

---

## 📊 对比

| 特性 | OPC Agent | Hermes Agent | OpenClaw |
|------|-----------|-------------|----------|
| 内置工具 | 53 | ~10 | 30+ |
| GUI 管理 | ✅ | ❌ | ✅ |
| 终端对话 | ✅ | ❌ | ✅ |
| 渠道数 | 15+ | 3 | 15+ |
| 内置技能 | 40 | ❌ | 40 |
| 知识进化 | ✅ | ❌ | ✅ |
| 语音交互 | ✅ | ❌ | ✅ |
| MCP 协议 | ✅ | ✅ | ✅ |
| A2A 协议 | ✅ | ❌ | ✅ |
| 本地优先 | ✅ | ❌ | ✅ |
| 开源 | Apache-2.0 | 商业 | Apache-2.0 |

> **OPC Agent** 是开源核心运行时，**OpenClaw** 是基于它构建的完整平台。

---

## 🧠 知识进化引擎

OPC Agent 内置知识进化流水线，**完全本地运行**，使用 Ollama：

```
对话 → 学习 → 聚类 → 去重 → 蒸馏 → 进化知识
```

- **零 API 成本** — 本地 Ollama 模型驱动蒸馏
- **自动运行** — 从每次对话中学习，按计划进化
- **分层记忆** — 短期（对话）→ 长期（蒸馏）→ 进化（精炼）
- **全文搜索** — SQLite FTS5 即时检索所有记忆

```bash
opc knowledge evolve          # 手动触发进化
opc knowledge stats           # 查看知识库统计
opc knowledge search "查询"   # 搜索知识
```

---

## 🎨 Studio 可视化

```bash
opc studio
```

Studio 功能：
- **Agent 概览** — 状态、模型、渠道、工具一目了然
- **在线对话** — 浏览器中测试 Agent
- **配置编辑** — 可视化编辑 `oad.yaml`
- **日志与追踪** — 实时日志流 + OpenTelemetry 追踪
- **技能浏览器** — 发现和安装技能
- **定时任务管理** — 创建和监控 Cron 任务

---

## 🏥 Doctor 健康检查

```bash
opc doctor
```

```
✅ 模型连接正常 (ollama/llama3.1)
✅ 53/53 工具可用
✅ 记忆存储正常 (SQLite, 1,247 条)
✅ Telegram 渠道已连接
✅ 定时调度运行中 (3 个任务)
⚠️  未配置 TTS 语音
✅ 磁盘空间充足 (12.3 GB)
...
```

13 项检查覆盖：模型连接、工具状态、渠道连接、记忆健康、磁盘空间、Node.js 版本、包更新等。

---

## 🤝 参与贡献

欢迎贡献！查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

```bash
git clone https://github.com/Deepleaper/opc-agent.git
cd opc-agent
npm install
npm run build
npm test
```

---

## 📄 许可证

[Apache-2.0](LICENSE) © [Deepleaper 跃盟科技](https://github.com/Deepleaper)

---

<div align="center">

**觉得有用？给个 ⭐ 支持一下**

[GitHub](https://github.com/Deepleaper/opc-agent) · [npm](https://www.npmjs.com/package/opc-agent) · [文档](https://opc-agent.dev)

</div>
