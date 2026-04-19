<div align="center">

# ⚡ OPC Agent

### 内置记忆进化的 TypeScript Agent 框架

[![npm version](https://img.shields.io/badge/npm-v4.0.0-blue)](https://www.npmjs.com/package/opc-agent)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://github.com/Deepleaper/opc-agent/blob/main/LICENSE)
[![Tests](https://img.shields.io/badge/tests-1024%2B_passing-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

**你的 Agent 不该只是"能跑"——它应该能记住、能进化、能跨 25 个渠道触达用户。**

OPC Agent 是一个全生命周期 Agent 框架：从 `opc init` 创建，到 `opc chat` 对话，到 `opc studio` 可视化管理，<br>内置记忆进化引擎让 Agent **越用越聪明**，而不是每次从零开始。

[快速开始](#-快速开始) · [核心特性](#-核心特性) · [代码示例](#-代码示例) · [CLI 参考](#-cli-参考) · [English](#-english-version)

</div>

---

## 🚀 快速开始

```bash
npm install -g opc-agent
opc init my-agent --role customer-service
cd my-agent && npm install
opc chat
```

```
🤖 客服专员已就绪

You: 我的订单 #12345 什么时候发货？
Agent: 您好！订单 #12345 已于今天上午发出，预计 3 天内送达。需要我帮您查看物流详情吗？

You: 上次你帮我查的那个订单呢？
Agent: 您上次查询的订单 #12300 已签收，签收时间是 4 月 15 日下午 2 点。
       ↑ 记忆自动召回，无需重复说明
```

> Agent 自动记住每次对话、沉淀专业知识、进化应答策略。这不是 demo，这是默认行为。

---

## ✨ 核心特性

| | 特性 | 说明 |
|---|---|---|
| 🧠 | **记忆进化** | learn → recall → evolve，内置知识自动沉淀 |
| 🔧 | **20+ CLI 命令** | init / chat / run / start / studio / doctor / eval / traces / publish |
| 📡 | **25 种 Channel** | Telegram / Discord / Slack / WeChat / Feishu / Email / Web / WebSocket / Voice / Webhook / API / WhatsApp / LINE / Teams / SMS / DingTalk / Twitter / Instagram / Facebook / Signal / Matrix / XMPP / IRC / Twilio / Custom |
| 🔌 | **三大协议** | Google A2A + AG-UI + MCP（Server & Client） |
| 🎨 | **OPC Studio** | 可视化管理后台，一条命令 `opc studio` 启动 |
| 📊 | **OpenTelemetry** | 全链路追踪 + p50 / p95 / p99 延迟指标 |
| 🧪 | **内置评估** | `opc eval` 运行 24 个评估用例，量化 Agent 质量 |
| 🔍 | **RAG Pipeline** | 5 种分块策略 + 4 种重排序（通过 DeepBrain） |
| 📦 | **打包分发** | `opc publish` 一键发布到 npm |
| 🏭 | **工位模板** | 100+ 专业角色，`opc init --role` 秒级创建 |
| 🔒 | **安全全家桶** | 命令审批 + API Key 加密 + 文件/网络限制 + 沙箱隔离 |
| 🤖 | **子 Agent** | spawn / parallel / kill 多 Agent 协作 |
| 🌐 | **浏览器自动化** | Playwright 集成，网页交互、截图、数据抓取 |
| 👁️ | **Vision** | 多模态图像理解，截图分析、文档识别 |
| 🎙️ | **语音通话** | 实时语音对话，支持 TTS + STT |
| 🏠 | **Home Assistant** | 智能家居集成，控制 IoT 设备 |
| 💻 | **IDE Bridge** | VS Code / Cursor 深度集成 |
| 🔗 | **Node Network** | 多节点网络，Agent 跨设备协作 |
| 🚪 | **Gateway** | 统一网关，安全路由 + 负载均衡 |
| 🗜️ | **Context 压缩** | 智能上下文压缩，长对话不丢关键信息 |
| 🌐 | **API Server** | REST API 服务，外部系统集成 |
| 📎 | **@引用** | @mention 引用其他 Agent 或资源 |
| 📋 | **Session Manager** | 会话管理，多会话并行、历史回溯 |
| 🎯 | **RL（强化学习）** | 基于反馈的策略优化 |

---

## 🏗️ 架构

```
┌──────────────────────────────────────────────────┐
│               OPC Studio  (:4000)                │
│          可视化管理 · Agent 监控 · 对话调试         │
├────────────┬────────────┬────────────┬───────────┤
│ DeepBrain  │ AgentKits  │Workstation │ OPC Core  │
│ 🧠 记忆进化 │ 📊 统一模型 │ 👤 角色模板 │ ⚡ 运行引擎 │
│            │            │            │           │
│ learn()    │ OpenAI     │ 100+ 角色  │ 25 渠道    │
│ recall()   │ Anthropic  │ YAML 定义  │ 3 大协议   │
│ evolve()   │ Ollama     │ 技能系统   │ Cron 调度  │
│ RAG        │ DeepSeek   │ 一键创建   │ 子 Agent   │
├────────────┴────────────┴────────────┴───────────┤
│   OpenTelemetry 全链路追踪  ·  Eval 评估  ·  Traces │
└──────────────────────────────────────────────────┘
```

---

## 💻 代码示例

### 1. 最简 Agent（10 行）

```typescript
import { BaseAgent, InMemoryStore } from 'opc-agent';

const agent = new BaseAgent({
  name: 'my-agent',
  systemPrompt: 'You are a helpful assistant.',
  provider: 'ollama',
  model: 'qwen2.5',
  memory: new InMemoryStore(),
});

await agent.init();
const response = await agent.handleMessage({
  id: '1', content: 'Hello!', sender: 'user',
  channel: 'web', sessionId: 's1', timestamp: new Date(),
});
console.log(response.content);
```

### 2. 带记忆进化的 Agent

```typescript
import { AgentRuntime } from 'opc-agent';

const runtime = new AgentRuntime('./agent.yaml');
await runtime.start();
// 自动: recall(历史记忆) → respond(生成回答) → learn(沉淀知识) → evolve(进化策略)
```

### 3. 多协议 Agent（agent.yaml）

```yaml
id: smart-assistant
name: 智能助手
version: "1.0.0"
model: deepseek-chat

channels:
  - type: web
    port: 3000
  - type: telegram
    token: ${TELEGRAM_BOT_TOKEN}

protocols:
  a2a:
    enabled: true
    port: 4001
  ag-ui:
    enabled: true
    port: 4002
  mcp:
    role: both          # server + client
    port: 4003
    servers:
      - name: file-tools
        command: npx @modelcontextprotocol/server-filesystem

memory:
  shortTerm: true
  longTerm:
    provider: deepbrain
    autoEvolve: true
```

---

## 🌱 Brain Seed 自动加载

v2.1.0 起，OPC Agent 支持三层知识种子自动加载。当 `brain-seeds/` 目录存在时，Agent 首次启动自动导入行业→岗位→工位知识：

```typescript
const agent = new BaseAgent({
  name: 'my-agent',
  systemPrompt: 'You are a helpful assistant.',
  provider: 'deepseek',
  model: 'deepseek-chat',
});
agent.setLongTermMemory(brain);
// Auto-seeds on first run if brain-seeds/ directory exists
```

通过 CLI 管理知识种子：

```bash
opc brain seed              # 查看当前 brain seed 状态
opc brain seed --load       # 手动加载/重新加载种子
opc brain evolve            # 触发知识进化（工位→岗位→行业）
opc brain status            # 查看 brain 统计信息
```

---

## 📊 竞品对比 / Comparison

逐项功能对比，✅ = 支持，🔶 = 部分支持/需额外配置，❌ = 不支持

| 功能 Feature | OPC Agent | Hermes Agent | OpenClaw | CrewAI | AutoGen |
|---|:-:|:-:|:-:|:-:|:-:|
| **语言 Language** | TypeScript | Python | TypeScript | Python | Python/C# |
| **CLI 工具 (init/dev/test/deploy)** | ✅ 20+ 命令 | 🔶 基础 CLI | 🔶 基础 CLI | 🔶 CLI 有限 | 🔶 AutoGen Studio |
| **Channel 数量** | **25** 内置 | ✅ **16+** 内置 | 🔶 Telegram + Web | ❌ 需自行接入 | ❌ 需自行接入 |
| **MCP 支持** | ✅ Server + Client | ✅ Server + Client | 🔶 Client | 🔶 有集成 | 🔶 工具集成 |
| **A2A 协议** | ✅ | 🔶 Feature Request | ❌ | ❌ | ❌ |
| **AG-UI 协议** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **多 Agent 协作** | ✅ spawn/parallel | ✅ delegate_task 子 Agent | 🔶 子 Agent | ✅ Crew + Flow 编排 | ✅ 对话式协作 |
| **浏览器自动化** | ✅ Playwright | ✅ Puppeteer (text+vision) | ✅ Puppeteer | ❌ | ❌ |
| **Vision 多模态** | ✅ | ✅ 多模态分析 | ✅ | ❌ | 🔶 模型层 |
| **语音 TTS/STT** | ✅ 实时语音通话 | ✅ TTS+STT+实时语音 | ❌ | ❌ | ❌ |
| **安全沙箱** | ✅ 沙箱+审批+加密 | ✅ Docker 沙箱 | 🔶 基础权限 | 🔶 工具作用域 | 🔶 代码执行沙箱 |
| **Context 压缩** | ✅ 智能压缩 | ✅ Context Compaction | ❌ | ❌ | 🔶 对话管理 |
| **记忆 / Brain 集成** | ✅ learn/recall/evolve | ✅ 持久记忆+外部记忆 | 🔶 对话历史 | 🔶 短期+长期记忆 | 🔶 状态+记忆模块 |
| **记忆进化 (evolve)** | ✅ 自动聚类提炼 | 🔶 自学习 Skill 进化 | ❌ | ❌ | ❌ |
| **Brain Seed 预置知识** | ✅ 三层种子 | ❌ | ❌ | ❌ | ❌ |
| **插件系统** | ✅ skill/plugin/tool | ✅ Skill + Plugin 系统 | 🔶 Skill 系统 | 🔶 工具注册 | 🔶 可插拔组件 |
| **API Server (OpenAI 兼容)** | ✅ REST API | ❌ | ❌ | ❌ | ❌ |
| **评估框架** | ✅ `opc eval` 24 用例 | ✅ RL 评估管线 | ❌ | ❌ | ❌ |
| **可观测性 OpenTelemetry** | ✅ 全链路追踪 | ✅ OpenTelemetry | ❌ | 🔶 Crew Control Plane | ✅ OTel 支持 |
| **可视化管理** | ✅ OPC Studio | ✅ Web Dashboard | ❌ | 🔶 Dashboard | ✅ AutoGen Studio |
| **YAML 声明式配置** | ✅ | ✅ config.yaml | ❌ | 🔶 YAML agents/tasks | ❌ |
| **工位模板** | ✅ 100+ 角色 | ❌ | ❌ | ❌ | ❌ |
| **Home Assistant** | ✅ IoT 集成 | ✅ HA 集成 | ❌ | ❌ | ❌ |
| **IDE Bridge** | ✅ VS Code/Cursor | ❌ | ❌ | ❌ | ❌ |
| **Node Network 多节点** | ✅ 跨设备协作 | ❌ | ❌ | ❌ | ✅ 分布式 Agent |
| **Gateway 统一网关** | ✅ | ✅ 单 Gateway 多渠道 | ❌ | ❌ | ❌ |
| **强化学习 (RL)** | ✅ 反馈优化 | ✅ GRPO + LoRA 训练 | ❌ | ❌ | ❌ |
| **部署 (Docker/Cloud)** | ✅ `opc deploy` | ✅ Docker/VPS/SSH | 🔶 手动部署 | 🔶 Docker | 🔶 容器化 |
| **Human-in-the-Loop** | ✅ 命令审批 | ✅ 命令审批 | 🔶 | ✅ | ✅ UserProxy |
| **许可证 License** | Apache-2.0 | MIT | MIT | Apache-2.0 (Enterprise 付费) | MIT |
| **社区生态** | 🚧 早期项目 | ✅ Nous Research 生态 | 🚧 小众 | ✅ 100K+ 用户 | ✅ Microsoft 生态 |

**OPC Agent 独有优势**：记忆进化 (learn → recall → evolve) + 25 渠道开箱即用 + 三层 Brain Seed + 100+ 工位模板 + 全生命周期 CLI + A2A/AG-UI 协议原生支持。

各框架定位不同——Hermes Agent 强在自学习进化 + 全渠道 + RL 训练，OpenClaw 强在浏览器自动化 + 轻量部署，CrewAI 强在 Crew 编排，AutoGen 强在分布式对话。OPC Agent 的差异化在于**内置记忆进化 + 全渠道 + 生产工具链一体化 + 协议全覆盖**。

> 对比基于各项目公开文档（截至 2026 年 4 月），如有偏差欢迎 [Issue 指正](https://github.com/Deepleaper/opc-agent/issues)。

---

## 📦 四件套生态

| 包 | 功能 | 安装 |
|---|---|---|
| **[opc-agent](https://www.npmjs.com/package/opc-agent)** | Agent OS — 创建、运行、管理 | `npm i opc-agent` |
| **[deepbrain](https://www.npmjs.com/package/deepbrain)** | 组织大脑 — 记忆存储与进化 | `npm i deepbrain` |
| **[agentkits](https://www.npmjs.com/package/agentkits)** | 模型层 — 统一 API + 推荐 | `npm i agentkits` |
| **[agent-workstation](https://www.npmjs.com/package/agent-workstation)** | 工位模板 — 100+ 专业角色 | `npm i agent-workstation` |

---

## 🔧 CLI 参考

| 命令 | 说明 |
|------|------|
| `opc init <name>` | 创建新 Agent（支持 `--role` 指定角色模板） |
| `opc chat` | 交互式 TUI 对话 |
| `opc dev` | 开发模式（热重载） |
| `opc run` | 生产模式运行 |
| `opc start` | 守护进程后台启动 |
| `opc stop` | 停止守护进程 |
| `opc status` | 查看运行状态 |
| `opc studio` | 启动可视化管理后台 |
| `opc doctor` | 环境检查与诊断 |
| `opc eval` | 运行评估测试 |
| `opc test` | 运行单元测试 |
| `opc build` | 构建 Agent |
| `opc publish` | 发布到 npm |
| `opc deploy` | 部署到云端 |
| `opc logs [-f]` | 查看 Traces 日志 |
| `opc traces` | 查看全链路追踪 |
| `opc score` | 查看性能评分 |
| `opc analytics` | 数据分析面板 |
| `opc brain` | 查看记忆状态 |
| `opc brain seed` | 查看/加载三层知识种子 |
| `opc brain evolve` | 触发知识进化（工位→岗位→行业） |
| `opc brain status` | 查看 brain 详细统计 |
| `opc jobs` | 查看定时任务 |
| `opc skills` | 查看已学技能 |
| `opc search <query>` | 搜索 |
| `opc info` | Agent 信息 |
| `opc install <skill>` | 安装技能 |
| `opc plugin <name>` | 管理插件 |
| `opc tool <name>` | 管理工具 |
| `opc workflow <name>` | 工作流 |
| `opc migrate` | 迁移 |

---

## 🔌 协议支持

| 协议 | 角色 | 说明 |
|------|------|------|
| **[Google A2A](https://google.github.io/A2A/)** | Server + Client | Agent-to-Agent 互操作，发现/调用其他 Agent |
| **[AG-UI](https://ag-ui.com/)** | Server | Agent-to-UI 流式协议，前端实时渲染 Agent 状态 |
| **[MCP](https://modelcontextprotocol.io/)** | Server + Client | 连接外部工具服务器，也可作为工具提供方 |

---

## 📡 25 种 Channel

| 渠道 | 状态 | 说明 |
|------|:----:|------|
| 🌐 Web | ✅ | 网页聊天组件 |
| 📱 Telegram | ✅ | Bot API |
| 💬 Slack | ✅ | Slack App |
| 🎮 Discord | ✅ | Discord Bot |
| 📧 Email | ✅ | IMAP / SMTP |
| 💚 WeChat | ✅ | 企业微信 / 个人微信 |
| 🔵 Feishu | ✅ | 飞书机器人 |
| 🎤 Voice | ✅ | 语音通话（TTS + STT） |
| 🔌 WebSocket | ✅ | 实时双向通信 |
| 🪝 Webhook | ✅ | HTTP 回调 |
| 📡 REST API | ✅ | HTTP API |
| 💬 WhatsApp | ✅ | WhatsApp Business API |
| 🟢 LINE | ✅ | LINE Messaging API |
| 🟣 Teams | ✅ | Microsoft Teams Bot |
| 📲 SMS | ✅ | Twilio / 云通信 |
| 🔷 DingTalk | ✅ | 钉钉机器人 |
| 🐦 Twitter/X | ✅ | DM + Mentions |
| 📸 Instagram | ✅ | Instagram DM |
| 📘 Facebook | ✅ | Messenger API |
| 🔐 Signal | ✅ | Signal Bot |
| 🟩 Matrix | ✅ | Matrix 协议 |
| 💬 XMPP | ✅ | Jabber/XMPP |
| 💻 IRC | ✅ | IRC 协议 |
| 📞 Twilio | ✅ | 电话 / IVR |
| 🔧 Custom | ✅ | 自定义渠道适配器 |

---

## 🤝 贡献

欢迎贡献！请查看 [Contributing Guide](CONTRIBUTING.md)。

```bash
git clone https://github.com/Deepleaper/opc-agent.git
cd opc-agent
npm install
npm run build
npm test
```

---

## 📄 License

[Apache-2.0](LICENSE) © [Deepleaper](https://github.com/Deepleaper)

---

---

<a name="english-version"></a>

<div align="center">

# ⚡ OPC Agent

### TypeScript Agent Framework with Built-in Memory Evolution

[![npm version](https://img.shields.io/badge/npm-v4.0.0-blue)](https://www.npmjs.com/package/opc-agent)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://github.com/Deepleaper/opc-agent/blob/main/LICENSE)
[![Tests](https://img.shields.io/badge/tests-1024%2B_passing-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

**Your Agent shouldn't just "run" — it should remember, evolve, and reach users across 25 channels.**

OPC Agent is a full-lifecycle Agent framework: from `opc init` to create, `opc chat` to converse, `opc studio` to manage visually.<br>The built-in memory evolution engine makes your Agent **smarter over time**, instead of starting from scratch every session.

[Quick Start](#-quick-start) · [Features](#-features) · [Code Examples](#-code-examples-1) · [CLI Reference](#-cli-reference-1)

</div>

---

## 🚀 Quick Start

```bash
npm install -g opc-agent
opc init my-agent --role customer-service
cd my-agent && npm install
opc chat
```

```
🤖 Customer Service Agent ready

You: When will my order #12345 ship?
Agent: Hi! Order #12345 shipped this morning and should arrive within 3 days. Want me to check the tracking details?

You: What about the order you looked up last time?
Agent: Your previous order #12300 was delivered on April 15th at 2 PM.
       ↑ Memory auto-recalled — no need to repeat context
```

> The Agent automatically remembers every conversation, distills domain knowledge, and evolves its response strategy. This isn't a demo — it's the default behavior.

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🧠 | **Memory Evolution** | learn → recall → evolve — built-in automatic knowledge distillation |
| 🔧 | **20+ CLI Commands** | init / chat / run / start / studio / doctor / eval / traces / publish |
| 📡 | **25 Channels** | Telegram / Discord / Slack / WeChat / Feishu / Email / Web / WebSocket / Voice / Webhook / API / WhatsApp / LINE / Teams / SMS / DingTalk / Twitter / Instagram / Facebook / Signal / Matrix / XMPP / IRC / Twilio / Custom |
| 🔌 | **3 Protocols** | Google A2A + AG-UI + MCP (Server & Client) |
| 🎨 | **OPC Studio** | Visual management dashboard — one command `opc studio` |
| 📊 | **OpenTelemetry** | Full distributed tracing + p50 / p95 / p99 latency metrics |
| 🧪 | **Built-in Eval** | `opc eval` with 24 evaluation test cases for quantifying Agent quality |
| 🔍 | **RAG Pipeline** | 5 chunking strategies + 4 rerankers (via DeepBrain) |
| 📦 | **Package & Publish** | `opc publish` — one command to publish to npm |
| 🏭 | **Role Templates** | 100+ professional roles, `opc init --role` for instant creation |
| 🔒 | **Security Suite** | Command approval + API Key encryption + file/network restrictions + sandboxing |
| 🤖 | **Sub-Agents** | spawn / parallel / kill for multi-Agent collaboration |
| 🌐 | **Browser Automation** | Playwright integration — web interaction, screenshots, data scraping |
| 👁️ | **Vision** | Multimodal image understanding — screenshot analysis, document recognition |
| 🎙️ | **Voice Call** | Real-time voice conversation with TTS + STT |
| 🏠 | **Home Assistant** | Smart home integration, IoT device control |
| 💻 | **IDE Bridge** | Deep integration with VS Code / Cursor |
| 🔗 | **Node Network** | Multi-node network, cross-device Agent collaboration |
| 🚪 | **Gateway** | Unified gateway with secure routing + load balancing |
| 🗜️ | **Context Compression** | Smart context compression — keep key info in long conversations |
| 🌐 | **API Server** | REST API server for external system integration |
| 📎 | **@Mention** | @mention other Agents or resources |
| 📋 | **Session Manager** | Multi-session parallel, history rollback |
| 🎯 | **RL (Reinforcement Learning)** | Feedback-based strategy optimization |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────┐
│               OPC Studio  (:4000)                │
│       Visual Management · Monitoring · Debug      │
├────────────┬────────────┬────────────┬───────────┤
│ DeepBrain  │ AgentKits  │Workstation │ OPC Core  │
│ 🧠 Memory  │ 📊 Models  │ 👤 Roles   │ ⚡ Engine  │
│            │            │            │           │
│ learn()    │ OpenAI     │ 100+ roles │ 25 chan.  │
│ recall()   │ Anthropic  │ YAML def.  │ 3 proto.  │
│ evolve()   │ Ollama     │ Skill sys. │ Cron sched│
│ RAG        │ DeepSeek   │ One-click  │ Sub-Agent │
├────────────┴────────────┴────────────┴───────────┤
│   OpenTelemetry Tracing  ·  Eval  ·  Traces      │
└──────────────────────────────────────────────────┘
```

---

## 💻 Code Examples

### 1. Minimal Agent (10 lines)

```typescript
import { BaseAgent, InMemoryStore } from 'opc-agent';

const agent = new BaseAgent({
  name: 'my-agent',
  systemPrompt: 'You are a helpful assistant.',
  provider: 'ollama',
  model: 'qwen2.5',
  memory: new InMemoryStore(),
});

await agent.init();
const response = await agent.handleMessage({
  id: '1', content: 'Hello!', sender: 'user',
  channel: 'web', sessionId: 's1', timestamp: new Date(),
});
console.log(response.content);
```

### 2. Agent with Memory Evolution

```typescript
import { AgentRuntime } from 'opc-agent';

const runtime = new AgentRuntime('./agent.yaml');
await runtime.start();
// Auto: recall(history) → respond(generate) → learn(distill) → evolve(improve)
```

### 3. Multi-Protocol Agent (agent.yaml)

```yaml
id: smart-assistant
name: Smart Assistant
version: "1.0.0"
model: deepseek-chat

channels:
  - type: web
    port: 3000
  - type: telegram
    token: ${TELEGRAM_BOT_TOKEN}

protocols:
  a2a:
    enabled: true
    port: 4001
  ag-ui:
    enabled: true
    port: 4002
  mcp:
    role: both          # server + client
    port: 4003
    servers:
      - name: file-tools
        command: npx @modelcontextprotocol/server-filesystem

memory:
  shortTerm: true
  longTerm:
    provider: deepbrain
    autoEvolve: true
```

---

## 🌱 Brain Seed Auto-Loading

Since v2.1.0, OPC Agent supports automatic 3-tier knowledge seed loading. When a `brain-seeds/` directory exists, the Agent auto-imports industry → job → workstation knowledge on first run:

```typescript
const agent = new BaseAgent({
  name: 'my-agent',
  systemPrompt: 'You are a helpful assistant.',
  provider: 'deepseek',
  model: 'deepseek-chat',
});
agent.setLongTermMemory(brain);
// Auto-seeds on first run if brain-seeds/ directory exists
```

Manage brain seeds via CLI:

```bash
opc brain seed              # View current brain seed status
opc brain seed --load       # Manually load/reload seeds
opc brain evolve            # Trigger knowledge evolution (workstation → job → industry)
opc brain status            # View brain statistics
```

---

## 📊 Comparison

Feature-by-feature comparison. ✅ = Supported, 🔶 = Partial/requires config, ❌ = Not supported

| Feature | OPC Agent | CrewAI | AutoGen | Mastra | Google ADK | OpenAI Agents SDK | OpenClaw |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Language** | TypeScript | Python | Python/C# | TypeScript | Python/Java/Go/TS | Python (TS planned) | TypeScript |
| **CLI Tools (init/dev/test/deploy)** | ✅ 20+ cmds | 🔶 Limited CLI | 🔶 AutoGen Studio | 🔶 Partial | 🔶 `adk` CLI | ❌ | 🔶 Basic CLI |
| **Built-in Channels** | **25** | ❌ DIY | ❌ DIY | ❌ DIY | ❌ DIY | ❌ DIY | 🔶 Telegram + Web |
| **MCP Support** | ✅ Server + Client | 🔶 Integration | 🔶 Tool integration | 🔶 Client | ✅ Native | ❌ | 🔶 Client |
| **A2A Protocol** | ✅ | ❌ | ❌ | ❌ | ✅ Native | ❌ | ❌ |
| **AG-UI Protocol** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Multi-Agent** | ✅ spawn/parallel | ✅ Crew + Flow | ✅ Conversational | 🔶 Agent Network | ✅ Hierarchical | ✅ Handoff | 🔶 Sub-agents |
| **Browser Automation** | ✅ Playwright | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Puppeteer |
| **Vision / Multimodal** | ✅ | ❌ | 🔶 Model-level | 🔶 Model-level | ✅ Native multimodal | 🔶 Model-level | ✅ |
| **Voice TTS/STT** | ✅ Real-time voice | ❌ | ❌ | ✅ Native Voice | 🔶 Model-level | ❌ | ❌ |
| **Security Sandbox** | ✅ Sandbox+approval+encryption | 🔶 Tool scoping | 🔶 Code sandbox | ❌ | 🔶 Cloud Run isolation | ✅ Native sandbox | 🔶 Basic perms |
| **Context Compression** | ✅ Smart compression | ❌ | 🔶 Conversation mgmt | ❌ | ✅ Compaction + Cache | 🔶 Memory mgmt | ❌ |
| **Memory / Brain** | ✅ learn/recall/evolve | 🔶 Short+long-term | 🔶 State + memory | 🔶 Working + Semantic | ✅ Artifact memory | 🔶 Short+long-term | 🔶 Chat history |
| **Memory Evolution** | ✅ Auto-clustering | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Brain Seed** | ✅ 3-tier seeds | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Plugin System** | ✅ skill/plugin/tool | 🔶 Tool registry | 🔶 Pluggable components | 🔶 Tool system | ✅ Rich tool ecosystem | 🔶 AgentKit | 🔶 Skills |
| **API Server (OpenAI-compatible)** | ✅ REST API | ❌ | ❌ | ❌ | 🔶 Cloud Run | ❌ (OpenAI native) | ❌ |
| **Eval Framework** | ✅ `opc eval` 24 cases | ❌ | ❌ | ✅ Built-in eval | ✅ Built-in eval | ✅ Evals framework | ❌ |
| **OpenTelemetry** | ✅ Full tracing | 🔶 Control Plane | ✅ OTel support | ✅ Tracing + monitoring | ✅ Multi-platform | ✅ Tracing primitive | ❌ |
| **Visual Dashboard** | ✅ OPC Studio | 🔶 Dashboard | ✅ AutoGen Studio | ✅ Mastra Studio | ✅ Dev UI | ✅ AgentKit Builder | ❌ |
| **YAML Declarative** | ✅ | 🔶 YAML agents/tasks | ❌ | ❌ | 🔶 Config specs | ❌ | ❌ |
| **Role Templates** | ✅ 100+ roles | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Home Assistant** | ✅ IoT | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **IDE Bridge** | ✅ VS Code/Cursor | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Node Network** | ✅ Multi-node | ❌ | ✅ Distributed | ❌ | ❌ | ❌ | ❌ |
| **Gateway** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Reinforcement Learning** | ✅ Feedback optimization | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Deployment** | ✅ `opc deploy` | 🔶 Docker | 🔶 Containers | ✅ Docker/Serverless | ✅ Cloud Run/Vertex | 🔶 Python deploy | 🔶 Manual |
| **Human-in-the-Loop** | ✅ Command approval | ✅ | ✅ UserProxy | ✅ Suspend/Resume | ✅ HITL confirmation | ✅ Guardrails | 🔶 |
| **License** | Apache-2.0 | Apache-2.0 (Enterprise paid) | MIT | Elastic-2.0 | Apache-2.0 | MIT | MIT |
| **Community** | 🚧 Early-stage | ✅ 100K+ users | ✅ Microsoft ecosystem | ✅ Active community | ✅ Google ecosystem | ✅ OpenAI ecosystem | 🚧 Niche |

**OPC Agent's unique strengths**: Memory Evolution (learn → recall → evolve) + 25 channels out-of-box + 3-tier Brain Seeds + 100+ role templates + full-lifecycle CLI.

Each framework has a different focus — CrewAI excels at Crew orchestration, AutoGen at distributed conversations, Mastra for TS full-stack, Google ADK deeply integrated with GCP, OpenAI SDK tightly coupled with OpenAI models. OPC Agent differentiates with **built-in memory evolution + omnichannel + integrated production toolchain**.

> Comparison based on each project's public documentation as of April 2026. Corrections welcome via [Issues](https://github.com/Deepleaper/opc-agent/issues).

---

## 📦 Ecosystem

| Package | Purpose | Install |
|---|---|---|
| **[opc-agent](https://www.npmjs.com/package/opc-agent)** | Agent OS — create, run, manage | `npm i opc-agent` |
| **[deepbrain](https://www.npmjs.com/package/deepbrain)** | Org Brain — memory storage & evolution | `npm i deepbrain` |
| **[agentkits](https://www.npmjs.com/package/agentkits)** | Model Layer — unified API + routing | `npm i agentkits` |
| **[agent-workstation](https://www.npmjs.com/package/agent-workstation)** | Role Templates — 100+ professional roles | `npm i agent-workstation` |

---

## 🔧 CLI Reference

| Command | Description |
|---------|-------------|
| `opc init <name>` | Create a new Agent (supports `--role` for role templates) |
| `opc chat` | Interactive TUI conversation |
| `opc dev` | Development mode (hot reload) |
| `opc run` | Production run |
| `opc start` | Daemon mode (background) |
| `opc stop` | Stop daemon |
| `opc status` | View running status |
| `opc studio` | Launch visual management dashboard |
| `opc doctor` | Environment check & diagnostics |
| `opc eval` | Run evaluation tests |
| `opc test` | Run unit tests |
| `opc build` | Build Agent |
| `opc publish` | Publish to npm |
| `opc deploy` | Deploy to cloud |
| `opc logs [-f]` | View Traces logs |
| `opc traces` | View distributed traces |
| `opc score` | View performance score |
| `opc analytics` | Analytics dashboard |
| `opc brain` | View memory status |
| `opc brain seed` | View/load 3-tier knowledge seeds |
| `opc brain evolve` | Trigger knowledge evolution (workstation → job → industry) |
| `opc brain status` | View brain detailed statistics |
| `opc jobs` | View scheduled tasks |
| `opc skills` | View learned skills |
| `opc search <query>` | Search |
| `opc info` | Agent info |
| `opc install <skill>` | Install a skill |
| `opc plugin <name>` | Manage plugins |
| `opc tool <name>` | Manage tools |
| `opc workflow <name>` | Workflows |
| `opc migrate` | Migration |

---

## 🔌 Protocol Support

| Protocol | Role | Description |
|----------|------|-------------|
| **[Google A2A](https://google.github.io/A2A/)** | Server + Client | Agent-to-Agent interop — discover and invoke other Agents |
| **[AG-UI](https://ag-ui.com/)** | Server | Agent-to-UI streaming protocol — real-time frontend rendering |
| **[MCP](https://modelcontextprotocol.io/)** | Server + Client | Connect to external tool servers or serve as a tool provider |

---

## 📡 25 Channels

| Channel | Status | Description |
|---------|:------:|-------------|
| 🌐 Web | ✅ | Web chat widget |
| 📱 Telegram | ✅ | Bot API |
| 💬 Slack | ✅ | Slack App |
| 🎮 Discord | ✅ | Discord Bot |
| 📧 Email | ✅ | IMAP / SMTP |
| 💚 WeChat | ✅ | Enterprise / Personal WeChat |
| 🔵 Feishu | ✅ | Feishu (Lark) Bot |
| 🎤 Voice | ✅ | Voice call (TTS + STT) |
| 🔌 WebSocket | ✅ | Real-time bidirectional |
| 🪝 Webhook | ✅ | HTTP callback |
| 📡 REST API | ✅ | HTTP API |
| 💬 WhatsApp | ✅ | WhatsApp Business API |
| 🟢 LINE | ✅ | LINE Messaging API |
| 🟣 Teams | ✅ | Microsoft Teams Bot |
| 📲 SMS | ✅ | Twilio / Cloud messaging |
| 🔷 DingTalk | ✅ | DingTalk Bot |
| 🐦 Twitter/X | ✅ | DM + Mentions |
| 📸 Instagram | ✅ | Instagram DM |
| 📘 Facebook | ✅ | Messenger API |
| 🔐 Signal | ✅ | Signal Bot |
| 🟩 Matrix | ✅ | Matrix protocol |
| 💬 XMPP | ✅ | Jabber/XMPP |
| 💻 IRC | ✅ | IRC protocol |
| 📞 Twilio | ✅ | Phone / IVR |
| 🔧 Custom | ✅ | Custom channel adapter |

---

## 🤝 Contributing

Contributions welcome! See [Contributing Guide](CONTRIBUTING.md).

```bash
git clone https://github.com/Deepleaper/opc-agent.git
cd opc-agent
npm install
npm run build
npm test
```

---

## 📄 License

[Apache-2.0](LICENSE) © [Deepleaper](https://github.com/Deepleaper)
