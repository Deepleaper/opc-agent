<p align="center">
  <h1 align="center">🤖 OPC Agent</h1>
  <p align="center"><strong>开放智能体框架 — 构建、测试、运行企业级 AI 智能体</strong></p>
  <p align="center">
    <a href="https://www.npmjs.com/package/opc-agent"><img src="https://img.shields.io/npm/v/opc-agent?color=blue" alt="npm 版本"></a>
    <a href="https://github.com/Deepleaper/opc-agent/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-green" alt="开源协议"></a>
    <img src="https://img.shields.io/badge/tests-146%20passed-brightgreen" alt="146 个测试通过">
    <a href="https://www.npmjs.com/package/opc-agent"><img src="https://img.shields.io/npm/dm/opc-agent?color=orange" alt="下载量"></a>
  </p>
  <p align="center">
    <a href="./README.md">English</a> · <strong>中文</strong>
  </p>
</p>

---

## 💡 这是什么？

OPC Agent 是一个 **TypeScript 优先的开放智能体框架**，由 [跃盟科技 (Deepleaper)](https://www.deepleaper.com) 开发维护。

一句话概括：**用一个 YAML 文件（OAD）定义智能体，接入任意大语言模型，一键部署到多个渠道。**

不需要写胶水代码，不需要自己管理 Prompt，不需要操心渠道对接。定义好 OAD 文件，`opc run` 就完事了。

## ⚡ 快速开始（30 秒上手）

### 一键安装（推荐）

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.ps1 | iex
```

> 自动安装 Node.js + OPC Agent + Ollama（可选），全程有引导提示。

### 手动安装

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

打开浏览器访问 `http://localhost:3000`，内置 Web 对话界面即刻可用。

### 使用模板快速创建

```bash
opc init my-service  --template customer-service
opc init my-sales    --template sales-assistant
opc init my-kb       --template knowledge-base
opc init my-reviewer --template code-reviewer
```

## ✨ 核心特性

### 🔌 多模型供应商 — 不绑定任何一家

```yaml
spec:
  provider:
    default: deepseek
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

### 📡 10 个渠道，一套代码，到处运行

```yaml
spec:
  channels:
    - type: web        # 🌐 Web 对话界面（内置 UI）
      port: 3000
    - type: telegram   # ✈️ Telegram 机器人
    - type: websocket  # 🔗 实时 WebSocket
    - type: slack      # 💬 Slack Bot（Socket Mode / Events API）
    - type: email      # 📧 IMAP 收信 + SMTP 回信
    - type: wechat     # 💚 微信公众号
    - type: feishu     # 🔵 飞书 / Lark 消息卡片
    - type: voice      # 🎙️ 语音（STT/TTS，可配置供应商）
    - type: webhook    # 🔔 Webhook 接收 + HTTP 回调
    - type: discord    # 🎮 Discord Bot（斜杠命令 + 线程 + Embed）
```

### 🧠 知识库（RAG）— 让智能体拥有你的专业知识

```typescript
import { KnowledgeBase } from 'opc-agent';

const kb = new KnowledgeBase('./docs');
await kb.addFile('产品手册.pdf');
await kb.addFile('常见问题.md');
// 智能体回答时自动检索知识库
```

内置 TF-IDF 向量化 + 余弦相似度检索，500 字符分块 + 50 字符重叠，数据持久化到 `.opc-knowledge.json`，无需外部向量数据库。

CLI 操作：

```bash
opc kb add 产品手册.pdf    # 添加文件
opc kb search "退款政策"   # 搜索
opc kb stats               # 查看统计
opc kb clear               # 清空
```

### 🎭 多智能体编排 — 分工协作，按需路由

```typescript
import { Orchestrator } from 'opc-agent';

const orchestrator = new Orchestrator({
  agents: [分诊智能体, 销售智能体, 客服智能体],
  strategy: 'route-by-intent',
});
```

支持：顺序执行、并行执行、条件路由、智能体移交（handoff）。

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

完整生命周期钩子：`onInit`、`onMessage`、`onResponse`、`onError`、`onShutdown`。

### 🔒 安全特性

- 输入消毒（防 XSS、注入攻击）
- API Key 轮换管理
- CORS 跨域配置
- 安全响应头
- 会话隔离认证中间件

### 📊 监控与分析

Web 渠道内置以下端点：

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 健康检查 |
| `GET /api/metrics` | Prometheus 文本格式指标 |
| `GET /api/dashboard` | 实时仪表盘 UI |

Prometheus 暴露的指标：`opc_uptime_seconds`、`opc_requests_total`、`opc_messages_total`、`opc_errors_total`、`opc_llm_latency_avg_ms`、`opc_sessions_total`、`opc_token_usage_total`、`process_resident_memory_bytes`。

`opc analytics` 和 `opc stats` 命令可查看离线分析快照（历史事件存储在 `data/analytics.json`）。

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────┐
│              OAD (YAML 定义文件)                  │
│            智能体的一切配置都在这里                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  渠道层  │  │  插件层  │  │   安全层     │  │
│  │10 个渠道 │  │ 日志/分析│  │ 消毒/CORS/认证│ │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │           │
│  ┌────▼──────────────▼───────────────▼────────┐ │
│  │          智能体运行时 (Agent Runtime)        │ │
│  │                                             │ │
│  │   ┌─────────┐ ┌────────┐ ┌─────────────┐  │ │
│  │   │  记忆   │ │  技能  │ │   知识库     │  │ │
│  │   │ 短期+   │ │ HTTP,  │ │  TF-IDF RAG │  │ │
│  │   │ 长期    │ │ 调度   │ │             │  │ │
│  │   └─────────┘ └────────┘ └─────────────┘  │ │
│  └────────────────────┬───────────────────────┘ │
│                       │                          │
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
opc dev    # 文件监听热重载
```

### Docker 部署

`opc init` 创建的每个项目都自带 `Dockerfile` 和 `docker-compose.yml`：

```bash
docker compose up -d
```

`Dockerfile` 使用 `node:22-alpine`，仅安装生产依赖，暴露端口 3000，以 `npx opc run` 启动。

### 部署到 OpenClaw

```bash
opc deploy --target openclaw
opc deploy --target openclaw --install  # 同时写入本地配置
```

在 `~/.openclaw/agents/{id}/workspace/` 下生成：`IDENTITY.md`（元数据）、`SOUL.md`（系统提示词 + 模型配置）、`AGENTS.md`（技能 + 记忆 + DTV 配置）。

### 部署到 Hermes

```bash
opc deploy --target hermes
```

将 OAD 转换为 Hermes Character 格式，包含 personality、bio、lore、message examples、style guides（chat / post / all）。

### 环境变量

```bash
# .env
OPC_LLM_API_KEY=your-api-key
OPC_LLM_BASE_URL=https://api.deepseek.com/v1
OPC_LLM_MODEL=deepseek-chat
```

## 📖 CLI 命令参考

| 命令 | 说明 |
|------|------|
| `opc init [name]` | 创建新智能体项目（交互式，可选模板） |
| `opc create <name>` | 从模板快速创建 |
| `opc run` | 启动智能体服务 |
| `opc dev` | 开发模式（文件监听热重载） |
| `opc chat` | 命令行交互对话（readline 界面） |
| `opc test` | 运行 OAD 中定义的测试用例 |
| `opc build` | 校验 OAD 配置合法性 |
| `opc info` | 查看智能体信息 |
| `opc analytics` | 查看使用分析 |
| `opc stats` | 查看运行时统计快照 |
| `opc deploy` | 部署智能体（`--target openclaw\|hermes`） |
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

// 创建并启动智能体
const runtime = new AgentRuntime();
await runtime.loadConfig('oad.yaml');
await runtime.initialize();
await runtime.start();

// 使用知识库
const kb = new KnowledgeBase('./docs');
await kb.addFile('handbook.pdf');
const results = await kb.search('退款政策');

// 多智能体编排
const orch = new Orchestrator({
  agents: [agentA, agentB],
  strategy: 'route-by-intent',
});
```

## 🔑 OAD 配置文件完整说明

OAD（Open Agent Definition）是智能体的声明式定义格式：

```yaml
apiVersion: opc/v1
kind: Agent

metadata:
  name: my-agent
  version: 1.0.0
  description: 我的智能体

spec:
  provider:
    default: deepseek
    allowed: [deepseek, openai, qwen, anthropic, ollama]
  model: deepseek-chat
  systemPrompt: |
    你是一个专业的客服助手...

  skills: []

  channels:
    - type: web
      port: 3000

  memory:
    shortTerm: true        # 对话上下文记忆
    longTerm: false        # 跨会话持久记忆

  rateLimits:
    perUser:
      maxRequests: 60
      windowMs: 60000

  cache:
    enabled: true
    ttlMs: 3600000

  plugins:
    - name: logging
    - name: analytics
    - name: rate-limit
      config: { maxPerMinute: 60 }

  testing:
    cases:
      - name: 基本问候
        input: "你好"
        expect:
          contains: ["你好"]
          maxLatencyMs: 5000
```

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

## 🤝 贡献指南

欢迎所有形式的贡献！

```bash
git clone https://github.com/Deepleaper/opc-agent.git
cd opc-agent
npm install
npm run build   # TypeScript 编译
npm test        # 运行 146 个测试（22 个测试文件）
```

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feat/awesome-feature`
3. 编写代码和测试
4. 确保测试通过：`npm test`
5. 提交 Pull Request

## 📄 开源协议

[Apache License 2.0](LICENSE) — 商用和开源项目均可自由使用。

---

<p align="center">
  由 <a href="https://www.deepleaper.com">跃盟科技 (Deepleaper)</a> 用 ❤️ 打造
</p>
