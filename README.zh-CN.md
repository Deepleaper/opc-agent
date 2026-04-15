<p align="center">
  <h1 align="center">🤖 OPC Agent</h1>
  <p align="center"><strong>开放智能体框架 — 构建、测试、运行企业级 AI 智能体</strong></p>
  <p align="center">
    <a href="https://www.npmjs.com/package/opc-agent"><img src="https://img.shields.io/npm/v/opc-agent?color=blue" alt="npm 版本"></a>
    <a href="https://github.com/Deepleaper/opc-agent/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-green" alt="开源协议"></a>
    <a href="https://github.com/Deepleaper/opc-agent/actions"><img src="https://img.shields.io/badge/tests-passing-brightgreen" alt="测试状态"></a>
    <a href="https://www.npmjs.com/package/opc-agent"><img src="https://img.shields.io/npm/dm/opc-agent?color=orange" alt="下载量"></a>
  </p>
  <p align="center">
    <a href="./README.md">English</a> · <strong>中文</strong>
  </p>
</p>

---

## 💡 这是什么？

OPC Agent 是一个 **TypeScript 优先的开放智能体框架**，由 [跃盟科技 (Deepleaper)](https://www.deepleaper.com) 开发维护。

一句话概括：**用一个 YAML 文件定义智能体，接入任意大语言模型，一键部署到多个渠道。**

不需要写一堆胶水代码，不需要自己搞 Prompt 管理，也不需要操心渠道对接。定义好 OAD 文件，`opc run` 就完事了。

## ⚡ 快速开始（30 秒上手）

```bash
# 1. 安装 CLI
npm install -g opc-agent

# 2. 创建项目（交互式，会让你选模板）
opc init my-agent

# 3. 进入项目目录
cd my-agent

# 4. 跑起来
opc run
```

打开浏览器访问 `http://localhost:3000`，你的智能体已经在线了，自带一个好看的对话界面。

### 用模板快速创建

```bash
# 客服智能体
opc init my-service --template customer-service

# 销售助手
opc init my-sales --template sales-assistant

# 知识库问答
opc init my-kb --template knowledge-base

# 代码审查
opc init my-reviewer --template code-reviewer
```

## ✨ 核心特性

### 🔌 多模型供应商 — 不绑定任何一家

```yaml
spec:
  provider:
    default: deepseek           # 默认用 DeepSeek
    allowed: [openai, deepseek, qwen, anthropic, ollama]
  model: deepseek-chat
```

支持的供应商：
- **DeepSeek** — 性价比之王，国产首选
- **通义千问 (Qwen)** — 阿里出品，中文能力强
- **OpenAI** — GPT-4o、GPT-4o-mini
- **Anthropic** — Claude 系列
- **Ollama** — 本地部署，数据不出门
- 任何兼容 OpenAI 接口的服务

### 📡 多渠道部署 — 一套代码，到处运行

```yaml
spec:
  channels:
    - type: web        # 🌐 Web 对话界面
      port: 3000
    - type: telegram   # ✈️ Telegram 机器人
    - type: websocket  # 🔗 实时 WebSocket
    - type: slack      # 💬 Slack 集成
    - type: email      # 📧 邮件渠道
    - type: wechat     # 💚 微信公众号
    - type: feishu     # 🔵 飞书
    - type: voice      # 🎙️ 语音（STT/TTS）
    - type: webhook    # 🔔 Webhook 回调
```

### 🧠 知识库（RAG）— 让智能体拥有你的专业知识

```typescript
import { KnowledgeBase } from 'opc-agent';

const kb = new KnowledgeBase('./docs');
await kb.addFile('产品手册.pdf');
await kb.addFile('常见问题.md');
// 智能体回答时自动检索知识库，生成更准确的回答
```

### 🎭 多智能体编排 — 分工协作，按需路由

```typescript
import { Orchestrator } from 'opc-agent';

const orchestrator = new Orchestrator({
  agents: [分诊智能体, 销售智能体, 客服智能体],
  strategy: 'route-by-intent', // 按用户意图自动路由
});
```

### 🧪 内置测试 — 发布前验证智能体行为

```yaml
spec:
  testing:
    cases:
      - name: 问候测试
        input: "你好"
        expect:
          contains: ["你好", "帮"]
          maxLatencyMs: 5000

      - name: 产品咨询
        input: "你们的产品怎么收费？"
        expect:
          contains: ["价格", "套餐"]
          notContains: ["error"]
```

```bash
opc test              # 运行测试
opc test --watch      # 监听模式，改了代码自动测
opc test --json       # JSON 格式输出
```

### 🔧 插件系统 — 按需扩展

```yaml
spec:
  plugins:
    - name: logging      # 日志记录
    - name: analytics    # 使用分析
    - name: rate-limit   # 限流保护
      config: { maxPerMinute: 60 }
```

支持自定义插件，提供完整的生命周期钩子：`onInit`、`onMessage`、`onResponse`、`onError`、`onShutdown`。

### 🔒 安全特性

- 输入消毒（防 XSS、注入攻击）
- API Key 轮换管理
- CORS 跨域配置
- 安全响应头（Helmet 风格）
- Content Security Policy
- 会话隔离的认证中间件

### 📊 监控与分析

- `/api/health` — 健康检查接口
- `/api/metrics` — Prometheus 兼容指标
- `/api/dashboard` — 实时仪表盘 UI
- 对话记录导出（JSON / Markdown / CSV）

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────┐
│              OAD (YAML 定义文件)                  │
│            智能体的一切配置都在这里                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  渠道层  │  │  插件层  │  │   安全层     │  │
│  │ Web, TG, │  │  日志,   │  │  消毒, CORS, │  │
│  │ WS, 微信 │  │  分析    │  │  认证        │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │           │
│  ┌────▼──────────────▼───────────────▼────────┐ │
│  │          智能体运行时 (Agent Runtime)        │ │
│  │                                             │ │
│  │   ┌─────────┐ ┌────────┐ ┌─────────────┐  │ │
│  │   │  记忆   │ │  技能  │ │   知识库     │  │ │
│  │   │ 短期+   │ │ FAQ,   │ │   RAG 检索   │  │ │
│  │   │ 长期    │ │ 转接   │ │              │  │ │
│  │   └─────────┘ └────────┘ └─────────────┘  │ │
│  └────────────────────┬───────────────────────┘ │
│                       │                          │
│  ┌────────────────────▼───────────────────────┐ │
│  │            大语言模型供应商                   │ │
│  │  DeepSeek · 通义千问 · OpenAI · Ollama     │ │
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

## 📋 全部模板（12 个）

| 模板 | 说明 | 典型场景 |
|------|------|---------|
| `customer-service` | 客服智能体 | FAQ 自动回答 + 转人工 |
| `sales-assistant` | 销售助手 | 产品问答 + 线索捕获 + 预约 |
| `knowledge-base` | 知识库问答 | 基于文档的 RAG 语义检索 |
| `code-reviewer` | 代码审查 | Bug 检测 + 代码风格检查 |
| `hr-recruiter` | HR 招聘助手 | 简历筛选 + 面试安排 |
| `project-manager` | 项目管理 | 任务跟踪 + 会议纪要 |
| `content-writer` | 内容创作 | 博客写作 + 社媒运营 + SEO |
| `legal-assistant` | 法务助手 | 合同审查 + 合规检查 |
| `financial-advisor` | 财务顾问 | 预算管理 + 支出分析 |
| `executive-assistant` | 行政助理 | 日程管理 + 邮件处理 |
| `data-analyst` | 数据分析师 | SQL 查询 + 数据可视化 |
| `teacher` | 教学助手 | 课程设计 + 出题 + 互动 |

## 🚀 部署指南

### 本地开发

```bash
opc dev    # 热重载开发模式
```

### Docker 部署

```bash
# 每个 opc init 项目都自带 Dockerfile 和 docker-compose.yml
docker compose up -d
```

### 部署到 OpenClaw

```bash
opc deploy --target openclaw
opc deploy --target openclaw --install  # 同时注册到配置
```

### 部署到 Hermes 云

```bash
opc deploy --target hermes
```

### 环境变量

```bash
# .env
OPC_LLM_API_KEY=your-api-key
OPC_LLM_BASE_URL=https://api.deepseek.com/v1    # DeepSeek
OPC_LLM_MODEL=deepseek-chat
```

## 📖 CLI 命令参考

| 命令 | 说明 |
|------|------|
| `opc init [name]` | 创建新智能体项目（交互式） |
| `opc create <name>` | 从模板快速创建 |
| `opc run` | 启动智能体服务 |
| `opc dev` | 开发模式（热重载） |
| `opc chat` | 命令行交互对话 |
| `opc test` | 运行测试用例 |
| `opc build` | 校验 OAD 配置 |
| `opc info` | 查看智能体信息 |
| `opc analytics` | 查看使用分析 |
| `opc deploy` | 部署智能体 |
| `opc publish` | 发布到市场 |
| `opc kb add <file>` | 添加知识库文件 |
| `opc kb search <query>` | 搜索知识库 |
| `opc stats` | 查看运行时统计 |

## 🔗 SDK 参考

```typescript
import { AgentRuntime, KnowledgeBase, Orchestrator } from 'opc-agent';

// 创建并启动智能体
const runtime = new AgentRuntime();
await runtime.loadConfig('oad.yaml');
const agent = await runtime.initialize();
await runtime.start();

// 使用知识库
const kb = new KnowledgeBase('./docs');
await kb.addFile('handbook.pdf');

// 多智能体编排
const orch = new Orchestrator({
  agents: [agentA, agentB],
  strategy: 'route-by-intent',
});
```

## 🔑 OAD 配置文件说明

OAD（Open Agent Definition）是智能体的声明式定义格式：

```yaml
apiVersion: opc/v1          # API 版本
kind: Agent                  # 资源类型

metadata:
  name: my-agent             # 智能体名称
  version: 1.0.0             # 版本号
  description: 我的智能体     # 描述

spec:
  provider:
    default: deepseek        # 默认供应商
    allowed: [deepseek, openai, qwen]
  model: deepseek-chat       # 模型
  systemPrompt: |            # 系统提示词
    你是一个专业的客服助手...

  skills: []                 # 技能列表
  channels:                  # 渠道配置
    - type: web
      port: 3000

  memory:
    shortTerm: true          # 短期记忆（对话上下文）
    longTerm: false          # 长期记忆（跨会话）

  rateLimits:                # 限流
    perUser:
      maxRequests: 60
      windowMs: 60000

  cache:                     # 缓存（降低 API 开销）
    enabled: true
    ttlMs: 3600000
```

## 🤝 贡献指南

我们欢迎所有形式的贡献！

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feat/awesome-feature`
3. 编写代码和测试
4. 确保测试通过：`npm test`
5. 提交 Pull Request

### 本地开发环境

```bash
git clone https://github.com/Deepleaper/opc-agent.git
cd opc-agent
npm install
npm run build
npm test
```

## 📄 开源协议

[Apache License 2.0](LICENSE) — 商用和开源项目均可自由使用。

---

<p align="center">
  由 <a href="https://www.deepleaper.com">跃盟科技 (Deepleaper)</a> 用 ❤️ 打造
</p>
