<p align="center">
  <h1 align="center">🤖 OPC Agent</h1>
  <p align="center"><strong>开放智能体框架 — 构建、测试、运行企业级 AI 智能体</strong></p>
  <p align="center">
    <a href="https://www.npmjs.com/package/opc-agent"><img src="https://img.shields.io/npm/v/opc-agent?color=blue" alt="npm"></a>
    <a href="https://github.com/Deepleaper/opc-agent/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-green" alt="license"></a>
    <img src="https://img.shields.io/badge/tests-146%20passed-brightgreen" alt="146 tests passing">
    <a href="https://www.npmjs.com/package/opc-agent"><img src="https://img.shields.io/npm/dm/opc-agent?color=orange" alt="downloads"></a>
  </p>
  <p align="center">
    <strong>🇨🇳 中文</strong> · <a href="#english">🇺🇸 English</a>
  </p>
</p>

---

OPC Agent 是一个 **TypeScript 优先的开放智能体框架**，由 [跃盟科技 (Deepleaper)](https://www.deepleaper.com) 开发。用一个 YAML 文件（OAD）定义智能体，接入任意大语言模型，一键部署到多个渠道。

## ⚡ 快速开始（30 秒）

```bash
npm install -g opc-agent
opc init my-agent
cd my-agent
opc run
```

访问 `http://localhost:3000`，内置 Web 对话界面即刻可用。

## ✨ 功能特性

### 🔌 多模型供应商

```yaml
spec:
  provider:
    default: deepseek
    allowed: [openai, deepseek, qwen, anthropic, ollama]
  model: deepseek-chat
```

支持 **DeepSeek**、**通义千问 (Qwen)**、**OpenAI**、**Anthropic**、**Ollama**（本地），以及任何兼容 OpenAI 接口的服务。

### 📡 11 个渠道，一套代码

```yaml
spec:
  channels:
    - type: web        # Web 对话界面（内置 UI）
      port: 3000
    - type: telegram   # Telegram 机器人
    - type: websocket  # 实时 WebSocket
    - type: slack      # Slack Bot（Socket Mode / Events API）
    - type: email      # IMAP 收信 + SMTP 回信
    - type: wechat     # 微信公众号
    - type: feishu     # 飞书 / Lark 消息卡片
    - type: voice      # 语音（STT/TTS，可配置供应商）
    - type: webhook    # Webhook 接收 + HTTP 回调
    - type: discord    # Discord Bot（斜杠命令 + 线程 + Embed）
```

### 🧠 知识库（RAG）

```typescript
import { KnowledgeBase } from 'opc-agent';

const kb = new KnowledgeBase('./docs');
await kb.addFile('产品手册.pdf');
// 智能体自动检索知识库，无需额外配置
```

内置 TF-IDF 向量化 + 余弦相似度检索，数据持久化到 `.opc-knowledge.json`，无需外部向量数据库。

### 🎭 多智能体编排

```typescript
import { Orchestrator } from 'opc-agent';

const orchestrator = new Orchestrator({
  agents: [分诊智能体, 销售智能体, 客服智能体],
  strategy: 'route-by-intent',
});
```

支持顺序执行、并行执行、条件路由、智能体移交（handoff）。

### 🧪 内置测试框架

```yaml
spec:
  testing:
    cases:
      - name: 问候测试
        input: "你好"
        expect:
          contains: ["你好", "帮"]
          maxLatencyMs: 5000
```

```bash
opc test              # 运行测试用例
opc test --watch      # 监听模式
opc test --json       # JSON 格式输出
```

### 🔧 插件系统

```yaml
spec:
  plugins:
    - name: logging
    - name: analytics
    - name: rate-limit
      config: { maxPerMinute: 60 }
```

完整生命周期钩子：`onInit`、`onMessage`、`onResponse`、`onError`、`onShutdown`。

### 🔒 安全特性

- 输入消毒（防 XSS、注入攻击）
- API Key 轮换管理
- CORS 配置
- 安全响应头
- 会话隔离认证中间件

### 📊 监控与分析

Web 渠道内置以下端点：

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 健康检查 |
| `GET /api/metrics` | Prometheus 文本格式指标（uptime、请求数、错误数、LLM 延迟、Token 用量等） |
| `GET /api/dashboard` | 实时仪表盘 |

`opc analytics` 和 `opc stats` 命令可查看离线分析快照。

## 🏗️ 架构

```
┌─────────────────────────────────────────────────┐
│              OAD (YAML 定义文件)                  │
│            智能体的一切配置都在这里                  │
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  渠道层  │  │  插件层  │  │   安全层     │  │
│  │10 个渠道 │  │ 日志/分析│  │ 消毒/CORS/认证│ │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│  ┌────▼──────────────▼───────────────▼────────┐ │
│  │          智能体运行时 (Agent Runtime)        │ │
│  │   ┌─────────┐ ┌────────┐ ┌─────────────┐  │ │
│  │   │  记忆   │ │  技能  │ │   知识库     │  │ │
│  │   └─────────┘ └────────┘ └─────────────┘  │ │
│  └────────────────────┬───────────────────────┘ │
│  ┌────────────────────▼───────────────────────┐ │
│  │            大语言模型供应商                   │ │
│  │  DeepSeek · 通义千问 · OpenAI · Ollama     │ │
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

## 📋 12 个开箱即用模板

```bash
opc init my-agent --template <模板名>
```

| 模板 | 说明 | 典型场景 |
|------|------|---------|
| `customer-service` | 客服智能体 | FAQ 自动回答 + 转人工 |
| `sales-assistant` | 销售助手 | 产品问答 + 线索捕获 |
| `knowledge-base` | 知识库问答 | 文档 RAG 语义检索 |
| `code-reviewer` | 代码审查 | Bug 检测 + 风格检查 |
| `hr-recruiter` | HR 招聘助手 | 简历筛选 + 面试安排 |
| `project-manager` | 项目管理 | 任务跟踪 + 会议纪要 |
| `content-writer` | 内容创作 | 博客 + 社媒 + SEO |
| `legal-assistant` | 法务助手 | 合同审查 + 合规检查 |
| `financial-advisor` | 财务顾问 | 预算管理 + 支出追踪 |
| `executive-assistant` | 行政助理 | 日程 + 邮件 + 会议 |
| `data-analyst` | 数据分析师 | 数据查询 + 可视化 |
| `teacher` | 教学助手 | 课程设计 + 出题 |

## 🚀 部署

### Docker 部署

`opc init` 创建的每个项目都自带 `Dockerfile` 和 `docker-compose.yml`：

```bash
docker compose up -d
```

### 部署到 OpenClaw

```bash
opc deploy --target openclaw
opc deploy --target openclaw --install  # 同时写入本地配置
```

生成 `IDENTITY.md`、`SOUL.md`、`AGENTS.md` 到 `~/.openclaw/agents/{id}/workspace/`。

### 部署到 Hermes

```bash
opc deploy --target hermes
```

将 OAD 转换为 Hermes Character 格式（包含 personality、bio、lore、message examples 等字段）。

## 📖 CLI 命令参考

| 命令 | 说明 |
|------|------|
| `opc init [name]` | 创建新智能体项目（交互式，可选模板） |
| `opc create <name>` | 从模板快速创建 |
| `opc run` | 启动智能体 |
| `opc dev` | 开发模式（文件监听热重载） |
| `opc chat` | 命令行交互对话（readline 界面） |
| `opc test` | 运行 OAD 中定义的测试用例 |
| `opc build` | 校验 OAD 配置合法性 |
| `opc info` | 查看智能体信息 |
| `opc analytics` | 查看使用分析 |
| `opc stats` | 查看运行时统计快照 |
| `opc deploy` | 部署智能体（--target openclaw\|hermes） |
| `opc kb add <file>` | 向知识库添加文件 |
| `opc kb search <query>` | 搜索知识库 |
| `opc kb stats` | 知识库统计 |
| `opc kb clear` | 清空知识库 |
| `opc search` | 搜索 OPC Registry |
| `opc tool` | MCP 工具管理 |
| `opc workflow run` | 运行工作流 |
| `opc workflow list` | 列出工作流 |
| `opc version-mgmt list` | 列出历史版本 |
| `opc version-mgmt rollback` | 回滚版本 |
| `opc publish` | 打包发布智能体 |
| `opc install <pkg>` | 安装智能体包 |
| `opc plugin list` | 列出已安装插件 |
| `opc plugin add <name>` | 添加插件 |
| `opc migrate` | OAD Schema 迁移 |

## 🔗 SDK 参考

```typescript
import { AgentRuntime, KnowledgeBase, Orchestrator } from 'opc-agent';

// 启动智能体
const runtime = new AgentRuntime();
await runtime.loadConfig('oad.yaml');
await runtime.initialize();
await runtime.start();

// 知识库
const kb = new KnowledgeBase('./docs');
await kb.addFile('handbook.pdf');
const results = await kb.search('退款政策');

// 多智能体编排
const orch = new Orchestrator({
  agents: [agentA, agentB],
  strategy: 'route-by-intent',
});
```

## 🔑 OAD 配置文件速览

```yaml
apiVersion: opc/v1
kind: Agent

metadata:
  name: my-agent
  version: 1.0.0

spec:
  provider:
    default: deepseek
    allowed: [deepseek, openai, qwen, anthropic, ollama]
  model: deepseek-chat
  systemPrompt: |
    你是一个专业的客服助手...

  channels:
    - type: web
      port: 3000

  memory:
    shortTerm: true
    longTerm: false

  rateLimits:
    perUser:
      maxRequests: 60
      windowMs: 60000

  plugins:
    - name: logging
    - name: analytics

  testing:
    cases:
      - name: 基本问候
        input: "你好"
        expect:
          contains: ["你好"]
          maxLatencyMs: 5000
```

## 🤝 贡献指南

```bash
git clone https://github.com/Deepleaper/opc-agent.git
cd opc-agent
npm install
npm run build   # TypeScript 编译
npm test        # 运行 146 个测试
```

欢迎提交 Issue 和 Pull Request。

## 📄 开源协议

[Apache License 2.0](LICENSE) — 商用和开源项目均可自由使用。

---

<details>
<summary id="english">🇺🇸 English</summary>

## OPC Agent

A **TypeScript-first open agent framework** by [Deepleaper](https://www.deepleaper.com). Define your agent in a single YAML file (OAD — Open Agent Definition), connect any LLM provider, deploy to any channel.

## Quick Start

```bash
npm install -g opc-agent
opc init my-agent
cd my-agent
opc run
```

Agent is live at `http://localhost:3000` with a built-in web chat UI.

## Features

- **Multi-Provider LLM** — DeepSeek, Qwen, OpenAI, Anthropic, Ollama, any OpenAI-compatible API
- **10 Channels** — Web, Telegram, Slack, WebSocket, Email, WeChat, Feishu, Voice (STT/TTS), Webhook, Discord
- **Knowledge Base (RAG)** — TF-IDF + cosine similarity, no external vector DB required
- **Multi-Agent Orchestration** — Intent routing, sequential/parallel execution, agent handoff
- **Built-in Testing** — YAML-defined test cases with content and latency assertions
- **Plugin System** — Logging, analytics, rate limiting; full lifecycle hooks
- **Security** — Input sanitization, CORS, auth middleware, session isolation
- **Monitoring** — `/api/health`, `/api/metrics` (Prometheus format), `/api/dashboard`
- **12 Templates** — Customer service, sales, knowledge base, code review, HR, and more
- **146 Tests** — 22 test files covering all major features

## CLI Reference

| Command | Description |
|---------|-------------|
| `opc init [name]` | Create new agent project (interactive, template selection) |
| `opc run` | Start agent |
| `opc dev` | Development mode (hot-reload) |
| `opc test` | Run OAD test cases |
| `opc chat` | Interactive CLI chat |
| `opc build` | Validate OAD configuration |
| `opc deploy` | Deploy (`--target openclaw\|hermes`) |
| `opc analytics` | View analytics |
| `opc stats` | Runtime statistics snapshot |
| `opc kb add <file>` | Add file to knowledge base |
| `opc kb search <query>` | Search knowledge base |
| `opc workflow run` | Run a workflow |
| `opc version-mgmt rollback` | Rollback to a previous version |
| `opc publish` | Package agent for distribution |
| `opc install <pkg>` | Install agent package |
| `opc plugin add <name>` | Add plugin |
| `opc migrate` | Migrate OAD schema |

## Deploy

### Docker

Every project created with `opc init` includes a `Dockerfile` and `docker-compose.yml`:

```bash
docker compose up -d
```

### OpenClaw

```bash
opc deploy --target openclaw
```

Generates `IDENTITY.md`, `SOUL.md`, `AGENTS.md` into `~/.openclaw/agents/{id}/workspace/`.

### Hermes

```bash
opc deploy --target hermes
```

Converts OAD to Hermes Character format (personality, bio, lore, message examples, style guides).

## SDK

```typescript
import { AgentRuntime, KnowledgeBase, Orchestrator } from 'opc-agent';

const runtime = new AgentRuntime();
await runtime.loadConfig('oad.yaml');
await runtime.initialize();
await runtime.start();
```

## License

[Apache License 2.0](LICENSE)

---

Built with ❤️ by [Deepleaper](https://www.deepleaper.com)

</details>

---

<p align="center">由 <a href="https://www.deepleaper.com">跃盟科技 (Deepleaper)</a> 用 ❤️ 打造</p>
