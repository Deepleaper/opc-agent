<p align="center">
  <h1 align="center">🤖 OPC Agent</h1>
  <p align="center"><strong>开放智能体框架 — 构建、测试、运行企业级 AI 智能体</strong></p>
  <p align="center"><strong>Open Agent Framework — Build, test, and run AI Agents for business workstations</strong></p>
  <p align="center">
    <a href="https://www.npmjs.com/package/opc-agent"><img src="https://img.shields.io/npm/v/opc-agent?color=blue" alt="npm"></a>
    <a href="https://github.com/Deepleaper/opc-agent/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-green" alt="license"></a>
    <a href="https://github.com/Deepleaper/opc-agent/actions"><img src="https://img.shields.io/badge/tests-passing-brightgreen" alt="tests"></a>
    <a href="https://www.npmjs.com/package/opc-agent"><img src="https://img.shields.io/npm/dm/opc-agent?color=orange" alt="downloads"></a>
  </p>
  <p align="center">
    <a href="#-中文文档">🇨🇳 中文</a> · <a href="#-english-documentation">🇺🇸 English</a> · <a href="./README.zh-CN.md">完整中文文档</a>
  </p>
</p>

---

# 🇨🇳 中文文档

OPC Agent 是一个 **TypeScript 优先的开放智能体框架**，由[跃盟科技 (Deepleaper)](https://www.deepleaper.com) 开发。用一个 YAML 文件定义智能体，接入任意大语言模型，一键部署到多个渠道。开箱即用，生产可用。

## ⚡ 快速开始（30 秒）

```bash
# 安装
npm install -g opc-agent

# 创建你的第一个智能体
opc init my-agent
cd my-agent

# 启动
opc run
```

智能体已在 `http://localhost:3000` 上运行，自带 Web 对话界面。

## ✨ 功能特性

### 🔌 多模型供应商

```yaml
# oad.yaml — 智能体定义文件
spec:
  provider:
    default: deepseek
    allowed: [openai, deepseek, qwen, anthropic, ollama]
  model: deepseek-chat
```

支持 **DeepSeek**、**通义千问 (Qwen)**、**OpenAI**、**Anthropic**、**Ollama**（本地部署），以及任何兼容 OpenAI 接口的服务。

### 📡 多渠道部署

```yaml
spec:
  channels:
    - type: web        # Web 对话界面
      port: 3000
    - type: telegram   # Telegram 机器人
    - type: websocket  # 实时 WebSocket
    - type: slack      # Slack 集成
    - type: email      # 邮件渠道
    - type: wechat     # 微信公众号
    - type: feishu     # 飞书
    - type: voice      # 语音（STT/TTS）
    - type: webhook    # Webhook 回调
```

### 🧠 知识库（RAG）

```typescript
import { KnowledgeBase } from 'opc-agent';

const kb = new KnowledgeBase('./docs');
await kb.addFile('产品手册.pdf');
// 智能体自动使用知识库增强回答
```

### 🎭 多智能体编排

```typescript
import { Orchestrator } from 'opc-agent';

const orchestrator = new Orchestrator({
  agents: [分诊智能体, 销售智能体, 客服智能体],
  strategy: 'route-by-intent', // 按意图路由
});
```

### 🧪 内置测试框架

```bash
opc test              # 运行测试用例
opc test --watch      # 监听模式
```

```yaml
# 在 oad.yaml 中定义测试
spec:
  testing:
    cases:
      - name: 问候测试
        input: "你好"
        expect:
          contains: ["你好", "帮"]
          maxLatencyMs: 5000
```

### 🔧 插件系统

```yaml
spec:
  plugins:
    - name: logging      # 日志
    - name: analytics    # 数据分析
    - name: rate-limit   # 限流
      config: { maxPerMinute: 60 }
```

### 🔒 安全特性

- 输入消毒（防 XSS、注入攻击）
- API Key 轮换管理
- CORS 配置
- 安全响应头
- 会话隔离的认证中间件

### 📊 监控与分析

- `/api/health` — 健康检查
- `/api/metrics` — Prometheus 兼容指标
- `/api/dashboard` — 实时仪表盘
- 对话导出（JSON / Markdown / CSV）

## 🏗️ 架构

```
┌─────────────────────────────────────────────────┐
│                OAD (YAML 定义文件)                │
│              智能体定义与配置                      │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  渠道层  │  │  插件层  │  │   安全层     │  │
│  │ Web, TG, │  │  日志,   │  │  消毒,       │  │
│  │ WS,Slack │  │  分析    │  │  CORS, 认证  │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │           │
│  ┌────▼──────────────▼───────────────▼────────┐ │
│  │            智能体运行时 (Runtime)            │ │
│  │   ┌─────────┐ ┌────────┐ ┌─────────────┐  │ │
│  │   │  记忆   │ │  技能  │ │   知识库     │  │ │
│  │   └─────────┘ └────────┘ └─────────────┘  │ │
│  └────────────────────┬───────────────────────┘ │
│                       │                          │
│  ┌────────────────────▼───────────────────────┐ │
│  │            大语言模型供应商                   │ │
│  │  DeepSeek · 通义千问 · OpenAI · Ollama     │ │
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

## 📋 模板列表

| 模板 | 说明 | 适用场景 |
|------|------|---------|
| `customer-service` | 客服智能体 | FAQ 查询 + 人工转接 |
| `sales-assistant` | 销售助手 | 产品问答 + 线索捕获 |
| `knowledge-base` | 知识库问答 | RAG 语义检索 |
| `code-reviewer` | 代码审查 | Bug 检测 + 风格检查 |
| `hr-recruiter` | HR 招聘助手 | 简历筛选 + 面试安排 |
| `project-manager` | 项目管理 | 任务跟踪 + 会议纪要 |
| `content-writer` | 内容创作 | 博客 + 社媒 + SEO |
| `legal-assistant` | 法务助手 | 合同审查 + 合规检查 |
| `financial-advisor` | 财务顾问 | 预算管理 + 支出追踪 |
| `executive-assistant` | 行政助理 | 日程 + 邮件 + 会议 |
| `data-analyst` | 数据分析师 | 数据查询 + 可视化 |
| `teacher` | 教学助手 | 课程设计 + 出题 |

## 🚀 部署指南

### Docker 部署

```bash
# 每个 opc init 项目自带 Dockerfile
docker compose up -d
```

### 部署到 OpenClaw

```bash
opc deploy --target openclaw
```

### 部署到 Hermes 云

```bash
opc deploy --target hermes
```

## 📖 CLI 命令参考

| 命令 | 说明 |
|------|------|
| `opc init [name]` | 创建新智能体项目 |
| `opc run` | 启动智能体 |
| `opc dev` | 开发模式（热重载） |
| `opc test` | 运行测试用例 |
| `opc chat` | 命令行交互对话 |
| `opc build` | 校验 OAD 配置 |
| `opc deploy` | 部署智能体 |
| `opc analytics` | 查看数据分析 |
| `opc kb add <file>` | 添加知识库文件 |
| `opc kb search <query>` | 搜索知识库 |

## 🔗 API 参考

```typescript
import { AgentRuntime, KnowledgeBase, Orchestrator } from 'opc-agent';

// 启动智能体
const runtime = new AgentRuntime();
await runtime.loadConfig('oad.yaml');
await runtime.initialize();
await runtime.start();
```

详细 API 文档请查看 [SDK 参考](https://deepleaper.github.io/opc-agent/api/sdk)。

## 🤝 贡献指南

欢迎参与贡献！

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feat/my-feature`
3. 编写代码和测试
4. 运行测试：`npm test`
5. 提交 Pull Request

### 本地开发

```bash
git clone https://github.com/Deepleaper/opc-agent.git
cd opc-agent
npm install
npm run build
npm test
```

---

# 🇺🇸 English Documentation

OPC Agent is a **TypeScript-first framework** for building production AI agents by [Deepleaper](https://www.deepleaper.com). Define your agent in a single YAML file (OAD — Open Agent Definition), connect any LLM provider, deploy to any channel.

## ⚡ Quick Start (30 seconds)

```bash
# Install
npm install -g opc-agent

# Create your first agent
opc init my-agent
cd my-agent

# Run it
opc run
```

Your agent is now live at `http://localhost:3000` with a beautiful web chat UI.

## ✨ Features

- 🔌 **Multi-Provider LLM** — DeepSeek, Qwen, OpenAI, Anthropic, Ollama, any OpenAI-compatible API
- 📡 **Multi-Channel** — Web, Telegram, Slack, WebSocket, Email, WeChat, Feishu, Voice, Webhook
- 🧠 **Knowledge Base (RAG)** — Add files, auto-retrieve for context
- 🎭 **Multi-Agent Orchestration** — Route by intent, compose agent teams
- 🧪 **Built-in Testing** — YAML-defined test cases, latency assertions
- 🔧 **Plugin System** — Logging, analytics, rate limiting, custom hooks
- 🔒 **Security** — Input sanitization, CORS, auth, session isolation
- 📊 **Analytics & Monitoring** — Health checks, Prometheus metrics, real-time dashboard
- 📋 **12 Templates** — Customer service, sales, knowledge base, code review, and more

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   OAD (YAML)                     │
│          Agent Definition & Config               │
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Channels │  │ Plugins  │  │   Security   │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│  ┌────▼──────────────▼───────────────▼────────┐ │
│  │              Agent Runtime                  │ │
│  │   ┌─────────┐ ┌────────┐ ┌─────────────┐  │ │
│  │   │ Memory  │ │ Skills │ │  Knowledge   │  │ │
│  │   └─────────┘ └────────┘ └─────────────┘  │ │
│  └────────────────────┬───────────────────────┘ │
│  ┌────────────────────▼───────────────────────┐ │
│  │            LLM Providers                    │ │
│  │  DeepSeek · Qwen · OpenAI · Anthropic      │ │
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

## 📖 CLI Reference

| Command | Description |
|---------|-------------|
| `opc init [name]` | Create a new agent project |
| `opc run` | Start the agent |
| `opc dev` | Development mode (hot-reload) |
| `opc test` | Run agent test cases |
| `opc chat` | Interactive CLI chat |
| `opc build` | Validate OAD configuration |
| `opc deploy` | Deploy agent |
| `opc analytics` | View analytics |
| `opc kb add <file>` | Add knowledge base file |
| `opc kb search <query>` | Search knowledge base |

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

[Apache License 2.0](LICENSE) — Free for commercial and open source use.

---

<p align="center">Built with ❤️ by <a href="https://www.deepleaper.com">Deepleaper 跃盟科技</a></p>
