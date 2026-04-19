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

## 🔍 与其他 Agent 框架的差异

OPC Agent 的核心设计哲学是**记忆进化 + 全渠道 + 工位模板 + 生产工具链四件套**。与大多数 Agent 框架关注"如何编排多个 Agent 对话"不同，OPC 更关注的是：一个 Agent 如何在真实生产环境中**持续进化、随处触达、开箱即用**。这决定了我们在架构选择上的一系列差异。

#### vs Hermes Agent

**设计思路差异**：Hermes 是 Python 单体框架，围绕 Nous Research 的模型生态构建，强调自学习进化和 RL 训练。OPC 是 TypeScript 模块化四件套（Brain / Agent / Channel / CLI），强调工程化和开箱即用。

**OPC 的优势**：记忆进化三件套（learn → recall → evolve 自动聚类提炼）、三层 Brain Seed 预置知识体系、25 个内置渠道（vs Hermes 16+）、100+ 工位模板、原生 A2A + AG-UI 协议支持、OpenAI 兼容 API Server。

**Hermes 的优势**：Python 生态更成熟、GRPO + LoRA 的 RL 训练管线更完善、Nous Research 社区生态更大、Docker 沙箱隔离方案更成熟。

**适合谁**：如果你需要 Python 生态和 RL 训练能力，选 Hermes；如果你需要 TypeScript 全栈、记忆进化、全渠道触达和生产工具链，选 OPC。

#### vs OpenClaw

**设计思路差异**：OpenClaw 是重量级 runtime + 配置驱动，提供完整的 Gateway 运行时环境，适合"安装一次、配置运行"的场景。OPC 是轻量 CLI + 代码优先，四件套可独立使用，适合开发者自由组合。

**OPC 的优势**：模块化四件套可按需引入、100+ 工位模板、记忆进化系统、25 个内置渠道、`opc init/dev/test/deploy` 全生命周期 CLI、A2A/AG-UI 协议支持。

**OpenClaw 的优势**：开箱即用的 runtime 体验、Puppeteer 浏览器自动化、成熟的权限和安全沙箱、配置驱动上手门槛低。

**适合谁**：如果你偏好"配置即运行"的一体化方案，选 OpenClaw；如果你偏好代码优先、模块自由组合、需要记忆进化和工位体系，选 OPC。

#### vs CrewAI

**设计思路差异**：CrewAI 采用 Crew 编排模式——定义 Agent 角色、分配 Task、按流程执行。OPC 采用工位（Seat）+ 大脑（Brain）模式——每个 Agent 有独立记忆和工位模板，通过 Brain 实现知识积累和进化。

**OPC 的优势**：记忆进化（不只是短期/长期记忆，而是自动聚类提炼）、Brain Seed 预置知识、25 个内置渠道（CrewAI 需自行接入）、100+ 工位模板、TypeScript 原生。

**CrewAI 的优势**：Crew + Flow 编排模式直观易懂、Python 生态、100K+ 用户的成熟社区、Enterprise 版本功能丰富。

**适合谁**：如果你需要多 Agent 任务编排且偏好 Python，选 CrewAI；如果你需要单 Agent 深度进化、全渠道部署、TypeScript 生态，选 OPC。

#### vs AutoGen

**设计思路差异**：AutoGen 是微软主导的对话驱动多 Agent 框架，核心是 Agent 之间的对话协作和 UserProxy 人机交互。OPC 是任务驱动的工位模式，强调单 Agent 的记忆进化和生产部署能力。

**OPC 的优势**：记忆进化系统、Brain Seed、25 个内置渠道、100+ 工位模板、全生命周期 CLI、YAML 声明式配置。

**AutoGen 的优势**：微软生态支持、分布式 Agent 能力、AutoGen Studio 可视化、UserProxy 人机交互模式成熟、Python/C# 双语言支持、社区活跃。

**适合谁**：如果你需要多 Agent 对话协作和微软生态集成，选 AutoGen；如果你需要记忆进化、全渠道触达、工位模板和 TypeScript 工具链，选 OPC。

#### 功能速查表

| 功能 | OPC Agent | Hermes Agent | OpenClaw | CrewAI | AutoGen |
|---|:-:|:-:|:-:|:-:|:-:|
| **语言** | TypeScript | Python | TypeScript | Python | Python/C# |
| **记忆进化 (evolve)** | ✅ | 🔶 | ❌ | ❌ | ❌ |
| **Brain Seed 预置知识** | ✅ 三层 | ❌ | ❌ | ❌ | ❌ |
| **内置渠道** | 25 | 16+ | 2 | ❌ | ❌ |
| **工位模板** | 100+ | ❌ | ❌ | ❌ | ❌ |
| **CLI 全生命周期** | ✅ 20+ 命令 | 🔶 | 🔶 | 🔶 | 🔶 |
| **A2A + AG-UI** | ✅ | 🔶 / ❌ | ❌ | ❌ | ❌ |
| **多 Agent 协作** | ✅ | ✅ | 🔶 | ✅ | ✅ |
| **RL 训练** | ✅ 反馈优化 | ✅ GRPO+LoRA | ❌ | ❌ | ❌ |
| **浏览器自动化** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **可视化** | ✅ OPC Studio | ✅ Dashboard | ❌ | 🔶 | ✅ Studio |
| **社区成熟度** | 🚧 早期 | ✅ 活跃 | 🚧 小众 | ✅ 大规模 | ✅ 大规模 |
| **许可证** | Apache-2.0 | MIT | MIT | Apache-2.0 | MIT |

