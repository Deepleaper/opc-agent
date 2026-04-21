<div align="center">

# ⚡ OPC Agent — 瞬知 Studio

**你的 AI 劳动力，本地运行。零成本启动。**

一台电脑，一行命令，你的 AI 员工 7×24 小时上班。

[![npm](https://img.shields.io/npm/v/opc-agent)](https://www.npmjs.com/package/opc-agent)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

[快速开始](#-快速开始) · [为什么选 OPC](#-为什么选-opc) · [Studio](#-studio) · [功能](#-功能) · [架构](#-架构) · [CLI](#-命令行) · [English](README.md)

</div>

---

## 🚀 快速开始

**一行安装**（自动检测 Node.js + Ollama）：

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.sh | bash

# Windows (PowerShell)
irm https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.ps1 | iex
```

**或者 npx 免安装**：

```bash
npx opc-agent@latest init
cd my-agent
npx opc-agent studio
```

打开 `http://localhost:4000`，你的 AI 劳动力管理 Studio 就绪了。

---

## 💡 为什么选 OPC

| 痛点 | OPC 解决方案 |
|------|-------------|
| AI Agent 需要昂贵的云端 API | **Ollama 优先**：100% 本地运行，零成本 |
| 安装复杂，只有开发者能用 | **一行命令** → Studio 图形界面，不需要写代码 |
| Agent 重启后丢失记忆 | **DeepBrain**：三层持久化知识，自动进化 |
| 一个 Agent 只能做一件事 | **202 个岗位模板**，覆盖 31 个行业 |
| 没法管理多个 Agent | **Studio 仪表盘** — 创建、聊天、配置、监控 |

---

## 🎨 Studio

OPC Studio 是你管理整个 AI 劳动力的 Web 界面。

**5 大模块，一个界面：**

| 模块 | 功能 |
|------|------|
| 🧑‍💻 **OPC 助手** | 内置 AI 助理（始终置顶） |
| 🤖 **OPC Agent** | 创建 Agent、聊天、配置渠道 |
| 🧩 **AgentKits** | 模型配置 — Ollama 自动检测 + 云端 API Key |
| 🧠 **DeepBrain** | 知识库 — 拖拽上传文档，自动分类，三层浏览 |
| 🖥️ **Workstation** | 202 个岗位模板，31 个行业 — 选模板，部署 Agent |

```bash
npx opc-agent studio    # → http://localhost:4000
```

---

## ✨ 功能

### 🧠 知识进化引擎
- **三层知识体系**：行业 → 岗位 → 工位（自动向上蒸馏）
- **本地优先**：使用 Ollama 模型，零成本进化
- **记忆压缩**：对话自动蒸馏为持久化知识
- **DeepBrain**：拖拽文档，自动分类到三层

### 💬 20 个渠道
把你的 Agent 连接到用户所在的任何地方：

Telegram · Slack · Discord · 微信 · 飞书 · 邮件 · WhatsApp · Web · 语音 · IRC · Matrix · 短信 · Line · Nostr · Teams · Google Chat · 钉钉 · QQ · Twitch · Mattermost

### 🔧 53 个内置工具

| 分类 | 工具 |
|------|------|
| **核心** (8) | Shell、文件 I/O、网页抓取、搜索、浏览器、视觉、日期时间、计算器 |
| **开发** (12) | Git、GitHub、npm、代码执行、JSON、正则、文本分析… |
| **办公** (8) | 日历、邮件、Jira、Notion、Trello、Slack、摘要、翻译 |
| **集成** (13) | 数据库、PDF、CSV、Webhook、向量搜索、图片生成… |
| **知识** (7) | 记忆搜索、记忆存储、知识查询、知识学习、知识进化… |
| **媒体** (5) | 图片生成、文档处理、网页爬取、Home Assistant… |

### 🤝 协议支持
- **A2A**（Agent-to-Agent）：Google 标准 + HTTP 传输
- **MCP**（Model Context Protocol）：Anthropic 标准工具集成
- **AG-UI**：前端流式协议

### 🛡️ 企业级特性
- 沙箱执行、API Key 加密、速率限制
- 内容过滤、护栏、人机协同（HITL）
- 优先级队列 + 快速模式
- Gateway 注册中心（多 Agent 网络）

---

## 🏗️ 架构

```
┌─────────────────────────────────────┐
│        OPC Studio（管理界面）         │
├─────────────────────────────────────┤
│         OPC Agent（CLI 运行时）       │
├──────────┬──────────┬───────────────┤
│ AgentKits│ DeepBrain│  Workstation  │
│  (模型)  │  (知识)   │   (模板)      │
└──────────┴──────────┴───────────────┘
     ↕            ↕            ↕
   Ollama     SQLite/       202 岗位
   云端 API    记忆进化       31 行业
```

---

## 🖥️ 命令行

```bash
opc init                    # 创建 Agent 项目
opc run                     # 启动 Agent
opc studio                  # 打开 Studio 管理界面
opc chat                    # 终端聊天（TUI）
opc doctor                  # 健康检查（13 项）
opc memory-search <query>   # 搜索 Agent 记忆
opc skills list             # 查看可用 Skill
opc deploy                  # 部署到云端
opc publish                 # 发布到 OPC Hub
```

---

## ⚙️ 配置

Agent 通过 `oad.yaml` 定义：

```yaml
name: customer-support
description: 24小时 AI 客服
model: auto                          # 自动选择最佳模型
language: zh
channels:
  telegram:
    token: ${TELEGRAM_BOT_TOKEN}
  web:
    port: 3000
tools:
  - web-search
  - memory-search
skills:
  - customer-service
  - product-knowledge
```

---

## 🏥 健康检查

13 项自动诊断：

```bash
opc doctor
```

检查项：配置、模型连接、渠道认证、记忆持久化、工具可用性、Ollama 状态、磁盘空间、Node.js 版本等。

---

## 📊 竞品对比

| 特性 | OPC Agent | OpenClaw | Hermes Agent |
|------|-----------|----------|--------------|
| 图形管理界面 | ✅ Studio | ❌ 仅 CLI | ❌ 仅 CLI |
| 本地优先 (Ollama) | ✅ 自动检测 | ❌ 仅云端 | ⚠️ 手动 |
| 智能模型推荐 | ✅ 基于硬件 | ❌ | ❌ |
| 知识进化 | ✅ 三层 + 蒸馏 | ❌ | ⚠️ 手动 |
| 岗位模板 | ✅ 202 / 31 行业 | ❌ | ❌ |
| 内置工具 | ✅ 53 个 | ⚠️ ~20 | ⚠️ ~10 |
| 渠道 | ✅ 20 个 | ⚠️ 5 | ⚠️ 3 |
| A2A + MCP + AG-UI | ✅ 全部 | ⚠️ 仅 MCP | ❌ |
| 一行安装 | ✅ | ✅ | ❌ |
| 健康检查 | ✅ 13 项 | ❌ | ❌ |
| 记忆压缩 | ✅ 自动蒸馏 | ❌ | ❌ |

---

## 🤝 贡献

查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南。

```bash
git clone https://github.com/Deepleaper/opc-agent.git
cd opc-agent
npm install
npm run build
npm run dev
```

---

## 📄 许可证

Apache-2.0 — 详见 [LICENSE](LICENSE)。

**开源组件许可：**
- `opc-agent` / `agentkits`：Apache-2.0
- `deepbrain` / `workstation`：LGPL-3.0

---

<div align="center">

**由 [跃盟科技 Deepleaper](https://www.deepleaper.com) 构建** · 驱动 AI 劳动力革命

⭐ 如果 OPC 对你有帮助，请给我们一颗星！

</div>