> 对比基于各项目公开文档（截至 2026 年 4 月）。各框架都在快速迭代，如有偏差欢迎 [Issue 指正](https://github.com/Deepleaper/opc-agent/issues)。

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

## 🔍 How OPC Agent Differs from Other Frameworks

OPC Agent's core design philosophy centers on **Memory Evolution + Omnichannel + Role Templates + Production Toolchain (the "Four-Piece Suite")**. While most agent frameworks focus on "how to orchestrate multi-agent conversations," OPC focuses on how a single agent can **continuously evolve, reach users everywhere, and ship to production out of the box**. This fundamental difference drives our architectural choices.

#### vs Hermes Agent

**Design difference**: Hermes is a Python monolithic framework built around the Nous Research model ecosystem, emphasizing self-learning evolution and RL training. OPC is a TypeScript modular four-piece suite (Brain / Agent / Channel / CLI) emphasizing engineering productivity and out-of-box experience.

**Where OPC leads**: Memory evolution trilogy (learn → recall → evolve with automatic clustering), 3-tier Brain Seed knowledge system, 25 built-in channels (vs Hermes's 16+), 100+ role templates, native A2A + AG-UI protocol support, OpenAI-compatible API server.

**Where Hermes leads**: More mature Python ecosystem, battle-tested GRPO + LoRA RL training pipeline, larger Nous Research community, more mature Docker sandbox isolation.

**Best for**: Choose Hermes if you need Python ecosystem and RL training capabilities. Choose OPC if you need TypeScript full-stack, memory evolution, omnichannel reach, and production toolchain.

#### vs OpenClaw

**Design difference**: OpenClaw is a heavyweight runtime with config-driven approach — install once, configure, and run. OPC is lightweight CLI + code-first, with four independent packages you can mix and match.

**Where OPC leads**: Modular four-piece suite with independent packages, 100+ role templates, memory evolution system, 25 built-in channels, `opc init/dev/test/deploy` full-lifecycle CLI, A2A/AG-UI protocol support.

**Where OpenClaw leads**: Polished out-of-box runtime experience, Puppeteer browser automation, mature permission and security sandbox, lower barrier to entry with config-driven approach.

**Best for**: Choose OpenClaw if you prefer a "configure and run" all-in-one solution. Choose OPC if you prefer code-first, modular composition, and need memory evolution with role templates.

#### vs CrewAI

**Design difference**: CrewAI uses a Crew orchestration pattern — define agent roles, assign tasks, execute in sequence or parallel. OPC uses a Seat (workstation) + Brain model — each agent has independent memory and role templates, accumulating and evolving knowledge through Brain.

**Where OPC leads**: Memory evolution (not just short/long-term memory, but automatic clustering and distillation), Brain Seed pre-loaded knowledge, 25 built-in channels (CrewAI requires DIY), 100+ role templates, native TypeScript.

**Where CrewAI leads**: Intuitive Crew + Flow orchestration model, Python ecosystem, 100K+ user mature community, feature-rich Enterprise edition.

**Best for**: Choose CrewAI if you need multi-agent task orchestration and prefer Python. Choose OPC if you need deep single-agent evolution, omnichannel deployment, and TypeScript ecosystem.

#### vs AutoGen

**Design difference**: AutoGen is Microsoft's conversation-driven multi-agent framework, centered on agent-to-agent dialogue and UserProxy human-in-the-loop. OPC is task-driven with a workstation model, emphasizing single-agent memory evolution and production deployment.

**Where OPC leads**: Memory evolution system, Brain Seed, 25 built-in channels, 100+ role templates, full-lifecycle CLI, YAML declarative configuration.

**Where AutoGen leads**: Microsoft ecosystem support, distributed agent capabilities, AutoGen Studio visualization, mature UserProxy human-in-the-loop pattern, Python/C# dual-language support, active community.

**Best for**: Choose AutoGen if you need multi-agent conversational collaboration and Microsoft ecosystem integration. Choose OPC if you need memory evolution, omnichannel reach, role templates, and TypeScript toolchain.

#### Quick Reference Matrix

| Feature | OPC Agent | Hermes Agent | OpenClaw | CrewAI | AutoGen |
|---|:-:|:-:|:-:|:-:|:-:|
| **Language** | TypeScript | Python | TypeScript | Python | Python/C# |
| **Memory Evolution** | ✅ | 🔶 | ❌ | ❌ | ❌ |
| **Brain Seed** | ✅ 3-tier | ❌ | ❌ | ❌ | ❌ |
| **Built-in Channels** | 25 | 16+ | 2 | ❌ | ❌ |
| **Role Templates** | 100+ | ❌ | ❌ | ❌ | ❌ |
| **Full-lifecycle CLI** | ✅ 20+ cmds | 🔶 | 🔶 | 🔶 | 🔶 |
| **A2A + AG-UI** | ✅ | 🔶 / ❌ | ❌ | ❌ | ❌ |
| **Multi-Agent** | ✅ | ✅ | 🔶 | ✅ | ✅ |
| **RL Training** | ✅ Feedback opt. | ✅ GRPO+LoRA | ❌ | ❌ | ❌ |
| **Browser Automation** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Visual Dashboard** | ✅ OPC Studio | ✅ Dashboard | ❌ | 🔶 | ✅ Studio |
| **Community Maturity** | 🚧 Early | ✅ Active | 🚧 Niche | ✅ Large | ✅ Large |
| **License** | Apache-2.0 | MIT | MIT | Apache-2.0 | MIT |

> Comparison based on each project's public documentation as of April 2026. All frameworks are evolving rapidly — corrections welcome via [Issues](https://github.com/Deepleaper/opc-agent/issues).

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
